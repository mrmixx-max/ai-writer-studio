// Neuro-Pacing & Plutchik-Resonanzkurve (WP 28.2).
//
// Werkzeuge, um die emotionale „Resonanz" einer Buchstruktur zu prüfen:
//
//   1. analyzeEmotionVector   — bewertet eine Szene auf den 8 emotionalen
//                               Grundachsen nach Plutchik (0–100 je Achse).
//   2. detectFatigue          — warnt vor Leser-Ermüdung durch Pausenmangel
//                               (lange Ketten emotional aufgeladener Kapitel)
//                               und durch emotionale Monotonie.
//   3. generateResonanceCurve — erzeugt eine numerische Kurve (ein Wert je
//                               Kapitel) samt erkannten Hoch- und Tiefpunkten,
//                               um harmonische Rhythmen zu prüfen.
//
// Design-Regeln (analog zu subplotWeaver / tensionCurve / emotionArcEngine):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Arrays
//     bzw. einen Null-Vektor statt zu werfen.
//
// Kapitelnummern sind 1-basiert. Kapitel ohne gültige `chapterNumber` (< 1)
// werden defensiv verworfen. Bei doppelter Kapitelnummer gewinnt das erste
// Vorkommen (deterministisch, Reihenfolge der Eingabe).
//
// Wortabgleich: case-insensitiv und umlautbewusst. Ein Token zählt für eine
// Achse, wenn es einem Achsen-Keyword exakt entspricht oder ein Keyword mit
// mindestens `MIN_STEM_LENGTH` Zeichen als Teilstring enthält (fängt deutsche
// Komposita/Beugungen wie „Angstzustand" oder „ängstlich" ein). Pro Achse wird
// jedes Token nur einmal gezählt (kein Doppelzählen durch Stamm-Varianten).

/** Die acht emotionalen Grundachsen nach Plutchik (fest sortiert). */
export const PLUTCHIK_AXES = [
  "fear",
  "anger",
  "joy",
  "sadness",
  "trust",
  "disgust",
  "surprise",
  "anticipation",
] as const;

/** Typ einer emotionalen Grundachse. */
export type PlutchikAxis = (typeof PLUTCHIK_AXES)[number];

/** Bewertung einer Szene auf den acht Plutchik-Achsen (je 0–100). */
export interface PlutchikVector {
  fear: number;
  anger: number;
  joy: number;
  sadness: number;
  trust: number;
  disgust: number;
  surprise: number;
  anticipation: number;
}

/** Minimaler Kapitel-Input des Neuro-Pacing-Service. */
export interface ChapterInput {
  /** Stabile Kapitel-ID. */
  id: string;
  /** Kapiteltitel. */
  title: string;
  /** Kapiteltext (wird lokal analysiert). */
  content: string;
  /** Kapitelnummer (1-basiert). */
  chapterNumber: number;
}

/** Schweregrad einer Ermüdungswarnung. */
export type FatigueSeverity = "low" | "medium" | "high";

/** Warnung vor Leser-Ermüdung in einem Kapitel. */
export interface FatigueWarning {
  /** Kapitelnummer, an der die Warnung verankert ist (1-basiert). */
  chapterNumber: number;
  /** Menschenlesbare Meldung. */
  message: string;
  /** Schweregrad. */
  severity: FatigueSeverity;
}

/** Numerische Resonanzkurve über die Kapitel eines Buchs. */
export interface ResonanceCurve {
  /** Emotionale Amplitude je Kapitel (0–100), aufsteigend nach Kapitelnummer. */
  points: number[];
  /** Indizes lokaler Maxima in `points` (emotionale Höhepunkte). */
  peaks: number[];
  /** Indizes lokaler Minima in `points` (emotionale Pausen). */
  valleys: number[];
}

/** Treffer-Score je Achse und distinktem Keyword-Token (0–100, saturierend). */
export const AXIS_HIT_SCORE = 25;

/** Ab dieser Kapitel-Amplitude (0–100) gilt ein Kapitel als „aufgeladen". */
export const PAUSE_THRESHOLD = 25;

/** Mehr als so viele aufeinanderfolgende Kapitel ohne echte Pause → Ermüdung. */
export const MAX_SUSTAINED_CHAPTERS = 3;

/** Ab so vielen aufeinanderfolgenden Kapiteln mit gleicher Dominanzachse → Monotonie. */
export const MONOTONY_THRESHOLD = 4;

/** Ab dieser Keyword-Länge greift der Teilstring-Abgleich (Komposita/Beugung). */
const MIN_STEM_LENGTH = 4;

/** Lokales, deterministisches Keyword-Lexikon je Plutchik-Achse (Deutsch). */
const LEXICON: Record<PlutchikAxis, readonly string[]> = {
  fear: [
    "angst",
    "ängst",
    "furcht",
    "fürcht",
    "schreck",
    "panik",
    "grauen",
    "zittern",
    "zitter",
    "entsetz",
    "bedroh",
    "gefahr",
    "unheimlich",
    "albtraum",
    "alptraum",
    "terror",
    "horror",
  ],
  anger: [
    "wut",
    "wütend",
    "wutausbruch",
    "wutentbrannt",
    "zorn",
    "zornig",
    "groll",
    "hass",
    "hasserfüllt",
    "raserei",
    "rasend",
    "empör",
    "toben",
    "tobend",
    "brüll",
    "aggression",
    "aggressiv",
    "rache",
    "feindselig",
  ],
  joy: [
    "freude",
    "freud",
    "glück",
    "glücks",
    "froh",
    "fröhlich",
    "lachen",
    "lächel",
    "jubel",
    "strahl",
    "heiter",
    "selig",
    "beglück",
    "feier",
    "vergnügt",
    "wonne",
    "entzück",
  ],
  sadness: [
    "trauer",
    "traur",
    "traurig",
    "weinen",
    "weinend",
    "schmerz",
    "verlust",
    "kummer",
    "leiden",
    "leidvoll",
    "leidend",
    "schwermut",
    "gram",
    "träne",
    "melanchol",
    "verzweif",
    "einsam",
    "verloren",
    "schluchz",
  ],
  trust: [
    "vertrauen",
    "vertrau",
    "zutrauen",
    "verlässlich",
    "geborgen",
    "treue",
    "treu",
    "loyal",
    "sicherheit",
    "zugewandt",
    "vertraut",
    "akzeptanz",
  ],
  disgust: [
    "ekel",
    "eklig",
    "ekelhaft",
    "abstoß",
    "widerlich",
    "abscheu",
    "abscheulich",
    "widerwärt",
    "veracht",
    "angewidert",
    "übelkeit",
    "übel",
    "faulig",
    "grässlich",
  ],
  surprise: [
    "überraschung",
    "überrascht",
    "überrasch",
    "erstaunen",
    "erstaunt",
    "erstaun",
    "plötzlich",
    "unerwartet",
    "schock",
    "verblüfft",
    "fassungslos",
    "unerhört",
    "verwirrt",
    "verwirr",
    "jäh",
  ],
  anticipation: [
    "erwartung",
    "erwarten",
    "erwart",
    "ahnen",
    "ahnung",
    "vorahnung",
    "voraussehen",
    "gespannt",
    "neugier",
    "neugierig",
    "planen",
    "plant",
    "lauern",
    "kündigt",
    "kommend",
    "zukunft",
    "hoffnung",
    "hoffen",
    "hoffnungsvoll",
    "zuversicht",
    "vorhersage",
  ],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Locale-unabhängiger String-Vergleich (deterministisch). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Frischer Null-Vektor (nie geteilt, nie mutiert). */
function emptyVector(): PlutchikVector {
  return {
    fear: 0,
    anger: 0,
    joy: 0,
    sadness: 0,
    trust: 0,
    disgust: 0,
    surprise: 0,
    anticipation: 0,
  };
}

/** Text in umlautbewusste Kleinbuchstaben-Tokens zerlegen. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((token) => token.length > 0);
}

/** Passt ein Token auf ein Keyword (exakt oder Teilstring ab Mindestlänge)? */
function tokenMatches(token: string, keyword: string): boolean {
  if (token === keyword) return true;
  return keyword.length >= MIN_STEM_LENGTH && token.includes(keyword);
}

/** Größter Achsenwert eines Vektors (0–100). */
function vectorMax(vector: PlutchikVector): number {
  let max = 0;
  for (const axis of PLUTCHIK_AXES) {
    if (vector[axis] > max) max = vector[axis];
  }
  return max;
}

/** Achse mit dem größten Wert; Gleichstand → früheste Achse in PLUTCHIK_AXES. */
function dominantAxis(vector: PlutchikVector): PlutchikAxis | null {
  let best: PlutchikAxis | null = null;
  let bestValue = 0;
  for (const axis of PLUTCHIK_AXES) {
    if (vector[axis] > bestValue) {
      bestValue = vector[axis];
      best = axis;
    }
  }
  return best;
}

/** Zahl defensiv nach endlicher Ganzzahl ≥ 1 normalisieren (sonst null). */
function toChapterNumber(raw: unknown): number | null {
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.trunc(num);
}

/** Normalisiertes, valides Kapitel (alle Felder garantiert vorhanden). */
interface NormalizedChapter {
  id: string;
  title: string;
  content: string;
  chapterNumber: number;
}

/**
 * Kapitel defensiv normalisieren: ungültige Einträge und Kapitelnummern < 1
 * verwerfen, doppelte Kapitelnummern (erstes Vorkommen gewinnt) entfernen und
 * aufsteigend nach Kapitelnummer sortieren.
 */
function normalizeChapters(chapters: unknown): NormalizedChapter[] {
  if (!Array.isArray(chapters)) return [];
  const seen = new Set<number>();
  const out: NormalizedChapter[] = [];
  for (const entry of chapters) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const chapterNumber = toChapterNumber(raw.chapterNumber);
    if (chapterNumber === null || seen.has(chapterNumber)) continue;
    seen.add(chapterNumber);
    out.push({
      id: typeof raw.id === "string" ? raw.id : `ch${chapterNumber}`,
      title: typeof raw.title === "string" ? raw.title : `Kapitel ${chapterNumber}`,
      content: typeof raw.content === "string" ? raw.content : "",
      chapterNumber,
    });
  }
  return out.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/** Analysiertes Kapitel: Nummer, Amplitude und Dominanzachse. */
interface ChapterAnalysis {
  chapterNumber: number;
  intensity: number;
  dominant: PlutchikAxis | null;
}

/** Kapitel auf Amplitude (max-Achse) und Dominanzachse reduzieren. */
function analyzeChapters(chapters: NormalizedChapter[]): ChapterAnalysis[] {
  return chapters.map((chapter) => {
    const vector = analyzeEmotionVector(chapter.content);
    return {
      chapterNumber: chapter.chapterNumber,
      intensity: vectorMax(vector),
      dominant: dominantAxis(vector),
    };
  });
}

/** Schweregrad aus Lauflänge (nur für Läufe ≥ 4 aufgerufen). */
function severityForRun(length: number): FatigueSeverity {
  if (length >= 6) return "high";
  if (length === 5) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// 1) Emotion-Vektor (Plutchik)
// ---------------------------------------------------------------------------

/**
 * Bewertet eine Szene auf den acht emotionalen Grundachsen nach Plutchik.
 *
 * Jede Achse erhält einen Wert von 0–100: pro distinktem Keyword-Token, das
 * auf die Achse passt, `AXIS_HIT_SCORE` Punkte, saturierend bei 100. Leere,
 * nicht-string oder tokenlose Eingaben liefern einen Null-Vektor (kein Throw).
 */
export function analyzeEmotionVector(scene: string): PlutchikVector {
  const vector = emptyVector();
  if (typeof scene !== "string") return vector;
  const tokenSet = new Set(tokenize(scene));
  if (tokenSet.size === 0) return vector;

  for (const axis of PLUTCHIK_AXES) {
    const keywords = LEXICON[axis];
    let hits = 0;
    for (const token of tokenSet) {
      if (keywords.some((keyword) => tokenMatches(token, keyword))) hits += 1;
    }
    vector[axis] = Math.min(100, hits * AXIS_HIT_SCORE);
  }
  return vector;
}

// ---------------------------------------------------------------------------
// 2) Ermüdungswarnungen
// ---------------------------------------------------------------------------

/**
 * Warnt vor Leser-Ermüdung durch Pausenmangel und emotionale Monotonie.
 *
 * Pausenmangel: Ein Kapitel ist eine „Pause", wenn seine Amplitude
 * (max. Achsenwert) ≤ `PAUSE_THRESHOLD` ist. Mehr als
 * `MAX_SUSTAINED_CHAPTERS` aufeinanderfolgende Kapitel ohne echte Pause
 * erzeugen eine Warnung (verankert am ersten Kapitel des Laufs).
 *
 * Monotonie: `MONOTONY_THRESHOLD` oder mehr aufeinanderfolgende Kapitel mit
 * derselben (nicht-leeren) Dominanzachse erzeugen eine Warnung.
 *
 * Ergebnis ist nach Kapitelnummer, dann nach Meldung sortiert — deterministisch.
 * Fehlende/ungültige Eingaben liefern ein leeres Array (kein Throw).
 */
export function detectFatigue(chapters: ChapterInput[]): FatigueWarning[] {
  const normalized = normalizeChapters(chapters);
  if (normalized.length === 0) return [];

  const analysis = analyzeChapters(normalized);
  const warnings: FatigueWarning[] = [];
  collectPauseWarnings(analysis, warnings);
  collectMonotonyWarnings(analysis, warnings);

  return warnings.sort(
    (a, b) => a.chapterNumber - b.chapterNumber || cmpStr(a.message, b.message),
  );
}

/** Läufe ohne echte Pause auswerten und Warnungen anhängen. */
function collectPauseWarnings(analysis: ChapterAnalysis[], out: FatigueWarning[]): void {
  let runStart = -1;

  const flush = (endIndex: number): void => {
    if (runStart < 0) return;
    const length = endIndex - runStart + 1;
    if (length > MAX_SUSTAINED_CHAPTERS) {
      const start = analysis[runStart].chapterNumber;
      const end = analysis[endIndex].chapterNumber;
      out.push({
        chapterNumber: start,
        severity: severityForRun(length),
        message:
          `Pausenmangel: ${length} aufeinanderfolgende Kapitel (Kap. ${start}–${end}) ` +
          `ohne echte emotionale Pause (Schwelle: ${MAX_SUSTAINED_CHAPTERS}). ` +
          `Eine ruhige Passage einstreuen, sonst ermüdet die Leserschaft.`,
      });
    }
    runStart = -1;
  };

  for (let i = 0; i < analysis.length; i++) {
    if (analysis[i].intensity <= PAUSE_THRESHOLD) {
      flush(i - 1);
    } else if (runStart < 0) {
      runStart = i;
    }
  }
  flush(analysis.length - 1);
}

/** Läufe gleicher Dominanzachse auswerten und Warnungen anhängen. */
function collectMonotonyWarnings(analysis: ChapterAnalysis[], out: FatigueWarning[]): void {
  let runStart = -1;
  let runAxis: PlutchikAxis | null = null;

  const flush = (endIndex: number): void => {
    if (runStart < 0 || runAxis === null) return;
    const length = endIndex - runStart + 1;
    if (length >= MONOTONY_THRESHOLD) {
      const start = analysis[runStart].chapterNumber;
      const end = analysis[endIndex].chapterNumber;
      out.push({
        chapterNumber: start,
        severity: severityForRun(length),
        message:
          `Emotionale Monotonie: ${length} Kapitel (Kap. ${start}–${end}) mit ` +
          `dominierender Achse „${runAxis}". Die Leserschaft ermüdet — ` +
          `emotionale Abwechslung einbauen.`,
      });
    }
    runStart = -1;
    runAxis = null;
  };

  for (let i = 0; i < analysis.length; i++) {
    const axis = analysis[i].dominant;
    if (axis === null) {
      flush(i - 1);
      continue;
    }
    if (runStart < 0) {
      runStart = i;
      runAxis = axis;
    } else if (axis !== runAxis) {
      flush(i - 1);
      runStart = i;
      runAxis = axis;
    }
  }
  flush(analysis.length - 1);
}

// ---------------------------------------------------------------------------
// 3) Resonanzkurve
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine numerische Resonanzkurve über die Kapitel.
 *
 * `points[i]` ist die Amplitude (max. Achsenwert, 0–100) des i-ten Kapitels in
 * aufsteigender Kapitelreihenfolge. `peaks`/`valleys` enthalten die Indizes
 * lokaler Maxima/Minima (nur innere Punkte, plateaubewusst; bei Plateaus zählt
 * der erste Index). Weniger als drei Kapitel ergeben eine leere Extremwert-
 * Liste. Fehlende/ungültige Eingaben liefern eine leere Kurve (kein Throw).
 */
export function generateResonanceCurve(chapters: ChapterInput[]): ResonanceCurve {
  const normalized = normalizeChapters(chapters);
  if (normalized.length === 0) return { points: [], peaks: [], valleys: [] };

  const points = analyzeChapters(normalized).map((entry) => entry.intensity);
  const { peaks, valleys } = findExtrema(points);
  return { points, peaks, valleys };
}

/** Lokale Maxima/Minima (innere Punkte, plateaubewusst, erster Plateau-Index). */
function findExtrema(points: number[]): { peaks: number[]; valleys: number[] } {
  const peaks: number[] = [];
  const valleys: number[] = [];
  const n = points.length;
  if (n < 3) return { peaks, valleys };

  for (let i = 1; i < n - 1; i++) {
    // Bei Plateaus nur den ersten Index des Laufs betrachten.
    if (points[i] === points[i - 1]) continue;

    let left = i - 1;
    while (left >= 0 && points[left] === points[i]) left -= 1;
    let right = i + 1;
    while (right < n && points[right] === points[i]) right += 1;
    if (left < 0 || right >= n) continue;

    if (points[i] > points[left] && points[i] > points[right]) peaks.push(i);
    else if (points[i] < points[left] && points[i] < points[right]) valleys.push(i);
  }
  return { peaks, valleys };
}
