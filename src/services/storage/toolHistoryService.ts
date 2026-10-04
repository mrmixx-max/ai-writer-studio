// ---------------------------------------------------------------------------
// WP 41.2 — Tool-History-Service
// ---------------------------------------------------------------------------
// Lokaler, deterministischer Service, der Läufe von Schreib-/Analyse-Tools
// protokolliert und Vorher/Nachher-Metriken vergleicht.
//
//   * KEIN LLM, kein Netzwerk, keine Tauri-IPC — rein lokal.
//   * Content-Hash über die Web Crypto API (SHA-256).
//   * In-Memory-Store als primäre Quelle; eine persistente Ablage (z. B.
//     SQLite) kann optional über einen injizierbaren Adapter angebunden werden.
//   * Defensive Fallbacks: fehlende/kaputte Eingaben werden normalisiert statt
//     eine Exception zu werfen. computeContentHash ist der einzige Aufruf, der
//     bei fehlender Web-Crypto-Umgebung bewusst hart fehlschlägt (kein stiller
//     Falsch-Hash).
//
// Richtungslogik für diffMetrics:
//   * readability, wordCount  → höher ist besser
//   * cognitiveLoad, errorCount → niedriger ist besser
// ---------------------------------------------------------------------------

export interface ToolMetrics {
  readability?: number;
  cognitiveLoad?: number;
  wordCount?: number;
  errorCount?: number;
}

export interface ToolHistoryEntry {
  toolId: string;
  contentHash: string;
  timestamp: number;
  metrics: ToolMetrics;
}

export interface MetricsDiffChange {
  metric: string;
  before: number;
  after: number;
  deltaPercent: number;
  direction: "better" | "worse" | "same";
}

export interface MetricsDiff {
  improved: boolean;
  changes: MetricsDiffChange[];
  summary: string;
}

/**
 * Optionale Persistenz-Schnittstelle (z. B. SQLite). Die Methoden dürfen
 * werfen — recordToolRun fängt Fehler defensiv ab und arbeitet rein im
 * Speicher weiter, damit ein defekter Adapter die Erfassung nie blockiert.
 */
export interface ToolHistoryAdapter {
  persist(entry: ToolHistoryEntry): void;
  loadAll?(): ToolHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Konfiguration / Konstanten
// ---------------------------------------------------------------------------

/** Metrik-Reihenfolge ist fest → deterministische Diff-Ausgabe. */
const METRIC_ORDER: ReadonlyArray<keyof ToolMetrics> = [
  "readability",
  "cognitiveLoad",
  "wordCount",
  "errorCount",
];

/** Metriken, bei denen ein kleinerer Wert eine Verbesserung bedeutet. */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set(["cognitiveLoad", "errorCount"]);

const METRIC_LABELS: Readonly<Record<string, string>> = {
  readability: "Lesbarkeit",
  cognitiveLoad: "Kognitive Last",
  wordCount: "Wortzahl",
  errorCount: "Fehlerzahl",
};

/** Obergrenze pro Tool, damit der In-Memory-Store nicht unbegrenzt wächst. */
const MAX_ENTRIES_PER_TOOL = 500;

// ---------------------------------------------------------------------------
// In-Memory-Store
// ---------------------------------------------------------------------------

const history = new Map<string, ToolHistoryEntry[]>();
let adapter: ToolHistoryAdapter | null = null;

// ---------------------------------------------------------------------------
// Web Crypto Helfer
// ---------------------------------------------------------------------------

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      "Web Crypto API (crypto.subtle) ist in dieser Umgebung nicht verfügbar.",
    );
  }
  return c.subtle;
}

const HEX = "0123456789abcdef";
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Defensive Normalisierung
// ---------------------------------------------------------------------------

/** Erzwingt einen String; null/undefined werden zu "" (deterministischer Hash). */
function coerceText(text: unknown): string {
  if (typeof text === "string") return text;
  if (text === null || text === undefined) return "";
  if (typeof text === "number" || typeof text === "boolean") return String(text);
  try {
    return JSON.stringify(text) ?? "";
  } catch {
    return "";
  }
}

/** true, wenn der Wert eine brauchbare (endliche) Zahl ist. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Behält nur bekannte Metriken mit endlichen Zahlen; alles andere fliegt raus. */
export function normalizeToolMetrics(input: unknown): ToolMetrics {
  const out: ToolMetrics = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  for (const key of METRIC_ORDER) {
    const value = raw[key];
    if (isFiniteNumber(value)) out[key] = value;
  }
  return out;
}

/** Rundet auf eine Nachkommastelle (deterministisch, ohne Float-Rauschen). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// 1) computeContentHash — SHA-256 über den Text (UTF-8)
// ---------------------------------------------------------------------------

/**
 * Berechnet den SHA-256-Hash des Textes (UTF-8) als Hex-String.
 * Deterministisch: gleicher Text → gleicher Hash. Nicht-Strings werden
 * defensiv in Strings überführt; null/undefined ergeben den Hash von "".
 */
export async function computeContentHash(text: string): Promise<string> {
  const subtle = getSubtle();
  const bytes = new TextEncoder().encode(coerceText(text));
  const digest = await subtle.digest("SHA-256", bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// 2) shouldRecompute — Cache-Treffer prüfen
// ---------------------------------------------------------------------------

/**
 * true, wenn der Lauf (neu) berechnet werden muss, d. h. KEIN Cache-Treffer
 * für (toolId, contentHash) vorliegt. Fehlende/leere Parameter gelten immer
 * als "muss neu berechnet werden" (defensiv).
 */
export function shouldRecompute(toolId: string, contentHash: string): boolean {
  if (typeof toolId !== "string" || toolId.length === 0) return true;
  if (typeof contentHash !== "string" || contentHash.length === 0) return true;
  const entries = history.get(toolId);
  if (!entries || entries.length === 0) return true;
  for (const entry of entries) {
    if (entry.contentHash === contentHash) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 3) recordToolRun — Lauf speichern
// ---------------------------------------------------------------------------

/**
 * Speichert einen Tool-Lauf im In-Memory-Store. Fehlerhafte Einträge (kein
 * toolId) werden verworfen statt zu werfen. Der Timestamp wird bei fehlendem
 * oder ungültigem Wert auf Date.now() gesetzt. Metriken werden normalisiert.
 * Ist ein Adapter gesetzt, wird der Lauf zusätzlich persistiert; Fehler des
 * Adapters werden geschluckt (die Erfassung darf daran nicht scheitern).
 */
export function recordToolRun(entry: ToolHistoryEntry): void {
  if (!entry || typeof entry !== "object") return;
  const toolId = typeof entry.toolId === "string" ? entry.toolId.trim() : "";
  if (toolId.length === 0) return;

  const normalized: ToolHistoryEntry = {
    toolId,
    contentHash:
      typeof entry.contentHash === "string" ? entry.contentHash : "",
    timestamp: isFiniteNumber(entry.timestamp) ? entry.timestamp : Date.now(),
    metrics: normalizeToolMetrics(entry.metrics),
  };

  const existing = history.get(toolId);
  if (existing) {
    existing.push(normalized);
    if (existing.length > MAX_ENTRIES_PER_TOOL) {
      existing.splice(0, existing.length - MAX_ENTRIES_PER_TOOL);
    }
  } else {
    history.set(toolId, [normalized]);
  }

  if (adapter) {
    try {
      adapter.persist(normalized);
    } catch {
      /* Persistenz ist optional — die Erfassung läuft im Speicher weiter. */
    }
  }
}

// ---------------------------------------------------------------------------
// 5) getHistory — Historie eines Tools (defensive Kopie)
// ---------------------------------------------------------------------------

/**
 * Liefert die Läufe eines Tools, aufsteigend nach Timestamp sortiert. Die
 * Einträge werden tief genug kopiert, dass Mutationen des Rückgabewerts den
 * Store nicht verändern. Unbekannte Tools liefern ein leeres Array.
 */
export function getHistory(toolId: string): ToolHistoryEntry[] {
  if (typeof toolId !== "string") return [];
  const entries = history.get(toolId);
  if (!entries || entries.length === 0) return [];
  return entries
    .map((entry) => ({
      toolId: entry.toolId,
      contentHash: entry.contentHash,
      timestamp: entry.timestamp,
      metrics: { ...entry.metrics },
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// 4) diffMetrics — Vorher/Nachher-Vergleich in Prozent
// ---------------------------------------------------------------------------

function computeDeltaPercent(before: number, after: number): number {
  if (before === 0) {
    if (after === 0) return 0;
    return after > 0 ? 100 : -100;
  }
  return round1(((after - before) / Math.abs(before)) * 100);
}

function directionOf(metric: string, before: number, after: number): MetricsDiffChange["direction"] {
  if (after === before) return "same";
  const lowerBetter = LOWER_IS_BETTER.has(metric);
  const decreased = after < before;
  const better = lowerBetter ? decreased : !decreased;
  return better ? "better" : "worse";
}

/**
 * Vergleicht zwei Metrik-Snapshots und berechnet je Metrik die prozentuale
 * Änderung sowie die Richtung (unter Berücksichtigung, ob ein kleinerer oder
 * größerer Wert erstrebenswert ist). `improved` ist true, wenn mehr Metriken
 * besser als schlechter geworden sind. Fehlende Metriken werden als 0
 * angenommen; sind beide Seiten unbekannt, wird die Metrik übersprungen.
 */
export function diffMetrics(previous: ToolMetrics, current: ToolMetrics): MetricsDiff {
  const prev = normalizeToolMetrics(previous);
  const curr = normalizeToolMetrics(current);
  const changes: MetricsDiffChange[] = [];

  for (const metric of METRIC_ORDER) {
    const hasPrev = isFiniteNumber(prev[metric]);
    const hasCurr = isFiniteNumber(curr[metric]);
    if (!hasPrev && !hasCurr) continue;

    const before = hasPrev ? (prev[metric] as number) : 0;
    const after = hasCurr ? (curr[metric] as number) : 0;
    changes.push({
      metric,
      before,
      after,
      deltaPercent: computeDeltaPercent(before, after),
      direction: directionOf(metric, before, after),
    });
  }

  let better = 0;
  let worse = 0;
  let same = 0;
  for (const c of changes) {
    if (c.direction === "better") better++;
    else if (c.direction === "worse") worse++;
    else same++;
  }

  const improved = better > worse;

  return { improved, changes, summary: buildSummary(changes, better, worse, same, improved) };
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function buildSummary(
  changes: MetricsDiffChange[],
  better: number,
  worse: number,
  same: number,
  improved: boolean,
): string {
  if (changes.length === 0) return "Keine vergleichbaren Metriken.";

  const verdict = improved
    ? "Gesamt verbessert"
    : worse > better
      ? "Gesamt verschlechtert"
      : "Gesamt unverändert";

  const details = changes
    .map((c) => {
      const label = METRIC_LABELS[c.metric] ?? c.metric;
      const dirLabel =
        c.direction === "better" ? "besser" : c.direction === "worse" ? "schlechter" : "unverändert";
      return `${label} ${signed(c.deltaPercent)}% (${dirLabel})`;
    })
    .join(", ");

  return `${verdict}: ${better} besser, ${worse} schlechter, ${same} unverändert. ${details}.`;
}

// ---------------------------------------------------------------------------
// Verwaltung (Adapter-Injektion / Reset für Tests)
// ---------------------------------------------------------------------------

/**
 * Setzt den optionalen Persistenz-Adapter. `null` deaktiviert die Persistenz.
 * Beim Setzen werden vorhandene Adapter-Daten einmalig in den In-Memory-Store
 * übernommen, sofern der Adapter loadAll() anbietet (defensiv gekapselt).
 */
export function setToolHistoryAdapter(next: ToolHistoryAdapter | null): void {
  adapter = next ?? null;
  if (!adapter || typeof adapter.loadAll !== "function") return;
  try {
    const loaded = adapter.loadAll();
    if (!Array.isArray(loaded)) return;
    for (const entry of loaded) {
      if (!entry || typeof entry !== "object") continue;
      const toolId = typeof entry.toolId === "string" ? entry.toolId.trim() : "";
      if (toolId.length === 0) continue;
      const existing = history.get(toolId) ?? [];
      existing.push({
        toolId,
        contentHash: typeof entry.contentHash === "string" ? entry.contentHash : "",
        timestamp: isFiniteNumber(entry.timestamp) ? entry.timestamp : Date.now(),
        metrics: normalizeToolMetrics(entry.metrics),
      });
      history.set(toolId, existing);
    }
  } catch {
    /* defekter Adapter darf den Store nicht beschädigen */
  }
}

/** Leert den In-Memory-Store (primär für deterministische Tests). */
export function clearToolHistory(): void {
  history.clear();
}
