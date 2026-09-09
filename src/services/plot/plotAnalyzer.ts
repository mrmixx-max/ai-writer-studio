// Plot-Analyzer-Engine (Sprint 25, Agent 5): Story-Arc-Analyse,
// Plot-Point-Extraktion, Spannungskurve, Klimax-Erkennung und
// Verbesserungsvorschlaege. Reine Funktionen + LLM via Provider,
// mit lokaler Heuristik als Offline-Fallback (Muster: feedback.ts).
//
// - analyzePlot(): LLM-Analyse via Provider (JSON-Antwort), mit lokaler
//   Heuristik als Fallback. Der LLM-Client ist injizierbar (opts.client).
// - extractPlotPoints(): Plot-Points aus Kapiteln (LLM oder Heuristik).
// - generateTensionCurve()/identifyClimax()/suggestImprovements():
//   rein, synchron, ohne LLM.

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";

export type PlotPointType =
  | "inciting-incident"
  | "rising-action"
  | "climax"
  | "falling-action"
  | "resolution";

export interface PlotPoint {
  id: string;
  title: string;
  description: string;
  position: number; // 0-100% der Geschichte
  type: PlotPointType;
  characters: string[];
  tension: number; // 0-10
}

export interface StoryArc {
  exposition: PlotPoint[];
  risingAction: PlotPoint[];
  climax: PlotPoint[];
  fallingAction: PlotPoint[];
  resolution: PlotPoint[];
}

export type Pacing = "slow" | "medium" | "fast";

export interface PlotAnalysis {
  arc: StoryArc;
  pacing: Pacing;
  tensionCurve: { position: number; tension: number }[];
  suggestions: string[];
}

export interface ChapterInput {
  title: string;
  content: string;
}

/** Injizierbarer LLM-Client: Prompt rein, Rohtext raus. Default nutzt den Provider. */
export type PlotClient = (prompt: string, signal?: AbortSignal) => Promise<string>;

export interface PlotOptions {
  client?: PlotClient;
  signal?: AbortSignal;
}

const PLOT_TYPES: PlotPointType[] = [
  "inciting-incident",
  "rising-action",
  "climax",
  "falling-action",
  "resolution",
];

const TYPE_LABELS: Record<PlotPointType, string> = {
  "inciting-incident": "Ausloesendes Ereignis (Konflikt beginnt)",
  "rising-action": "Steigende Handlung (Komplikationen, Huerden)",
  "climax": "Hoehepunkt (entscheidende Konfrontation)",
  "falling-action": "Fallende Handlung (Konsequenzen)",
  "resolution": "Aufloesung (neues Gleichgewicht)",
};

/** Baut den Analyse-Prompt fuers LLM (inkl. JSON-Antwortschema). */
export function buildPlotPrompt(text: string): string {
  const types = PLOT_TYPES.map((t) => `- ${t}: ${TYPE_LABELS[t]}`).join("\n");
  return (
    `Du bist ein erfahrener Dramaturg. Analysiere den folgenden Erzaehltext als Story-Arc ` +
    `mit Plot-Points, Spannungskurve (0-10) und Verbesserungsvorschlaegen.\n` +
    `Plot-Point-Typen:\n${types}\n\nTEXT:\n${text}\n\n` +
    `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Vorwort) im Format:\n` +
    `{"points": [{"id": "p1", "title": "...", "description": "...", "position": 0-100, ` +
    `"type": "<einer der Typen>", "characters": ["..."], "tension": 0-10}], ` +
    `"pacing": "slow|medium|fast", "suggestions": ["..."]}`
  );
}

/** Baut den Extraktions-Prompt fuers LLM (Plot-Points aus Kapiteln). */
export function buildExtractPrompt(chapters: ChapterInput[]): string {
  const body = chapters
    .map((c, i) => `KAPITEL ${i + 1} („${c.title}“):\n${c.content}`)
    .join("\n\n");
  const types = PLOT_TYPES.map((t) => `- ${t}: ${TYPE_LABELS[t]}`).join("\n");
  return (
    `Du bist ein erfahrener Dramaturg. Extrahiere aus den folgenden Kapiteln die ` +
    `wichtigsten Plot-Points (max. 2 pro Kapitel) und ordne sie nach Position ` +
    `(Kapitel 1 = 0%, letztes Kapitel = 100%) und Typ ein.\nPlot-Point-Typen:\n${types}\n\n` +
    `${body}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Vorwort) ` +
    `im Format:\n{"points": [{"id": "p1", "title": "...", "description": "...", ` +
    `"position": 0-100, "type": "<einer der Typen>", "characters": ["..."], "tension": 0-10}]}`
  );
}

function isPlotType(t: unknown): t is PlotPointType {
  return typeof t === "string" && (PLOT_TYPES as string[]).includes(t);
}

function isPacing(p: unknown): p is Pacing {
  return p === "slow" || p === "medium" || p === "fast";
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "string" ? Number(n) : (n as number);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v * 10) / 10));
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

/** Extrahiert das erste JSON-Objekt aus einer LLM-Rohantwort (toleriert Code-Fences). */
export function extractJsonObject(raw: string): unknown | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

let idCounter = 0;

function genId(prefix: string): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return `${prefix}-${c.randomUUID()}`;
  } catch {
    /* Fallback unten */
  }
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Normalisiert einen rohen Plot-Point (defensiv, nie Throw; null bei Kernlos). */
function normalizePoint(raw: unknown, index: number): PlotPoint | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title ? r.title : "";
  const description = typeof r.description === "string" ? r.description : "";
  if (!title && !description) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : `p${index + 1}`,
    title: title || `Plot-Point ${index + 1}`,
    description,
    position: clamp(r.position, 0, 100, Math.round(((index + 1) / 6) * 100)),
    type: isPlotType(r.type) ? r.type : "rising-action",
    characters: toStringArray(r.characters),
    tension: clamp(r.tension, 0, 10, 5),
  };
}

function normalizePoints(raw: unknown): PlotPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => normalizePoint(p, i))
    .filter((p): p is PlotPoint => p !== null);
}

/** Sortiert Plot-Points nach Position (Kopie, stabil). */
export function sortByPosition(points: PlotPoint[]): PlotPoint[] {
  return [...points].sort((a, b) => a.position - b.position);
}

/** Ordnet Plot-Points den fuenf Story-Arc-Phasen zu. */
export function buildArc(points: PlotPoint[]): StoryArc {
  const arc: StoryArc = {
    exposition: [],
    risingAction: [],
    climax: [],
    fallingAction: [],
    resolution: [],
  };
  for (const p of points) {
    switch (p.type) {
      case "inciting-incident":
        arc.exposition.push(p);
        break;
      case "rising-action":
        arc.risingAction.push(p);
        break;
      case "climax":
        arc.climax.push(p);
        break;
      case "falling-action":
        arc.fallingAction.push(p);
        break;
      case "resolution":
        arc.resolution.push(p);
        break;
    }
  }
  return arc;
}

/** Schaetzt das Erzaehltempo aus Textlaenge und Plot-Point-Dichte. */
function estimatePacing(wordCount: number, pointCount: number): Pacing {
  if (pointCount === 0) return "medium";
  const wordsPerPoint = wordCount / pointCount;
  if (wordsPerPoint > 1500) return "slow";
  if (wordsPerPoint < 400) return "fast";
  return "medium";
}

function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

// --- Lokale Heuristik (Offline-Fallback) -------------------------------------

const CLIMAX_MARKERS = [
  "plötzlich",
  "ploetzlich",
  "konfrontation",
  "kampf",
  "höhepunkt",
  "hoehepunkt",
  "showdown",
  "alles oder nichts",
  "kein zurück",
  "kein zurueck",
  "letzte chance",
];
const INCITING_MARKERS = [
  "eines tages",
  "brief",
  "nachricht",
  "entdeckung",
  "zum ersten mal",
];
const RESOLUTION_MARKERS = [
  "endlich frieden",
  "von nun an",
  "für immer",
  "am ende",
  "rückblick",
  "rueckblick",
  "versöhnung",
  "versoehnung",
  "abschied",
];

function scoreMarkers(lower: string, markers: string[]): number {
  return markers.filter((m) => lower.includes(m)).length;
}

function classifySentence(sentence: string, index: number, total: number): PlotPointType {
  const lower = sentence.toLowerCase();
  const rel = total > 1 ? index / (total - 1) : 0.5;
  const climaxScore = scoreMarkers(lower, CLIMAX_MARKERS) + (sentence.includes("!") ? 0.5 : 0);
  const incitingScore = scoreMarkers(lower, INCITING_MARKERS);
  const resolutionScore = scoreMarkers(lower, RESOLUTION_MARKERS);
  if (climaxScore >= 1 && rel > 0.4 && rel < 0.95) return "climax";
  if (incitingScore >= 1 && rel < 0.4) return "inciting-incident";
  if (resolutionScore >= 1 && rel > 0.6) return "resolution";
  if (rel < 0.2) return "inciting-incident";
  if (rel < 0.6) return "rising-action";
  if (rel < 0.85) return "falling-action";
  return "resolution";
}

function tensionOf(sentence: string, type: PlotPointType): number {
  const lower = sentence.toLowerCase();
  let t: number;
  if (type === "climax") t = 8;
  else if (type === "rising-action") t = 6;
  else if (type === "falling-action") t = 5;
  else if (type === "resolution") t = 3;
  else t = 5; // inciting-incident
  if (sentence.includes("!")) t += 1;
  if (sentence.includes("?")) t += 0.5;
  if (/\b(angst|gefahr|tod|kampf|flucht|schrei|blut|feuer)\b/i.test(lower)) t += 1;
  if (/\b(ruhig|friedlich|sanft|lächeln|laecheln|sonnig)\b/i.test(lower)) t -= 1;
  return Math.max(0, Math.min(10, Math.round(t * 2) / 2));
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

function namesOf(sentence: string): string[] {
  // Eigennamen-Heuristik: kapitalisierte Woerter ausserhalb des Satzanfangs.
  const words = sentence.match(/[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)*/g) ?? [];
  const stop = new Set([
    "Der", "Die", "Das", "Ein", "Eine", "Einer", "Und", "Aber", "Doch",
    "Wenn", "Als", "Denn", "Es", "Er", "Sie", "Ich", "Wir", "Am",
    "Im", "Zum", "Vom",
  ]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words.slice(1)) {
    if (!stop.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/**
 * Lokale, LLM-freie Heuristik: waehlt markante Saetze als Plot-Points
 * (max. 6, gleichmaessig ueber den Text verteilt).
 */
export function localPlotPoints(text: string): PlotPoint[] {
  const sentences = sentencesOf(text);
  if (sentences.length === 0) return [];
  const n = Math.min(6, sentences.length);
  const picked: { sentence: string; index: number }[] = [];
  for (let k = 0; k < n; k++) {
    const idx = n === 1 ? 0 : Math.round((k / (n - 1)) * (sentences.length - 1));
    const sentence = sentences[idx];
    if (sentence && !picked.some((p) => p.index === idx)) picked.push({ sentence, index: idx });
  }
  return picked.map(({ sentence, index }, k) => {
    const type = classifySentence(sentence, index, sentences.length);
    return {
      id: `local-${k + 1}`,
      title: sentence.length > 60 ? sentence.slice(0, 60).trimEnd() + "…" : sentence,
      description: sentence,
      position: sentences.length > 1 ? Math.round((index / (sentences.length - 1)) * 100) : 50,
      type,
      characters: namesOf(sentence),
      tension: tensionOf(sentence, type),
    };
  });
}

/** Lokale Gesamtanalyse (Offline-Fallback fuer analyzePlot). */
export function localAnalysis(text: string): PlotAnalysis {
  const points = localPlotPoints(text);
  const arc = buildArc(points);
  const pacing = estimatePacing(countWords(text), points.length);
  const prelim: PlotAnalysis = {
    arc,
    pacing,
    tensionCurve: generateTensionCurve(points),
    suggestions: [],
  };
  prelim.suggestions = suggestImprovements(prelim);
  return prelim;
}

// --- Reine Analyse-Funktionen (kein LLM) -------------------------------------

/**
 * Erzeugt den Spannungsverlauf aus Plot-Points: nach Position sortiert,
 * Start-/End-Anker bei 0/100% (Tension des naechsten/nahesten Punkts).
 */
export function generateTensionCurve(points: PlotPoint[]): { position: number; tension: number }[] {
  const sorted = sortByPosition(points);
  if (sorted.length === 0) return [];
  const curve = sorted.map((p) => ({ position: p.position, tension: p.tension }));
  if (curve[0].position > 0) {
    curve.unshift({ position: 0, tension: curve[0].tension });
  }
  const last = curve[curve.length - 1];
  if (last.position < 100) {
    curve.push({ position: 100, tension: last.tension });
  }
  return curve;
}

/**
 * Identifiziert den Hoehepunkt: expliziter Climax-Point mit hoechster
 * Tension, sonst der Point mit der hoechsten Tension (fruehester bei
 * Gleichstand). undefined bei leerer Liste.
 */
export function identifyClimax(points: PlotPoint[]): PlotPoint | undefined {
  if (points.length === 0) return undefined;
  const climaxes = points.filter((p) => p.type === "climax");
  const pool = climaxes.length > 0 ? climaxes : points;
  return pool.reduce((best, p) =>
    p.tension > best.tension || (p.tension === best.tension && p.position < best.position)
      ? p
      : best
  );
}

/**
 * Erzeugt Verbesserungsvorschlaege aus einer Analyse (Regel-Heuristik):
 * fehlende Phasen, schwacher Klimax, Spannungsabfall, Tempo.
 */
export function suggestImprovements(analysis: PlotAnalysis): string[] {
  const suggestions: string[] = [];
  const { arc, tensionCurve, pacing } = analysis;
  const total =
    arc.exposition.length +
    arc.risingAction.length +
    arc.climax.length +
    arc.fallingAction.length +
    arc.resolution.length;
  if (total === 0) {
    return ["Kein Plot erkennbar — fuege ein ausloesendes Ereignis und einen Hoehepunkt hinzu."];
  }
  if (arc.exposition.length === 0) {
    suggestions.push(
      "Der Einstieg fehlt: Ein ausloesendes Ereignis in den ersten 20% wuerde den Konflikt frueh etablieren."
    );
  }
  if (arc.risingAction.length < 2) {
    suggestions.push(
      "Die steigende Handlung ist duenn: Mindestens 2 Komplikationen vor dem Hoehepunkt erhoehen die Fallhoehe."
    );
  }
  if (arc.climax.length === 0) {
    suggestions.push(
      "Kein Hoehepunkt markiert: Lege die entscheidende Konfrontation auf ca. 75–85% der Geschichte."
    );
  }
  if (arc.resolution.length === 0) {
    suggestions.push(
      "Die Aufloesung fehlt: Ein kurzes neues Gleichgewicht nach dem Hoehepunkt rundet den Bogen ab."
    );
  }
  const tensions = tensionCurve.map((c) => c.tension);
  if (tensions.length > 0) {
    const max = Math.max(...tensions);
    if (max < 7) {
      suggestions.push(
        `Die maximale Spannung liegt nur bei ${max}/10 — ein staerkerer Hoehepunkt wuerde den Arc tragen.`
      );
    }
    let drops = 0;
    for (let i = 1; i < tensionCurve.length; i++) {
      if (tensionCurve[i - 1].tension - tensionCurve[i].tension >= 4) drops++;
    }
    if (drops > 0) {
      suggestions.push(
        "Die Spannung faellt an mindestens einer Stelle abrupt ab (≥4 Punkte) — pruefe, ob der Uebergang vorbereitet ist."
      );
    }
  }
  if (pacing === "slow") {
    suggestions.push(
      "Tempo: eher langsam — kuenze Exposition oder setze fruehere Komplikationen, um den Sog zu erhoehen."
    );
  } else if (pacing === "fast") {
    suggestions.push(
      "Tempo: eher schnell — gib Schluesselmomenten mehr Raum (Sinnen, Rueckschlaege), damit sie wirken."
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "Der Arc ist solide aufgebaut: Alle Phasen sind besetzt und die Spannungskurve steigt zum Hoehepunkt."
    );
  }
  return suggestions;
}

/** Default-Client ueber den konfigurierten LLM-Provider (streamt, sammelt, gibt Rohtext zurueck). */
async function providerClient(prompt: string, signal?: AbortSignal): Promise<string> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) throw new Error("Provider nicht erreichbar");
  let raw = "";
  for await (
    const token of provider.chat(
      [
        { role: "system" as const, content: "Du bist ein erfahrener Dramaturg. Antworte ausschliesslich mit dem verlangten JSON." },
        { role: "user" as const, content: prompt },
      ],
      { model: settings.model, temperature: 0.4, maxTokens: settings.maxTokens },
      signal,
    )
  ) {
    raw += token;
  }
  return raw;
}

function isAbort(e: unknown, signal?: AbortSignal): boolean {
  return (e as Error)?.name === "AbortError" || signal?.aborted === true;
}

/**
 * Analysiert einen Erzaehltext als Story-Arc. Nutzt opts.client
 * (Tests/Panel-Mock) oder den konfigurierten Provider; bei Fehlern
 * greift die lokale Heuristik (ausser bei explizitem Abort).
 */
export async function analyzePlot(text: string, opts?: PlotOptions): Promise<PlotAnalysis> {
  if (!text.trim()) {
    return { arc: buildArc([]), pacing: "medium", tensionCurve: [], suggestions: ["Kein Text zum Analysieren."] };
  }
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildPlotPrompt(text), opts?.signal);
    const parsed = extractJsonObject(raw);
    if (!parsed || typeof parsed !== "object") return localAnalysis(text);
    const p = parsed as Record<string, unknown>;
    const points = sortByPosition(normalizePoints(p.points));
    const finalPoints = points.length > 0 ? points : localPlotPoints(text);
    const arc = buildArc(finalPoints);
    const pacing = isPacing(p.pacing)
      ? p.pacing
      : estimatePacing(countWords(text), finalPoints.length);
    const prelim: PlotAnalysis = {
      arc,
      pacing,
      tensionCurve: generateTensionCurve(finalPoints),
      suggestions: [],
    };
    const llmSuggestions = toStringArray(p.suggestions);
    prelim.suggestions = llmSuggestions.length > 0 ? llmSuggestions : suggestImprovements(prelim);
    return prelim;
  } catch (e) {
    if (isAbort(e, opts?.signal)) throw e;
    return localAnalysis(text);
  }
}

/**
 * Extrahiert Plot-Points aus Kapiteln. Nutzt opts.client oder den
 * konfigurierten Provider; bei Fehlern greift die lokale Heuristik
 * pro Kapitel (Position = Kapitelanteil).
 */
export async function extractPlotPoints(
  chapters: ChapterInput[],
  opts?: PlotOptions,
): Promise<PlotPoint[]> {
  const nonEmpty = chapters.filter((c) => (c.title + c.content).trim());
  if (nonEmpty.length === 0) return [];
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildExtractPrompt(nonEmpty), opts?.signal);
    const parsed = extractJsonObject(raw);
    if (parsed && typeof parsed === "object") {
      const points = sortByPosition(
        normalizePoints((parsed as Record<string, unknown>).points),
      );
      if (points.length > 0) return points;
    }
  } catch (e) {
    if (isAbort(e, opts?.signal)) throw e;
    // Fallthrough zur Heuristik
  }
  // Lokale Heuristik: max. 2 Points pro Kapitel, Position = Kapitelanteil.
  const out: PlotPoint[] = [];
  nonEmpty.forEach((ch, ci) => {
    const local = localPlotPoints(ch.content).slice(0, 2);
    const base = nonEmpty.length > 1 ? (ci / (nonEmpty.length - 1)) * 100 : 50;
    local.forEach((p, k) => {
      const jitter = local.length > 1 ? (k / (local.length - 1) - 0.5) * (100 / nonEmpty.length / 2) : 0;
      out.push({
        ...p,
        id: `${genId("pp")}-${ci}-${k}`,
        title: ch.title ? `${ch.title}: ${p.title}` : p.title,
        position: Math.max(0, Math.min(100, Math.round((base + jitter) * 10) / 10)),
      });
    });
  });
  return sortByPosition(out);
}

// --- Kapitel-API: Handlungsstruktur + Konflikte (Sprint 25, Agent 5) -------------
// Oeffentliche Fassade auf Kapitel-Listen (id/title/content), wie sie der
// Projekt-Store liefert. Nutzt LLM via Provider (opts.client injizierbar,
// Tests mocken ihn), mit deterministischer Heuristik als Offline-Fallback.

/** Kapitel-Eingabe fuer die strukturbezogene Analyse. */
export interface PlotChapter {
  id: string;
  title: string;
  content: string;
}

/** Erkannter Konflikt: Typ, Beschreibung, betroffene Kapitel (1-basiert). */
export interface Conflict {
  type: string;
  description: string;
  chapters: number[];
}

type ChapterLike = { id?: string; title: string; content: string };

function nonEmptyChapters<T extends ChapterLike>(chapters: T[]): (T & { index: number })[] {
  return chapters
    .map((c, index) => ({ ...c, index }))
    .filter((c) => (c.title + c.content).trim().length > 0);
}

/**
 * Spannungskurve pro Kapitel: ein Tension-Wert (0-10) je Kapitel (1-basiert).
 * LLM-Plot-Points (via extractPlotPoints) werden je Kapitel gemittelt;
 * Kapitel ohne Points fallen auf die lokale Heuristik zurueck.
 */
export async function getTensionCurve(
  chapters: ChapterLike[],
  opts?: PlotOptions,
): Promise<{ chapter: number; tension: number }[]> {
  const nonEmpty = nonEmptyChapters(chapters);
  if (nonEmpty.length === 0) return [];
  const points = await extractPlotPoints(
    nonEmpty.map((c) => ({ title: c.title, content: c.content })),
    opts,
  );
  const n = nonEmpty.length;
  return nonEmpty.map((ch, i) => {
    const lo = (i / n) * 100;
    const hi = ((i + 1) / n) * 100;
    const bucket = points.filter((p) =>
      i === n - 1 ? p.position >= lo && p.position <= hi : p.position >= lo && p.position < hi,
    );
    let tension: number;
    if (bucket.length > 0) {
      tension = bucket.reduce((s, p) => s + p.tension, 0) / bucket.length;
    } else {
      const local = localPlotPoints(ch.content);
      tension =
        local.length > 0
          ? local.reduce((s, p) => s + p.tension, 0) / local.length
          : 5;
    }
    return { chapter: i + 1, tension: Math.round(tension * 10) / 10 };
  });
}

const CONFLICT_TYPES: { type: string; hint: string; words: string[] }[] = [
  {
    type: "Person vs. Person",
    hint: "Zwischenmenschlicher Konflikt (Streit, Kampf, Konfrontation)",
    words: ["streit", "kampf", "feind", "gegner", "rival", "konfrontation", "angriff", "griff", "droh", "hass", "widersprach"],
  },
  {
    type: "Person vs. Selbst",
    hint: "Innerer Konflikt (Zweifel, Angst, Schuld, Entscheidung)",
    words: ["zweifel", "angst", "schuld", "gewissen", "entscheidung", "zerrissen", "reue", "scham", "furcht"],
  },
  {
    type: "Person vs. Gesellschaft",
    hint: "Konflikt mit Normen und Macht (Gesetz, Verbot, Herrschaft)",
    words: ["gesetz", "verbot", "herrscher", "koenig", "könig", "strafe", "verbannt", "aufstand", "regel", "gericht"],
  },
  {
    type: "Person vs. Natur",
    hint: "Kampf gegen Naturgewalten (Sturm, Feuer, Wildnis)",
    words: ["sturm", "unwetter", "feuer", "flut", "wildnis", "duerre", "dürre", "kaelte", "kälte", "lawine", "wueste", "wüste"],
  },
  {
    type: "Person vs. Schicksal",
    hint: "Schicksalhaftes/uebernatuerliches Wirken (Fluch, Prophezeiung, Magie)",
    words: ["fluch", "prophezeiung", "schicksal", "magie", "orakel", "verdammnis", "gott", "goetter", "götter", "geist"],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Heuristische Konflikt-Erkennung (rein, synchron): Schlüsselwort-Suche je
 * Konflikttyp und Kapitel. Direkte Rede („...") zaehlt zusaetzlich als
 * zwischenmenschliches Signal. Kapitelnummern sind 1-basiert relativ zur
 * uebergebenen Liste.
 */
export function heuristicConflicts<T extends ChapterLike>(chapters: T[]): Conflict[] {
  const nonEmpty = nonEmptyChapters(chapters);
  const out: Conflict[] = [];
  for (const ct of CONFLICT_TYPES) {
    const re = new RegExp(`\\b(${ct.words.map(escapeRegExp).join("|")})\\w*`, "i");
    const hits: { chapter: number; word: string }[] = [];
    nonEmpty.forEach((ch, i) => {
      const m = ch.content.match(re);
      const dialogue = ct.type === "Person vs. Person" && /[„"»«]/.test(ch.content);
      if (m && m[1]) hits.push({ chapter: i + 1, word: m[1].toLowerCase() });
      else if (dialogue) hits.push({ chapter: i + 1, word: "Dialog" });
    });
    if (hits.length > 0) {
      const evidence = [...new Set(hits.map((h) => h.word))].slice(0, 3).join(", ");
      const where = [...new Set(hits.map((h) => h.chapter))].sort((a, b) => a - b);
      out.push({
        type: ct.type,
        description: `${ct.hint}. Spuren in Kapitel ${where.join(", ")} (z.B. \u201E${evidence}\u201C).`,
        chapters: where,
      });
    }
  }
  return out;
}

/** Baut den Konflikt-Prompt fuers LLM (inkl. JSON-Antwortschema). */
export function buildConflictPrompt<T extends ChapterLike>(chapters: T[]): string {
  const body = chapters
    .map((c, i) => `KAPITEL ${i + 1} („${c.title}“):\n${c.content}`)
    .join("\n\n");
  return (
    `Du bist ein erfahrener Dramaturg. Erkenne die zentralen Konflikte in den folgenden Kapiteln. ` +
    `Typische Konflikttypen: Person vs. Person, Person vs. Selbst, Person vs. Gesellschaft, ` +
    `Person vs. Natur, Person vs. Schicksal.\n\n${body}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt ` +
    `(kein Markdown, kein Vorwort) im Format:\n{"conflicts": [{"type": "...", "description": "...", "chapters": [1, 2]}]}`
  );
}

function normalizeConflicts(raw: unknown, chapterCount: number): Conflict[] {
  if (!Array.isArray(raw)) return [];
  const out: Conflict[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type.trim().slice(0, 80) : "";
    if (!type) continue;
    const description =
      typeof r.description === "string" && r.description.trim()
        ? r.description.trim().slice(0, 500)
        : type;
    const list = Array.isArray(r.chapters) ? r.chapters : [];
    const chapters = [...new Set(
      list.flatMap((c: unknown): number[] => {
        const n = typeof c === "string" ? Number(c) : c;
        return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= chapterCount ? [n] : [];
      }),
    )].sort((a, b) => a - b);
    out.push({ type, description, chapters });
  }
  return out;
}

/**
 * Erkennt Konflikte in Kapiteln. Nutzt opts.client oder den konfigurierten
 * Provider (Ollama-Pattern wie analyzePlot); bei Fehlern oder leeren
 * LLM-Treffern greift die lokale Heuristik. Kapitelnummern im Ergebnis
 * beziehen sich auf die uebergebene Liste (1-basiert).
 */
export async function detectConflicts(
  chapters: ChapterLike[],
  opts?: PlotOptions,
): Promise<Conflict[]> {
  const nonEmpty = nonEmptyChapters(chapters);
  if (nonEmpty.length === 0) return [];
  // Original-Nummerierung (leere Kapitel herausgefiltert) wiederherstellen.
  const remap = (nums: number[]): number[] =>
    nums.map((n) => (nonEmpty[n - 1] ? nonEmpty[n - 1].index + 1 : n));
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildConflictPrompt(nonEmpty), opts?.signal);
    const parsed = extractJsonObject(raw);
    if (parsed && typeof parsed === "object") {
      const norm = normalizeConflicts(
        (parsed as Record<string, unknown>).conflicts,
        nonEmpty.length,
      );
      if (norm.length > 0) {
        return norm.map((c) => ({ ...c, chapters: remap(c.chapters) }));
      }
    }
  } catch (e) {
    if (isAbort(e, opts?.signal)) throw e;
    // Fallthrough zur Heuristik
  }
  return heuristicConflicts(nonEmpty).map((c) => ({ ...c, chapters: remap(c.chapters) }));
}
