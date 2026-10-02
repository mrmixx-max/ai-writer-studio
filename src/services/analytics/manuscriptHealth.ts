// Master-Health-Cockpit (WP 24.1): Gesamt-Manuskript-Diagnose.
//
// Ein einziger, lokaler Scan über das gesamte Manuskript, der Mängel nach
// Dringlichkeit kategorisiert:
//
//   P0 (Showstopper)   — widersprüchliche Täteralibis, ungelöste
//                        Zeitstempel-Kollisionen, offene Track-Changes.
//   P1 (Handwerk)      — Hurenkinder/Schusterjungen, Bandwurmsätze (> 40 Wörter),
//                        verwaiste Figuren.
//   P2 (Stil-Feinschliff) — überstrapazierte Lieblingsfloskeln,
//                        Dialog-zu-Narrativ-Ungleichgewicht.
//
// Design-Regeln (analog zu readabilityMetrics / plotForensics / styleFingerprint):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Listen
//     bzw. Null-Statistiken statt zu werfen.
//   - Performance: Der Scan ist O(n) über die Wortzahl. Ergebnisse werden je
//     Kategorie gedeckelt (maxIssuesPerCategory), damit die UI auch bei sehr
//     großen Manuskripten nicht durch riesige Issue-Listen blockiert. Für den
//     Aufruf aus der UI gilt: debounced bzw. in einem Web Worker ausführen.
//
// Hinweis: Die Heuristiken (Alibi-, Zeitstempel- und Floskel-Erkennung) sind
// bewusst konservativ und rein textbasiert. Sie liefern Hinweise, keine
// endgültigen Urteile.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Dringlichkeitsstufe eines Befunds. */
export type Severity = "P0" | "P1" | "P2";

/** Minimaler Kapitel-Input des Health-Scans. */
export interface ChapterInput {
  /** Stabile Kapitel-ID. */
  id: string;
  /** Kapiteltitel. */
  title: string;
  /** Kapiteltext (Klartext oder TipTap-JSON). */
  content: string;
  /** Figuren, die in diesem Kapitel auftreten. */
  characters: string[];
}

/** Eine Figur der Figurendatenbank. */
export interface Character {
  name: string;
  role: string;
  /** Kapitelnummer des ersten Auftritts (1-basiert). */
  firstAppearance: number;
  /** Kapitelnummer des letzten Auftritts (1-basiert). */
  lastAppearance: number;
}

/** Art einer Lektoratsänderung. */
export type TrackChangeType = "insert" | "delete";

/** Eine Lektoratsänderung (Track-Change). */
export interface TrackChange {
  id: string;
  type: TrackChangeType;
  /** true = akzeptiert/abgelehnt; false = noch offen. */
  resolved: boolean;
}

/** Das zu prüfende Manuskript-Projekt. */
export interface ManuscriptProject {
  chapters: ChapterInput[];
  characters: Character[];
  trackChanges: TrackChange[];
}

/** Ein einzelner Befund des Health-Scans. */
export interface HealthIssue {
  severity: Severity;
  category: string;
  message: string;
  location?: string;
}

/** Aggregierte Kennzahlen des Manuskripts. */
export interface HealthStats {
  totalWords: number;
  totalChapters: number;
  openTrackChanges: number;
  /** Offene Handlungsfäden: Alibi-Konflikte, Zeitstempel-Kollisionen,
   *  verwaiste Figuren und hängende Figuren-Referenzen. */
  unresolvedPlots: number;
}

/** Ergebnis eines Master-Health-Scans. */
export interface HealthScanResult {
  issues: HealthIssue[];
  stats: HealthStats;
}

/** Ein Eintrag der Drucklegungs-Checkliste. */
export interface TodoItem {
  priority: Severity;
  task: string;
  done: boolean;
}

/** Optionale Konfiguration des Scans (alle Werte haben sichere Defaults). */
export interface HealthScanOptions {
  /** Obergrenze der Befunde je Kategorie (Default 200). */
  maxIssuesPerCategory?: number;
  /** Wortgrenze für Bandwurmsätze (Default 40). */
  longSentenceThreshold?: number;
  /** Mindesthäufigkeit, ab der eine Floskel als überstrapaziert gilt (Default 3). */
  phraseMinCount?: number;
  /** Obergrenze der verwalteten n-Gramme (Speicherschutz, Default 200000). */
  maxDistinctPhrases?: number;
  /** Ab dieser Wortzahl wird das Dialog-Gleichgewicht bewertet (Default 100). */
  dialogueMinWords?: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ISSUES_PER_CATEGORY = 200;
const DEFAULT_LONG_SENTENCE_THRESHOLD = 40;
const DEFAULT_PHRASE_MIN_COUNT = 3;
const DEFAULT_MAX_DISTINCT_PHRASES = 200_000;
const DEFAULT_DIALOGUE_MIN_WORDS = 100;

/** Ab diesem Anteil (Zeichen im Dialog / Gesamtzeichen) gilt ein Text als
 *  dialoglastig. */
const DIALOGUE_HIGH_RATIO = 0.6;
/** Unter diesem Anteil gilt ein Text als zu narrativlastig. */
const DIALOGUE_LOW_RATIO = 0.05;

/** Bis zu dieser Wortzahl gilt eine allein stehende Zeile als Hurenkind/Schusterjunge. */
const WIDOW_ORPHAN_MAX_WORDS = 1;

const SEVERITY_RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

/** Kategorien, deren Befunde als offene Handlungsfäden zählen. */
const PLOT_CATEGORIES = new Set<string>([
  "alibi-conflict",
  "timestamp-collision",
  "orphaned-character",
  "dangling-character",
]);

/** Stilistische Aufgabenbeschreibungen je Kategorie (für die To-Do-Liste). */
const TASK_LABELS: Record<string, string> = {
  "alibi-conflict": "Widersprüchliche Alibis auflösen",
  "timestamp-collision": "Zeitstempel-Kollision bereinigen",
  "open-track-changes": "Offene Track-Changes vor Export klären",
  "widow-orphan": "Hurenkind/Schusterjunge umbrechen",
  "long-sentence": "Bandwurmsatz kürzen",
  "orphaned-character": "Verwaiste Figur einbinden oder streichen",
  "dangling-character": "Figuren-Referenz ins Register aufnehmen",
  "overused-phrase": "Lieblingsfloskel variieren",
  "dialogue-balance": "Dialog-Narrativ-Balance anpassen",
};

/** Marker, die eine Zeitstempel-Kollision als aufgelöst kennzeichnen. */
const RESOLUTION_MARKERS: readonly string[] = [
  "irrtum",
  "verwechsl",
  "tatsächlich war",
  "korrigier",
  "berichtigt",
  "stellte sich heraus",
  "doch nicht",
  "unzutreffend",
  "fehlerhaft",
  "später war klar",
];

/** Stoppwörter, die allein keine Floskel-Signatur tragen. */
const STOP_WORDS = new Set<string>([
  // Deutsch
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
  "und", "oder", "aber", "doch", "als", "wie", "wenn", "weil", "dass", "ob",
  "in", "im", "an", "am", "auf", "aus", "bei", "mit", "von", "vor",
  "zu", "zum", "zur", "nach", "über", "unter", "durch", "für", "gegen",
  "ohne", "um", "je", "pro",
  "ist", "sind", "war", "waren", "sein", "seine", "seinen", "ihre", "ihren", "ihr",
  "es", "er", "sie", "ich", "wir", "du", "man", "sich",
  // Englisch
  "the", "a", "an", "and", "or", "but", "of", "to", "on", "at",
  "for", "with", "is", "are", "was", "were", "be", "been", "it", "its",
]);

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Locale-unabhängiger String-Vergleich (deterministisch). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sätze an . ! ? … zerlegen (leere Fragmente werden verworfen). */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Wörter tokenisieren: Buchstaben/Ziffern inkl. Umlaute (klein geschrieben). */
function tokenizeWords(text: string): string[] {
  const hits = text.toLowerCase().match(/[a-zäöüß0-9]+(?:['’-][a-zäöüß0-9]+)*/gu);
  return hits ?? [];
}

/** TipTap-JSON (oder Klartext) defensiv in reinen Text überführen. */
function contentToText(content: unknown): string {
  if (typeof content !== "string") return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const parts: string[] = [];
      collectText(parsed, parts);
      if (parts.length > 0) return parts.join(" ");
    } catch {
      // Kein gültiges JSON → als Klartext behandeln.
    }
  }
  return content;
}

function collectText(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === "string") out.push(obj.text);
  if (Array.isArray(obj.content)) collectText(obj.content, out);
  if (Array.isArray(obj.items)) collectText(obj.items, out);
}

/** Regex, der einen Namen als eigenständiges Wort erkennt (inkl. Genitiv-s). */
function buildNameMatcher(name: string, global: boolean): RegExp {
  const esc = escapeRegExp(name.trim());
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${esc}(?:s|’s|'s)?(?![\\p{L}\\p{N}])`,
    global ? "giu" : "iu",
  );
}

/** Baut Matcher für alle bekannten Figurennamen (einmal je Scan). */
function buildMatchers(names: string[]): Map<string, RegExp> {
  const map = new Map<string, RegExp>();
  for (const name of names) {
    const key = name.trim();
    if (!key || map.has(key)) continue;
    map.set(key, buildNameMatcher(key, false));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Text-Forensik: Alibis
// ---------------------------------------------------------------------------

/** Erkennt Sätze, die ein Alibi behaupten. */
const ALIBI_RE = /\balibi(?:s)?\b|zur tatzeit|zum tatzeitpunkt|tatzeit/iu;

/** Bestimmt das Subjekt eines Alibi-Satzes (die Figur, um deren Alibi es geht). */
function alibiSubject(
  sentence: string,
  names: string[],
  matchers: Map<string, RegExp>,
): string | null {
  const lower = sentence.toLowerCase();
  const idx = lower.search(/alibi/iu);
  if (idx >= 0) {
    const before = sentence.slice(0, idx);
    const after = sentence.slice(idx);
    for (const name of names) {
      if (matchers.get(name)?.test(before)) return name;
    }
    for (const name of names) {
      if (matchers.get(name)?.test(after)) return name;
    }
  }
  // Kein "Alibi"-Wort (z. B. "zur Tatzeit"): erste genannte Figur gewinnt.
  for (const name of names) {
    if (matchers.get(name)?.test(sentence)) return name;
  }
  return null;
}

/** Normalisiert die Kernaussage eines Alibi-Satzes (ohne Subjekt und "Alibi"). */
function alibiClaim(sentence: string, subject: string): string {
  let s = sentence.toLowerCase();
  s = s.replace(buildNameMatcher(subject, true), " ");
  s = s.replace(/\balibi(?:s)?\b/gu, " ");
  s = s.replace(/[^\p{L}\p{N}\s]+/gu, " ");
  s = s.replace(/\s+/gu, " ").trim();
  return s;
}

interface AlibiConflict {
  name: string;
  count: number;
  location?: string;
}

function collectAlibiConflicts(
  chapters: ChapterText[],
  names: string[],
  matchers: Map<string, RegExp>,
): AlibiConflict[] {
  const byName = new Map<string, Map<string, string>>();
  for (const chapter of chapters) {
    for (const sentence of chapter.sentences) {
      if (!ALIBI_RE.test(sentence)) continue;
      const subject = alibiSubject(sentence, names, matchers);
      if (!subject) continue;
      const claim = alibiClaim(sentence, subject);
      if (!claim) continue;
      let claims = byName.get(subject);
      if (!claims) {
        claims = new Map();
        byName.set(subject, claims);
      }
      if (!claims.has(claim)) claims.set(claim, chapter.title);
    }
  }

  const findings: AlibiConflict[] = [];
  for (const [name, claims] of byName) {
    if (claims.size >= 2) {
      findings.push({ name, count: claims.size, location: claims.values().next().value });
    }
  }
  findings.sort((a, b) => cmpStr(a.name, b.name));
  return findings;
}

// ---------------------------------------------------------------------------
// Text-Forensik: Zeitstempel-Kollisionen
// ---------------------------------------------------------------------------

/** Uhrzeiten: "22:00", "22.00" und "22 Uhr" (ohne Doppelzählung). */
const TIME_TOKEN_RE = /\b(\d{1,2})[:.](\d{2})\b|(?<![:\d])(\d{1,2})\s*uhr\b/giu;

/** Extrahiert normalisierte Zeitstempel (HH:MM) aus einem Satz. */
function extractTimestamps(sentence: string): string[] {
  const out: string[] = [];
  for (const m of sentence.matchAll(TIME_TOKEN_RE)) {
    const hour = Number.parseInt(m[1] ?? m[3] ?? "", 10);
    const minute = m[2] != null ? Number.parseInt(m[2], 10) : 0;
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) continue;
    out.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return out;
}

/** Signatur eines Satzes ohne die Zeitangabe (der „Ereignis-Kern“). */
function timeSignature(sentence: string): string {
  return sentence
    .replace(TIME_TOKEN_RE, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

interface TimestampCollision {
  timestamp: string;
  count: number;
  location?: string;
}

function collectTimestampCollisions(chapters: ChapterText[]): TimestampCollision[] {
  const byTs = new Map<string, { sigs: Map<string, string>; resolved: boolean }>();
  for (const chapter of chapters) {
    for (const sentence of chapter.sentences) {
      const timestamps = extractTimestamps(sentence);
      if (timestamps.length === 0) continue;
      const sig = timeSignature(sentence);
      const lower = sentence.toLowerCase();
      const resolved = RESOLUTION_MARKERS.some((marker) => lower.includes(marker));
      for (const ts of timestamps) {
        let entry = byTs.get(ts);
        if (!entry) {
          entry = { sigs: new Map(), resolved: false };
          byTs.set(ts, entry);
        }
        if (!entry.sigs.has(sig)) entry.sigs.set(sig, chapter.title);
        if (resolved) entry.resolved = true;
      }
    }
  }

  const findings: TimestampCollision[] = [];
  for (const [timestamp, entry] of byTs) {
    if (entry.sigs.size >= 2 && !entry.resolved) {
      findings.push({ timestamp, count: entry.sigs.size, location: entry.sigs.values().next().value });
    }
  }
  findings.sort((a, b) => cmpStr(a.timestamp, b.timestamp));
  return findings;
}

// ---------------------------------------------------------------------------
// Text-Forensik: Hurenkinder & Schusterjungen
// ---------------------------------------------------------------------------

interface WidowOrphan {
  type: "widow" | "orphan";
  lineNumber: number;
  text: string;
}

/** Zählt Wörter einer Zeile (Leerraum-getrennt). */
function countLineWords(line: string): number {
  return line.split(/\s+/).filter(Boolean).length;
}

/**
 * Erkennt Hurenkinder (erste Zeile eines Absatzes mit einem Wort) und
 * Schusterjungen (letzte Zeile eines Absatzes mit einem Wort). Einzeilige
 * Absätze werden bewusst nicht gewertet.
 */
function detectWidowsOrphans(text: string): WidowOrphan[] {
  const issues: WidowOrphan[] = [];
  if (typeof text !== "string" || text.trim().length === 0) return issues;

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].trim() !== "") i += 1;
    const end = i - 1;
    const paragraph = lines.slice(start, end + 1);
    if (paragraph.length < 2) continue;

    const first = paragraph[0].trim();
    if (first.length > 0 && countLineWords(first) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "orphan", lineNumber: start + 1, text: first });
    }
    const last = paragraph[paragraph.length - 1].trim();
    if (last.length > 0 && countLineWords(last) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "widow", lineNumber: end + 1, text: last });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Text-Forensik: Überstrapazierte Floskeln
// ---------------------------------------------------------------------------

/** Erkennt wiederkehrende 2–4-Wort-Kombinationen (Floskeln). */
function detectOverusedPhrases(
  chapters: ChapterText[],
  minCount: number,
  maxDistinct: number,
  maxResults: number,
): { phrase: string; count: number }[] {
  const counts = new Map<string, number>();
  const cap =
    Number.isFinite(maxDistinct) && maxDistinct > 0
      ? Math.floor(maxDistinct)
      : DEFAULT_MAX_DISTINCT_PHRASES;

  for (const chapter of chapters) {
    const tokens = chapter.tokens;
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const firstTok = tokens[i];
        const lastTok = tokens[i + n - 1];
        // Reine Funktionswort-Rahmen (Start UND Ende Stoppwort) tragen keine
        // Floskel-Signatur und blähen die Zählung nur auf.
        if (STOP_WORDS.has(firstTok) && STOP_WORDS.has(lastTok)) continue;

        let allStop = true;
        for (let j = 0; j < n; j++) {
          if (!STOP_WORDS.has(tokens[i + j])) {
            allStop = false;
            break;
          }
        }
        if (allStop) continue;

        const key = tokens.slice(i, i + n).join(" ");
        const current = counts.get(key);
        if (current === undefined) {
          if (counts.size >= cap) continue;
          counts.set(key, 1);
        } else {
          counts.set(key, current + 1);
        }
      }
    }
  }

  const candidates: { phrase: string; count: number }[] = [];
  for (const [phrase, count] of counts) {
    if (count >= minCount) candidates.push({ phrase, count });
  }
  candidates.sort(
    (a, b) =>
      b.count - a.count ||
      b.phrase.length - a.phrase.length ||
      cmpStr(a.phrase, b.phrase),
  );

  const selected: { phrase: string; count: number }[] = [];
  for (const cand of candidates) {
    if (selected.some((s) => s.phrase.includes(cand.phrase))) continue;
    selected.push(cand);
    if (selected.length >= maxResults) break;
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Interne Kapitel-Repräsentation
// ---------------------------------------------------------------------------

interface ChapterText {
  id: string;
  title: string;
  text: string;
  tokens: string[];
  sentences: string[];
  /** Figuren, die das Kapitel laut Register auflistet (getrimmt). */
  listedCharacters: string[];
}

function normalizeChapters(raw: unknown): ChapterInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ChapterInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Partial<ChapterInput>;
    out.push({
      id: typeof c.id === "string" ? c.id : "",
      title: typeof c.title === "string" ? c.title : "",
      content: typeof c.content === "string" ? c.content : "",
      characters: Array.isArray(c.characters)
        ? c.characters.filter((n): n is string => typeof n === "string")
        : [],
    });
  }
  return out;
}

function normalizeCharacters(raw: unknown): Character[] {
  if (!Array.isArray(raw)) return [];
  const out: Character[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Partial<Character>;
    if (typeof c.name !== "string" || c.name.trim().length === 0) continue;
    out.push({
      name: c.name.trim(),
      role: typeof c.role === "string" ? c.role : "",
      firstAppearance: Number.isFinite(c.firstAppearance) ? Number(c.firstAppearance) : 0,
      lastAppearance: Number.isFinite(c.lastAppearance) ? Number(c.lastAppearance) : 0,
    });
  }
  return out;
}

function normalizeTrackChanges(raw: unknown): TrackChange[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackChange[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const t = entry as Partial<TrackChange>;
    out.push({
      id: typeof t.id === "string" ? t.id : "",
      type: t.type === "delete" ? "delete" : "insert",
      resolved: t.resolved === true,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1) Master-Health-Scan
// ---------------------------------------------------------------------------

/**
 * Durchkämmt das Projekt und kategorisiert Mängel nach Dringlichkeit.
 *
 * Der Scan ist rein lokal und deterministisch. Fehlende oder ungültige
 * Eingaben werden defensiv als leer behandelt. Die Befundliste ist stabil
 * sortiert (P0 → P1 → P2, dann Kategorie/Ort/Nachricht) und je Kategorie
 * gedeckelt, damit die UI nicht durch Massenbefunde blockiert.
 */
export function runMasterHealthScan(
  project: ManuscriptProject,
  options: HealthScanOptions = {},
): HealthScanResult {
  const maxIssuesPerCategory =
    Number.isFinite(options.maxIssuesPerCategory) && (options.maxIssuesPerCategory ?? 0) > 0
      ? Math.floor(options.maxIssuesPerCategory as number)
      : DEFAULT_MAX_ISSUES_PER_CATEGORY;
  const longSentenceThreshold =
    Number.isFinite(options.longSentenceThreshold) && (options.longSentenceThreshold ?? 0) > 0
      ? Math.floor(options.longSentenceThreshold as number)
      : DEFAULT_LONG_SENTENCE_THRESHOLD;
  const phraseMinCount =
    Number.isFinite(options.phraseMinCount) && (options.phraseMinCount ?? 0) > 0
      ? Math.floor(options.phraseMinCount as number)
      : DEFAULT_PHRASE_MIN_COUNT;
  const maxDistinctPhrases =
    Number.isFinite(options.maxDistinctPhrases) && (options.maxDistinctPhrases ?? 0) > 0
      ? Math.floor(options.maxDistinctPhrases as number)
      : DEFAULT_MAX_DISTINCT_PHRASES;
  const dialogueMinWords =
    Number.isFinite(options.dialogueMinWords) && (options.dialogueMinWords ?? 0) >= 0
      ? Math.floor(options.dialogueMinWords as number)
      : DEFAULT_DIALOGUE_MIN_WORDS;

  const chapters = normalizeChapters(project?.chapters);
  const roster = normalizeCharacters(project?.characters);
  const trackChanges = normalizeTrackChanges(project?.trackChanges);

  const rosterNames = roster.map((c) => c.name);
  const chapterCharNames: string[] = [];
  for (const c of chapters) {
    for (const name of c.characters) {
      const trimmed = name.trim();
      if (trimmed) chapterCharNames.push(trimmed);
    }
  }
  const allNames: string[] = [];
  const seenName = new Set<string>();
  for (const name of [...rosterNames, ...chapterCharNames]) {
    const key = name.toLowerCase();
    if (seenName.has(key)) continue;
    seenName.add(key);
    allNames.push(name);
  }
  const matchers = buildMatchers(allNames);

  const chapterTexts: ChapterText[] = [];
  let totalWords = 0;
  for (const c of chapters) {
    const text = contentToText(c.content);
    const tokens = tokenizeWords(text);
    totalWords += tokens.length;
    chapterTexts.push({
      id: c.id,
      title: c.title || c.id || "Ohne Titel",
      text,
      tokens,
      sentences: splitSentences(text),
      listedCharacters: c.characters.map((n) => n.trim()).filter(Boolean),
    });
  }

  const issues: HealthIssue[] = [];
  const perCategory = new Map<string, number>();
  let narrativeUnresolved = 0;

  const add = (issue: HealthIssue): void => {
    const count = perCategory.get(issue.category) ?? 0;
    if (count >= maxIssuesPerCategory) {
      if (PLOT_CATEGORIES.has(issue.category)) narrativeUnresolved += 1;
      return;
    }
    perCategory.set(issue.category, count + 1);
    issues.push(issue);
    if (PLOT_CATEGORIES.has(issue.category)) narrativeUnresolved += 1;
  };

  // --- P0: offene Track-Changes ---------------------------------------------
  const openChanges = trackChanges.filter((t) => !t.resolved);
  if (openChanges.length > 0) {
    add({
      severity: "P0",
      category: "open-track-changes",
      message:
        `${openChanges.length} Lektoratsänderung(en) sind noch nicht akzeptiert ` +
        `oder abgelehnt. Vor dem Export zwingend klären.`,
      location: openChanges.map((t) => t.id).filter(Boolean).slice(0, 20).join(", ") || undefined,
    });
  }

  // --- P0: widersprüchliche Alibis ------------------------------------------
  for (const conflict of collectAlibiConflicts(chapterTexts, allNames, matchers)) {
    add({
      severity: "P0",
      category: "alibi-conflict",
      message:
        `Widersprüchliche Alibis für „${conflict.name}“: ` +
        `${conflict.count} voneinander abweichende Aussagen.`,
      location: conflict.location,
    });
  }

  // --- P0: ungelöste Zeitstempel-Kollisionen --------------------------------
  for (const collision of collectTimestampCollisions(chapterTexts)) {
    add({
      severity: "P0",
      category: "timestamp-collision",
      message:
        `Zeitstempel-Kollision um ${collision.timestamp} Uhr: ` +
        `${collision.count} widersprüchliche Ereignisse ohne Auflösung.`,
      location: collision.location,
    });
  }

  // --- P1: Hurenkinder & Schusterjungen ------------------------------------
  for (const chapter of chapterTexts) {
    for (const wo of detectWidowsOrphans(chapter.text)) {
      const label = wo.type === "orphan" ? "Hurenkind" : "Schusterjunge";
      add({
        severity: "P1",
        category: "widow-orphan",
        message: `${label} in Zeile ${wo.lineNumber}: „${wo.text}“.`,
        location: chapter.title,
      });
    }
  }

  // --- P1: Bandwurmsätze ----------------------------------------------------
  for (const chapter of chapterTexts) {
    chapter.sentences.forEach((sentence, index) => {
      const wordCount = tokenizeWords(sentence).length;
      if (wordCount > longSentenceThreshold) {
        const excerpt = sentence.length > 80 ? `${sentence.slice(0, 77)}…` : sentence;
        add({
          severity: "P1",
          category: "long-sentence",
          message:
            `Bandwurmsatz mit ${wordCount} Wörtern ` +
            `(Grenze ${longSentenceThreshold}): „${excerpt}“.`,
          location: `${chapter.title} · Satz ${index + 1}`,
        });
      }
    });
  }

  // --- P1: verwaiste Figuren & hängende Referenzen --------------------------
  const rosterLower = new Set(rosterNames.map((n) => n.toLowerCase()));
  const appearances = new Map<string, number>();
  for (const name of rosterNames) appearances.set(name, 0);
  for (const chapter of chapterTexts) {
    const listedLower = new Set(
      chapter.listedCharacters.map((n) => n.toLowerCase()),
    );
    for (const name of rosterNames) {
      const inList = listedLower.has(name.toLowerCase());
      const inText = matchers.get(name)?.test(chapter.text) ?? false;
      if (inList || inText) appearances.set(name, (appearances.get(name) ?? 0) + 1);
    }
  }
  for (const name of rosterNames) {
    if ((appearances.get(name) ?? 0) === 0) {
      add({
        severity: "P1",
        category: "orphaned-character",
        message: `Verwaiste Figur „${name}“: im Manuskript an keiner Stelle verwendet.`,
        location: "Figurenregister",
      });
    }
  }

  const dangling = new Set<string>();
  for (const chapter of chapterTexts) {
    for (const raw of chapter.listedCharacters) {
      if (!raw || rosterLower.has(raw.toLowerCase())) continue;
      dangling.add(raw);
    }
  }
  for (const name of Array.from(dangling).sort(cmpStr)) {
    add({
      severity: "P1",
      category: "dangling-character",
      message: `Figur „${name}“ tritt in Kapiteln auf, fehlt aber im Figurenregister.`,
      location: "Figurenregister",
    });
  }

  // --- P2: überstrapazierte Floskeln ----------------------------------------
  for (const phrase of detectOverusedPhrases(
    chapterTexts,
    phraseMinCount,
    maxDistinctPhrases,
    20,
  )) {
    add({
      severity: "P2",
      category: "overused-phrase",
      message: `Überstrapazierte Floskel „${phrase.phrase}“ (${phrase.count}×).`,
      location: "Manuskript",
    });
  }

  // --- P2: Dialog-zu-Narrativ-Ungleichgewicht -------------------------------
  if (totalWords >= dialogueMinWords) {
    const quotePatterns: RegExp[] = [/„[^“]*“/gu, /"[^"]*"/gu, /«[^»]*»/gu];
    let dialogueChars = 0;
    let totalChars = 0;
    for (const chapter of chapterTexts) {
      totalChars += chapter.text.replace(/\s+/gu, "").length;
      for (const re of quotePatterns) {
        for (const match of chapter.text.matchAll(re)) dialogueChars += match[0].length;
      }
    }
    const ratio = totalChars > 0 ? dialogueChars / totalChars : 0;
    if (ratio > DIALOGUE_HIGH_RATIO) {
      add({
        severity: "P2",
        category: "dialogue-balance",
        message:
          `Dialoglastig: ${Math.round(ratio * 100)} % des Textes stehen in ` +
          `Anführungszeichen (Richtwert ≤ ${Math.round(DIALOGUE_HIGH_RATIO * 100)} %).`,
        location: "Manuskript",
      });
    } else if (ratio < DIALOGUE_LOW_RATIO) {
      add({
        severity: "P2",
        category: "dialogue-balance",
        message:
          `Narrativlastig: nur ${Math.round(ratio * 100)} % Dialoganteil ` +
          `(Richtwert ≥ ${Math.round(DIALOGUE_LOW_RATIO * 100)} %).`,
        location: "Manuskript",
      });
    }
  }

  // --- Sortierung (deterministisch) -----------------------------------------
  issues.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      cmpStr(a.category, b.category) ||
      cmpStr(a.location ?? "", b.location ?? "") ||
      cmpStr(a.message, b.message),
  );

  return {
    issues,
    stats: {
      totalWords,
      totalChapters: chapters.length,
      openTrackChanges: openChanges.length,
      unresolvedPlots: narrativeUnresolved,
    },
  };
}

// ---------------------------------------------------------------------------
// 2) Publikationsreife
// ---------------------------------------------------------------------------

/**
 * Berechnet die prozentuale Publikationsreife (0–100 %).
 *
 * Abzug je Befund, gedeckelt je Stufe:
 *   - P0: 25 Punkte je Befund (max. 100 Abzug)
 *   - P1:  5 Punkte je Befund (max.  40 Abzug)
 *   - P2:  2 Punkte je Befund (max.  15 Abzug)
 *
 * Ohne Befunde ergibt das 100 %; vier Showstopper bereits 0 %.
 * Fehlende/ungültige Ergebnisse werden als fehlerfrei (100) behandelt.
 */
export function calculateReadinessScore(result: HealthScanResult): number {
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  let p0 = 0;
  let p1 = 0;
  let p2 = 0;
  for (const issue of issues) {
    if (issue?.severity === "P0") p0 += 1;
    else if (issue?.severity === "P1") p1 += 1;
    else if (issue?.severity === "P2") p2 += 1;
  }
  const penalty =
    Math.min(p0 * 25, 100) + Math.min(p1 * 5, 40) + Math.min(p2 * 2, 15);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return Math.round(score);
}

// ---------------------------------------------------------------------------
// 3) To-Do-Liste vor der Drucklegung
// ---------------------------------------------------------------------------

function todoText(issue: HealthIssue): string {
  const label = TASK_LABELS[issue.category] ?? "Prüfen";
  const where = issue.location ? ` [${issue.location}]` : "";
  return `${label}${where}: ${issue.message}`;
}

/**
 * Erstellt eine priorisierte To-Do-Checkliste vor der Drucklegung.
 *
 * Ein Eintrag je Befund, sortiert P0 → P1 → P2 (stabil). Alle Einträge sind
 * zunächst offen (`done: false`). Ohne Befunde ist die Liste leer.
 */
export function generateTodoList(result: HealthScanResult): TodoItem[] {
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  return [...issues]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .map((issue) => ({
      priority: issue.severity,
      task: todoText(issue),
      done: false,
    }));
}
