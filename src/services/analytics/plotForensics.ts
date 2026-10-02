// Plot-Forensik & Wissens-Matrix (WP 22.2).
//
// Drei forensische Werkzeuge für die narrative Konsistenz:
//
//   1. buildKnowledgeMatrix  — verfolgt je Figur, wer wann was erfahren hat
//                              (Fakt, Kapitel, Quelle → Herkunftsgraph).
//   2. auditChronology       — meldet, wenn eine Figur etwas weiß, das sie
//                              zum Zeitpunkt noch nicht erfahren haben kann
//                              (Quelle weiß es später / nie, oder zirkulärer
//                              Informationsfluss).
//   3. trackLooseEnds        — spürt Hinweise, Requisiten und Waffen auf, die
//                              eingeführt, aber nie aufgelöst wurden.
//
// Design-Regeln (analog zu readabilityMetrics / styleFingerprint):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Matrix
//     bzw. leere Arrays statt zu werfen.
//
// Kapitelnummern sind 1-basiert und ergeben sich aus der Reihenfolge des
// übergebenen Arrays (die Kapitel werden als chronologisch geordnet
// vorausgesetzt). Ein `id`-Feld wird nicht interpretiert.

/** Art eines losen Endes. */
export type LooseEndType = "hint" | "prop" | "weapon";

/** Minimaler Kapitel-Input der Plot-Forensik. */
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

/** Ein einzelner Wissensposten einer Figur. */
export interface KnownFact {
  /** Der Fakt (menschenlesbar, getrimmt). */
  fact: string;
  /** Kapitelnummer, in der der Fakt erlernt wurde (1-basiert). */
  learnedInChapter: number;
  /** Quelle: Figur, "selbst" (Eigenbeobachtung) oder "unbekannt". */
  learnedFrom: string;
}

/** Wissenszustand einer Figur. */
export interface KnowledgeState {
  character: string;
  knownFacts: KnownFact[];
}

/** Wissens-Matrix des gesamten Buchs. */
export interface KnowledgeMatrix {
  characters: Map<string, KnowledgeState>;
}

/** Eine Chronologie-Verletzung des Wissens. */
export interface ChronologyViolation {
  character: string;
  fact: string;
  chapter: number;
  reason: string;
}

/** Ein loses Ende (eingeführt, evtl. nie aufgelöst). */
export interface LooseEnd {
  type: LooseEndType;
  description: string;
  introducedInChapter: number;
  resolved: boolean;
}

/** Ein zirkulärer Informationsfluss für einen Fakt. */
export interface InformationCycle {
  fact: string;
  /** Beteiligte Figuren in Zyklus-Reihenfolge (z. B. ["Anna", "Ben"]). */
  path: string[];
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const SELF_SOURCE = "selbst";
const UNKNOWN_SOURCE = "unbekannt";
const SEP = "\u0001";

/** Ein einzelnes, großgeschriebenes Namenswort (inkl. Umlaute/Bindestrich). */
const NAME_TOKEN = "[A-ZÄÖÜ][\\p{L}äöüß-]*";

/** Verben, mit denen eine Figur Wissen erwirbt (Subjekt = Lernende). */
const LEARN_VERB =
  "(?:erfährt|erfuhr|erfährt\\s+soeben|lernt|lernte|hört|hörte|liest|las|sieht|sah|entdeckt|entdeckte|begreift|begriff|weiß|wusste|versteht|verstand|bekommt\\s+mit|bekam\\s+mit|merkt|merkte|checkt|kapiert)";

/** Verben, mit denen eine Figur Wissen weitergibt (Subjekt = Quelle). */
const TELL_VERB =
  "(?:erzählt|erzählte|sagt|sagte|verrät|verriet|gesteht|gestand|erklärt|erklärte|informiert|informierte|berichtet|berichtete|schreibt|schrieb|warnt|warnte|offenbart|offenbarte|beichtet|beichtete|vermittelt|vermittelte|zeigt|zeigte)";

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

/** Satz-Split an . ! ? … (leere Fragmente verworfen). */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Fakt für den Vergleich normalisieren (Kleinschreibung, Satzzeichen weg). */
function normalizeFact(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[»«„“”"'`´’]/gu, "")
    .replace(/[.,;:!?…]+$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Fakt für die Ausgabe säubern (Anführungs-/Satzzeichen an den Rändern). */
function cleanFact(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  s = s.replace(/^[»«„“”"'`´’]+/u, "").trim();
  s = s.replace(/[»«„“”"'`´’]+$/u, "").trim();
  s = s.replace(/[.!?…]+$/u, "").trim();
  return s;
}

/** Ist die Quelle eine benannte Figur (nicht "selbst"/"unbekannt"/leer)? */
function isNamedSource(source: string): boolean {
  const s = (source ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return low !== SELF_SOURCE && low !== UNKNOWN_SOURCE;
}

/** Figurenliste defensiv normalisieren (trimmen, deduplizieren). */
function normalizeNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
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

/** Quelle-Alternation aus bekannten Figuren + generischem Namens-Token. */
function buildSourceAlt(names: string[]): string {
  const alts = names
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  alts.push(NAME_TOKEN);
  return alts.join("|");
}

interface RawKnowledgeEvent {
  learner: string;
  source: string;
  fact: string;
}

/** Fallback: Lernende aus dem Text ableiten, wenn `characters` fehlt. */
function deriveLearnerNames(sentences: string[]): string[] {
  const re = new RegExp(`(${NAME_TOKEN})\\s+${LEARN_VERB}`, "iu");
  const names = new Set<string>();
  for (const sentence of sentences) {
    const m = re.exec(sentence);
    if (m && m[1]) names.add(m[1].trim());
  }
  return Array.from(names);
}

/** Einen Wissens-Event aus einem Satz für eine Figur extrahieren. */
function matchKnowledgeEvent(
  sentence: string,
  learner: string,
  sourceAlt: string,
): RawKnowledgeEvent | null {
  const name = learner.trim();
  if (!name) return null;
  const esc = escapeRegExp(name);

  // 1) "Anna erfährt von Ben, dass …"
  const from = new RegExp(
    `\\b${esc}\\s+${LEARN_VERB}\\s+(?:es\\s+)?von\\s+(${sourceAlt})\\b\\s*,?\\s*(?:dass\\s+|:\\s*)?(.+)`,
    "iu",
  );
  const mFrom = from.exec(sentence);
  if (mFrom) {
    const fact = cleanFact(mFrom[2] ?? "");
    if (fact) {
      return { learner: name, source: (mFrom[1] ?? "").trim() || UNKNOWN_SOURCE, fact };
    }
  }

  // 2) "Ben erzählt Anna, dass …" (Anna = Lernende, Ben = Quelle)
  const tell = new RegExp(
    `(${sourceAlt})\\s+${TELL_VERB}\\s+(?:der\\s+|die\\s+|dem\\s+|den\\s+)?${esc}\\b\\s*,?\\s*(?:dass\\s+|:\\s*)?(.+)`,
    "iu",
  );
  const mTell = tell.exec(sentence);
  if (mTell) {
    const fact = cleanFact(mTell[2] ?? "");
    if (fact) {
      return { learner: name, source: (mTell[1] ?? "").trim() || UNKNOWN_SOURCE, fact };
    }
  }

  // 3) "Anna entdeckt, dass …" (Eigenbeobachtung)
  const self = new RegExp(
    `\\b${esc}\\s+${LEARN_VERB}\\s*,?\\s*(?:dass\\s+|:\\s*)?(.+)`,
    "iu",
  );
  const mSelf = self.exec(sentence);
  if (mSelf) {
    const fact = cleanFact(mSelf[1] ?? "");
    if (fact) return { learner: name, source: SELF_SOURCE, fact };
  }

  return null;
}

function extractKnowledgeEvents(content: string, names: string[]): RawKnowledgeEvent[] {
  const events: RawKnowledgeEvent[] = [];
  if (!content) return events;
  const sentences = splitSentences(content);
  const candidates = names.length > 0 ? names : deriveLearnerNames(sentences);
  if (candidates.length === 0) return events;
  const sourceAlt = buildSourceAlt(names);

  for (const sentence of sentences) {
    for (const learner of candidates) {
      const event = matchKnowledgeEvent(sentence, learner, sourceAlt);
      if (event) events.push(event);
    }
  }
  return events;
}

function ensureState(matrix: KnowledgeMatrix, name: string): KnowledgeState {
  const existing = matrix.characters.get(name);
  if (existing) return existing;
  const state: KnowledgeState = { character: name, knownFacts: [] };
  matrix.characters.set(name, state);
  return state;
}

function edgeKey(factKey: string, from: string, to: string): string {
  return `${factKey}${SEP}${from}${SEP}${to}`;
}

/** Kanonische Signatur eines Zyklus (Rotation auf kleinstes Element). */
function canonicalCycle(cycle: string[]): string {
  if (cycle.length === 0) return "";
  let best = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cmpStr(cycle[i], cycle[best]) < 0) best = i;
  }
  return [...cycle.slice(best), ...cycle.slice(0, best)].join(SEP);
}

// ---------------------------------------------------------------------------
// 1) Wissens-Matrix
// ---------------------------------------------------------------------------

/**
 * Baut die Wissens-Matrix aus den Kapiteln (in chronologischer Reihenfolge).
 *
 * Für jede Figur wird festgehalten, welchen Fakt sie in welchem Kapitel von
 * wem erfahren hat. Das erste Lernen eines Fakts gewinnt (stabile Herkunft).
 * Figuren ohne Fakten werden trotzdem registriert; ebenso benannte Quellen,
 * damit die Chronologie-Prüfung unbegründete Quellen erkennen kann.
 */
export function buildKnowledgeMatrix(chapters: ChapterInput[]): KnowledgeMatrix {
  const matrix: KnowledgeMatrix = { characters: new Map<string, KnowledgeState>() };
  if (!Array.isArray(chapters)) return matrix;

  chapters.forEach((chapter, index) => {
    if (!chapter || typeof chapter !== "object") return;
    const chapterNumber = index + 1;
    const names = normalizeNames(chapter.characters);
    for (const name of names) ensureState(matrix, name);

    const text = contentToText(chapter.content);
    if (!text) return;

    const events = extractKnowledgeEvents(text, names);
    for (const event of events) {
      const key = normalizeFact(event.fact);
      if (!key) continue;
      const state = ensureState(matrix, event.learner);
      const alreadyKnown = state.knownFacts.some((k) => normalizeFact(k.fact) === key);
      if (alreadyKnown) continue;
      state.knownFacts.push({
        fact: event.fact,
        learnedInChapter: chapterNumber,
        learnedFrom: event.source,
      });
      if (isNamedSource(event.source) && event.source !== event.learner) {
        ensureState(matrix, event.source);
      }
    }
  });

  return matrix;
}

// ---------------------------------------------------------------------------
// 2) Zyklische Informationsflüsse
// ---------------------------------------------------------------------------

/**
 * Erkennt zirkuläre Informationsflüsse in der Wissens-Matrix.
 *
 * Für jeden Fakt wird ein gerichteter Herkunftsgraph gebaut (Quelle → Lernende).
 * Ein Zyklus bedeutet: Niemand kann die Information ursprünglich erlangt haben
 * (A weiß es von B, B von A). Azyklische Ketten liefern ein leeres Ergebnis.
 */
export function detectInformationCycles(matrix: KnowledgeMatrix): InformationCycle[] {
  const cycles: InformationCycle[] = [];
  if (!matrix || !(matrix.characters instanceof Map)) return cycles;

  // Fakt → (Lernende → Quelle)
  const byFact = new Map<string, { display: string; edges: Map<string, string> }>();
  for (const [character, state] of matrix.characters) {
    for (const kf of state?.knownFacts ?? []) {
      const key = normalizeFact(kf.fact);
      const source = (kf.learnedFrom ?? "").trim();
      if (!key || !isNamedSource(source) || source === character) continue;
      if (!byFact.has(key)) byFact.set(key, { display: kf.fact, edges: new Map() });
      byFact.get(key)!.edges.set(character, source);
    }
  }

  for (const { display, edges } of byFact.values()) {
    const nodes = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const [to, from] of edges) {
      nodes.add(to);
      nodes.add(from);
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(to);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];
    const seenCycles = new Set<string>();

    const dfs = (node: string): void => {
      visited.add(node);
      stack.add(node);
      path.push(node);
      for (const next of adj.get(node) ?? []) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (stack.has(next)) {
          const idx = path.indexOf(next);
          const cycle = path.slice(idx);
          const sig = canonicalCycle(cycle);
          if (!seenCycles.has(sig)) {
            seenCycles.add(sig);
            cycles.push({ fact: display, path: cycle });
          }
        }
      }
      stack.delete(node);
      path.pop();
    };

    for (const node of Array.from(nodes).sort(cmpStr)) {
      if (!visited.has(node)) dfs(node);
    }
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// 3) Chronologie-Audit
// ---------------------------------------------------------------------------

/**
 * Prüft die Chronologie des Wissens.
 *
 * Meldet (a) Lernende, deren Quelle den Fakt erst später kennt, (b) Lernende,
 * deren Quelle den Fakt nie kennt (unbegründete Quelle) und (c) zirkuläre
 * Informationsflüsse (ein Eintrag je Zyklus). Konsequente azyklische Ketten
 * liefern ein leeres Ergebnis. Ergebnis ist deterministisch sortiert.
 */
export function auditChronology(matrix: KnowledgeMatrix): ChronologyViolation[] {
  const violations: ChronologyViolation[] = [];
  if (!matrix || !(matrix.characters instanceof Map)) return violations;

  // Fakt → (Figur → KnownFact); erstes Vorkommen je Figur gewinnt.
  const factIndex = new Map<string, Map<string, KnownFact>>();
  for (const [character, state] of matrix.characters) {
    for (const kf of state?.knownFacts ?? []) {
      const key = normalizeFact(kf.fact);
      if (!key) continue;
      if (!factIndex.has(key)) factIndex.set(key, new Map());
      const perChar = factIndex.get(key)!;
      if (!perChar.has(character)) perChar.set(character, kf);
    }
  }

  // Zyklen zuerst — ihre Kanten werden unten nicht doppelt gemeldet.
  const cycles = detectInformationCycles(matrix);
  const cycleEdges = new Set<string>();
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.path.length; i++) {
      const from = cycle.path[i];
      const to = cycle.path[(i + 1) % cycle.path.length];
      cycleEdges.add(edgeKey(normalizeFact(cycle.fact), from, to));
    }
  }

  for (const cycle of cycles) {
    const key = normalizeFact(cycle.fact);
    const start = cycle.path[0];
    const kf = factIndex.get(key)?.get(start);
    violations.push({
      character: start,
      fact: kf ? kf.fact : cycle.fact,
      chapter: kf ? kf.learnedInChapter : 0,
      reason:
        `Zirkulärer Informationsfluss: ${cycle.path.join(" → ")} → ${start} ` +
        `(Fakt: „${cycle.fact}“). Keine der Figuren kann die Information ursprünglich erlangt haben.`,
    });
  }

  // Herkunfts-Prüfung: Quelle muss den Fakt zum Lernzeitpunkt bereits kennen.
  for (const [character, state] of matrix.characters) {
    for (const kf of state?.knownFacts ?? []) {
      const key = normalizeFact(kf.fact);
      const source = (kf.learnedFrom ?? "").trim();
      if (!key || !isNamedSource(source) || source === character) continue;

      const perChar = factIndex.get(key);
      if (!perChar) continue;
      const sourceFact = perChar.get(source);
      const chapter = kf.learnedInChapter;

      if (sourceFact) {
        if (sourceFact.learnedInChapter > chapter) {
          if (cycleEdges.has(edgeKey(key, source, character))) continue;
          violations.push({
            character,
            fact: kf.fact,
            chapter,
            reason:
              `${character} weiß „${kf.fact}“ bereits in Kapitel ${chapter}, ` +
              `doch die Quelle ${source} kennt es erst seit Kapitel ${sourceFact.learnedInChapter}.`,
          });
        }
      } else {
        violations.push({
          character,
          fact: kf.fact,
          chapter,
          reason:
            `${character} hat „${kf.fact}“ in Kapitel ${chapter} von ${source} erfahren, ` +
            `aber ${source} kennt diesen Fakt an keiner Stelle.`,
        });
      }
    }
  }

  violations.sort(
    (a, b) =>
      a.chapter - b.chapter || cmpStr(a.character, b.character) || cmpStr(a.fact, b.fact),
  );
  return violations;
}

// ---------------------------------------------------------------------------
// 4) Lose Enden
// ---------------------------------------------------------------------------

const WEAPON_WORDS: readonly string[] = [
  "messer", "pistole", "revolver", "gewehr", "flinte", "waffe", "schusswaffe",
  "hiebwaffe", "schwert", "dolch", "degen", "säbel", "machete", "axt", "beil",
  "bogen", "armbrust", "klinge", "granate", "patrone", "pfeil", "speer",
  "lanze", "schlagstock", "knüppel", "sprengsatz", "bombe", "gift",
];

const PROP_WORDS: readonly string[] = [
  "schlüssel", "brief", "notiz", "tagebuch", "foto", "bild", "ring", "amulett",
  "medaillon", "kette", "anhänger", "karte", "kompass", "uhr", "münze",
  "koffer", "truhe", "tresor", "umschlag", "manuskript", "flasche", "spiegel",
  "kerze", "laterne", "handschuh", "brille", "pfeife", "hut", "mantel",
  "tasche", "rucksack", "handy", "telefon", "festplatte", "akte", "dokument",
  "vertrag", "testament", "medikament", "spritze", "seil", "leiter", "buch",
];

const HINT_WORDS: readonly string[] = [
  "hinweis", "spur", "rätsel", "geheimnis", "zeichen", "symbol", "andeutung",
  "verdacht", "warnung", "nachricht", "code", "botschaft", "verschlüsselung",
  "fußspur", "fingerabdruck", "blutspur", "alibi", "motiv", "gerücht",
  "flüstern", "schatten", "kombination", "passwort", "anspielung", "mysterium",
];

const KEYWORD_SOURCES: ReadonlyArray<readonly [LooseEndType, readonly string[]]> = [
  ["weapon", WEAPON_WORDS],
  ["prop", PROP_WORDS],
  ["hint", HINT_WORDS],
];

const KEYWORD_MAP: Map<string, LooseEndType> = (() => {
  const map = new Map<string, LooseEndType>();
  for (const [type, words] of KEYWORD_SOURCES) {
    for (const word of words) if (!map.has(word)) map.set(word, type);
  }
  return map;
})();

/** Wortgrenzen-Regex (Unicode-bewusst), optional mit deutscher Plural-Endung. */
function buildWordRegex(word: string, allowSuffix: boolean): RegExp {
  const esc = escapeRegExp(word.toLowerCase());
  const suffix = allowSuffix ? "(?:en|er|es|e|n|s)?" : "";
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${esc}${suffix}(?=$|[^\\p{L}\\p{N}])`, "u");
}

interface CompiledKeyword {
  keyword: string;
  type: LooseEndType;
  re: RegExp;
}

const COMPILED_KEYWORDS: CompiledKeyword[] = Array.from(KEYWORD_MAP.entries()).map(
  ([keyword, type]) => ({ keyword, type, re: buildWordRegex(keyword, true) }),
);

/** Marker, die eine Auflösung/Einlösung eines losen Endes anzeigen. */
const RESOLUTION_MARKERS: readonly string[] = [
  "aufgelöst", "aufgeklärt", "aufklärt", "gelöst", "löst", "löste", "geklärt",
  "klärt", "klärte", "entdeckt", "entdeckte", "gefunden", "fand", "findet",
  "erklärt", "erklärte", "entpuppt", "entlarvt", "entlarvte", "enthüllt",
  "enthüllte", "offenbart", "offenbarte", "verstanden", "versteht", "verstand",
  "benutzt", "benutzte", "verwendet", "verwendete", "eingesetzt", "zerstört",
  "zerstörte", "verbrannt", "verbrennt", "verbrannte", "verloren", "verlor",
  "verschwunden", "verschwand", "gestohlen", "entwendet", "lüftet", "lüftete",
  "entschlüsselt", "entschlüsselte", "entziffert", "entzifferte", "schoss",
  "schießt", "feuerte", "stach", "sticht", "schlug", "schlägt", "tötete",
  "tötet", "verletzte", "verletzt", "warf", "wirft", "aufgedeckt",
  "aufdeckte", "preisgegeben", "wurde klar", "stellte sich heraus",
  "gibt preis", "setzte ein", "lüftete das geheimnis",
];

const COMPILED_MARKERS: RegExp[] = RESOLUTION_MARKERS.map((m) => buildWordRegex(m, false));

function sentenceHasResolutionMarker(sentenceLower: string): boolean {
  for (const re of COMPILED_MARKERS) if (re.test(sentenceLower)) return true;
  return false;
}

interface InternalLooseEnd {
  type: LooseEndType;
  keyword: string;
  description: string;
  introducedInChapter: number;
  resolved: boolean;
}

/**
 * Spürt lose Enden auf: Hinweise, Requisiten und Waffen, die eingeführt
 * wurden. `resolved` wird gesetzt, wenn der Gegenstand in einem späteren
 * Kapitel erneut aufgegriffen und dort mit einem Auflösungs-Marker versehen
 * wird (oder über den expliziten Marker `[[aufgelöst: <keyword>]]`).
 *
 * Hinweis: Alle gefundenen Gegenstände werden zurückgegeben (aufgelöst und
 * unaufgelöst). Der Alarm sind die Einträge mit `resolved === false`.
 */
export function trackLooseEnds(chapters: ChapterInput[]): LooseEnd[] {
  if (!Array.isArray(chapters)) return [];

  const items = new Map<string, InternalLooseEnd>();
  const chapterTexts: Array<{ number: number; raw: string; sentences: string[] }> = [];

  chapters.forEach((chapter, index) => {
    const number = index + 1;
    const raw = chapter && typeof chapter === "object" ? contentToText(chapter.content) : "";
    const sentences = splitSentences(raw);
    chapterTexts.push({ number, raw, sentences });

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const { keyword, type, re } of COMPILED_KEYWORDS) {
        if (!re.test(lower)) continue;
        const key = `${type}:${keyword}`;
        if (items.has(key)) continue;
        items.set(key, {
          type,
          keyword,
          description: sentence.trim() || keyword,
          introducedInChapter: number,
          resolved: false,
        });
      }
    }
  });

  // Auflösung: nur in einem STRIKT späteren Kapitel (verhindert, dass die
  // Einführungsszene sich selbst „auflöst“).
  for (const item of items.values()) {
    const markerRe = new RegExp(
      `\\[\\[\\s*(?:aufgel(?:ö|oe)st|resolved)\\s*:\\s*${escapeRegExp(item.keyword)}\\s*\\]\\]`,
      "iu",
    );
    for (const chapter of chapterTexts) {
      if (chapter.number <= item.introducedInChapter) continue;
      if (markerRe.test(chapter.raw)) {
        item.resolved = true;
        break;
      }
      let found = false;
      for (const sentence of chapter.sentences) {
        const lower = sentence.toLowerCase();
        if (COMPILED_KEYWORDS.some((k) => k.keyword === item.keyword && k.re.test(lower))) {
          if (sentenceHasResolutionMarker(lower)) {
            found = true;
            break;
          }
        }
      }
      if (found) {
        item.resolved = true;
        break;
      }
    }
  }

  return Array.from(items.values())
    .sort(
      (a, b) =>
        a.introducedInChapter - b.introducedInChapter ||
        cmpStr(a.type, b.type) ||
        cmpStr(a.keyword, b.keyword),
    )
    .map((item) => ({
      type: item.type,
      description: item.description,
      introducedInChapter: item.introducedInChapter,
      resolved: item.resolved,
    }));
}
