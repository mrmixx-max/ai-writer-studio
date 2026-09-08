// Kurzprosa-Engine (Sprint 20, Agent 2).
//
// Generiert kurze Prosaformen (Flash Fiction, Micro-Story, Kurzgeschichte,
// Snapshot, Fable) via LLM. Muster aus `./rewrite` (Sprint 17, Agent 4):
// reine Funktionen, keine Seiteneffekte, einzige LLM-Schnittstelle ist die
// injizierbare `CompleteFn` `(prompt) => Promise<string>` — Tests mocken
// `complete`. Die Produktions-Verdrahtung (`createShortproseComplete`) nutzt
// `completeOnce` aus `@/services/llm` via Lazy-Import — kein neuer
// Netzwerk-Code (Router-Pattern aus `src/services/llm/` bleibt unberuehrt,
// read-only).

/** Genre der Kurzprosa. */
export type ShortproseGenre =
  | "flash-fiction"
  | "micro-story"
  | "kurzgeschichte"
  | "snapshot"
  | "fable";

/** Stil der Kurzprosa. */
export type ShortproseStyle =
  | "literary"
  | "minimalist"
  | "noir"
  | "lyrical"
  | "experimental";

/** Laengenvorgabe der Kurzprosa. */
export type ShortproseLength = "very-short" | "short" | "medium";

/** Erzaehlperspektive. */
export type ShortprosePerspective =
  | "first"
  | "second"
  | "third-limited"
  | "third-omniscient";

/** Eingabe fuer `generateShortprose`. */
export interface ShortproseRequest {
  /** User-Eingabe (Thema/Seed). */
  prompt: string;
  genre: ShortproseGenre;
  style: ShortproseStyle;
  length: ShortproseLength;
  perspective: ShortprosePerspective;
  language: "de" | "en";
  temperature?: number;
  model?: string;
}

/** Ergebnis von `generateShortprose`. */
export interface ShortproseResult {
  text: string;
  genre: ShortproseGenre;
  style: ShortproseStyle;
  wordCount: number;
  characterCount: number;
  /** Geschaetzte Lesezeit in Minuten. */
  estimatedReadingTime: number;
}

/** Injizierbare LLM-Funktion — einzige LLM-Schnittstelle dieses Moduls. */
export type CompleteFn = (prompt: string) => Promise<string>;

/** Gueltige Werte (fuer Validierung, exportiert fuer Tests/UI). */
export const SHORTPROSE_GENRES: readonly ShortproseGenre[] = [
  "flash-fiction",
  "micro-story",
  "kurzgeschichte",
  "snapshot",
  "fable",
];

export const SHORTPROSE_STYLES: readonly ShortproseStyle[] = [
  "literary",
  "minimalist",
  "noir",
  "lyrical",
  "experimental",
];

export const SHORTPROSE_LENGTHS: readonly ShortproseLength[] = [
  "very-short",
  "short",
  "medium",
];

export const SHORTPROSE_PERSPECTIVES: readonly ShortprosePerspective[] = [
  "first",
  "second",
  "third-limited",
  "third-omniscient",
];

/**
 * Laenge-Mapping: Zielwortzahl (Obergrenze) pro Laengenvorgabe.
 * - 'very-short': 300-500 Woerter
 * - 'short': 800-1500 Woerter
 * - 'medium': 1500-3000 Woerter
 */
export const SHORTPROSE_MAX_WORDS: Record<ShortproseLength, number> = {
  "very-short": 500,
  "short": 1500,
  medium: 3000,
};

/** Lesegeschwindigkeit (Woerter pro Minute) fuer die Lesezeit-Schaetzung. */
export const WORDS_PER_MINUTE = 200;

const GENRE_TEMPLATES: Record<ShortproseGenre, string> = {
  "flash-fiction":
    "Schreibe eine kurze Geschichte mit Anfang, Mitte und Ende. Maximal {maxWords} Worte. Keine Erklärung, nur die Geschichte.",
  "micro-story":
    "Schreibe eine einzige Szene, ein einziger Moment. Maximal {maxWords} Worte. Zeige, nicht erzähle.",
  kurzgeschichte:
    "Deutsche Kurzgeschichte, {maxWords} Worte. Point of View: {perspective}.",
  snapshot:
    "Ein eingefrorener Moment. Sinnliche Details. Maximal {maxWords} Worte.",
  fable:
    "Eine kurze Fabel mit Moral. Einfache Sprache. Maximal {maxWords} Worte.",
};

const STYLE_INSTRUCTIONS: Record<ShortproseStyle, string> = {
  literary: "Literarischer Stil: reiche Sprache, Subtext, sorgfältige Bilder.",
  minimalist: "Minimalistischer Stil: kurze Sätze, wenige Adjektive.",
  noir: "Noir-Stil: harter Ton, Schatten, moralische Ambiguität.",
  lyrical: "Lyrischer Stil: musikalische Sätze, Rhythmus, poetische Bilder.",
  experimental: "Experimenteller Stil: ungewöhnliche Struktur.",
};

const PERSPECTIVE_INSTRUCTIONS: Record<ShortprosePerspective, string> = {
  first: "First person (Ich-Perspektive / I-narrator).",
  second: "Second person (Du-Perspektive / you-narrator).",
  "third-limited":
    "Third person limited (personaler Erzaehler / limited third-person narrator).",
  "third-omniscient":
    "Third person omniscient (auktorialer Erzaehler / omniscient narrator).",
};

/**
 * Zaehlt Woerter (DE + EN): split an beliebigem Whitespace, leere
 * Tokens werden verworfen. Satzzeichen bleiben an Tokens haften und
 * beeinflussen die Zaehlung nicht.
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter((t) => t.length > 0).length;
}

/** Schaetzt die Lesezeit in Minuten (~200 Woerter/Minute, aufgerundet). */
export function estimateReadingTime(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Baut den Genre/Style/Length-spezifischen Prompt.
 * Exportiert, damit Tests/UI den Prompt pruefen koennen, ohne ein LLM zu rufen.
 */
export function buildShortprosePrompt(request: ShortproseRequest): string {
  if (!SHORTPROSE_GENRES.includes(request.genre)) {
    throw new Error(
      `Unbekanntes Genre: ${String(request.genre)}. Erlaubt: ${SHORTPROSE_GENRES.join(", ")}.`,
    );
  }
  if (!SHORTPROSE_STYLES.includes(request.style)) {
    throw new Error(
      `Unbekannter Stil: ${String(request.style)}. Erlaubt: ${SHORTPROSE_STYLES.join(", ")}.`,
    );
  }
  if (!SHORTPROSE_LENGTHS.includes(request.length)) {
    throw new Error(
      `Unbekannte Laenge: ${String(request.length)}. Erlaubt: ${SHORTPROSE_LENGTHS.join(", ")}.`,
    );
  }
  const maxWords = SHORTPROSE_MAX_WORDS[request.length];
  const genreInstruction = GENRE_TEMPLATES[request.genre]
    .replace("{maxWords}", String(maxWords))
    .replace("{perspective}", request.perspective);
  const langLine =
    request.language === "de"
      ? "Schreibe auf Deutsch."
      : "Write in English.";
  // Sprint 24: Vereinfachtes Prompt-Design — weniger Tokens, striktere
  // Vorgaben. LFM2-24B degenerierte sonst zu endlosen Reim-Wiederhol-Ketten
  // ("marg marg marg..."). Explizites "Kein Reimen, keine Wiederholungen"
  // stoppt das Modell.
  const lines = [
    `${genreInstruction}`,
    `${STYLE_INSTRUCTIONS[request.style]}`,
    `${PERSPECTIVE_INSTRUCTIONS[request.perspective]}`,
    `Maximal ${maxWords} Worte.`,
    langLine,
    `Thema: „${request.prompt.trim()}“`,
    "",
    "WICHTIG:",
    "- Kein Reimen, keine Wortwiederholungen, keine abschweifenden Ketten.",
    "- Gib NUR die Geschichte zurück, keine Einleitung, keine Erklärung.",
    "- Schreibe in klarem, direktem Stil.",
  ];
  return lines.join("\n");
}

/** Optionale Aufruf-Optionen fuer `generateShortprose`. */
export interface GenerateShortproseOptions {
  /** Injizierbare LLM-Funktion (Tests). Default: Provider aus Settings. */
  complete?: CompleteFn;
  /** Abbruch-Signal (vom Panel-Abbrechen-Button). */
  signal?: AbortSignal;
}

/**
 * Generiert Kurzprosa via LLM.
 *
 * - Leerer Seed -> wirft (nichts zu generieren).
 * - Leere/Whitespace-Antwort des LLM -> wirft (Fehlverhalten, kein Fallback).
 * - `complete` wirft -> Fehler wird mit Kontext weitergegeben.
 */
/**
 * Erkennt degenerierten Output: Wiederholungen von Woertern (z.B. "marg marg
 * marg") oder von Phrasen. LFM2-24B erzeugt solche Ketten bei offenen
 * Prompts. Gibt `true` zurueck, wenn der Output wiederholungsfrei ist.
 * - `maxWordRepeat`: Max. Vorkommen desselben Wortes (case-insensitive) pro
 *   100 Worte. Standard 3 (z.B. "marg" x20 -> verworfen).
 * - `maxPhraseRepeat`: Max. Vorkommen derselben Phrase (>=3 Worte). Standard 2.
 */
export function isOutputDegenerate(
  text: string,
  maxWordRepeat = 3,
  maxPhraseRepeat = 2,
): boolean {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;

  // Wort-Wiederholung checken
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    const cleaned = w.replace(/[^a-zäöüß0-9]/g, "");
    if (cleaned.length === 0) continue;
    const n = (wordCounts.get(cleaned) ?? 0) + 1;
    wordCounts.set(cleaned, n);
    // Erlaubte Wiederholungen skalieren mit Textlaenge (pro 100 Worte)
    const allowed = Math.max(maxWordRepeat, Math.ceil(words.length / 100) * maxWordRepeat);
    if (n > allowed) return true;
  }

  // Phrasen-Wiederholung checken (3-Wort-Phrasen)
  const phraseCounts = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    const n = (phraseCounts.get(phrase) ?? 0) + 1;
    phraseCounts.set(phrase, n);
    if (n > maxPhraseRepeat) return true;
  }

  return false;
}

export async function generateShortprose(
  request: ShortproseRequest,
  options?: GenerateShortproseOptions,
): Promise<ShortproseResult> {
  if (!request.prompt || request.prompt.trim().length === 0) {
    throw new Error("generateShortprose: Der Seed/Prompt ist leer.");
  }
  const prompt = buildShortprosePrompt(request);
  const completeFn =
    options?.complete ??
    createShortproseComplete(
      { model: request.model, temperature: request.temperature ?? 0.3 },
      options?.signal,
    );

  let raw: string;
  try {
    raw = await completeFn(prompt);
  } catch (err) {
    throw new Error(
      `generateShortprose: LLM-Aufruf fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "generateShortprose: Das LLM lieferte keine brauchbare Geschichte (leere Antwort).",
    );
  }
  const text = raw.trim();

  // Sprint 24: Degeneraten Output abweisen (LFM2-24B erzeugt sonst
  // "marg marg marg..."-Ketten). Fehler mit Erlaeuterung -> User kann
  // Prompt/Temperatur anpassen.
  if (isOutputDegenerate(text)) {
    throw new Error(
      "generateShortprose: Output enthaelt Wortwiederholungen (Modell-Degeneration). Bitte Temperatur senken oder Prompt praezisieren.",
    );
  }

  const wordCount = countWords(text);
  return {
    text,
    genre: request.genre,
    style: request.style,
    wordCount,
    characterCount: text.length,
    estimatedReadingTime: estimateReadingTime(wordCount),
  };
}

/**
 * Baut eine `CompleteFn` auf dem bestehenden LLM-Service (`completeOnce` aus
 * `@/services/llm` + Settings). `model`/`temperature` aus dem Request
 * ueberschreiben die Settings, `signal` bricht den Aufruf ab. Lazy-Importe:
 * Dieses Modul bleibt ohne Aufruf dieser Funktion netzwerk- und
 * seitenffektfrei. Es entsteht KEIN neuer Netzwerk-Code — nur Verdrahtung
 * (Muster aus `./rewrite`).
 */
export function createShortproseComplete(
  overrides?: { model?: string; temperature?: number },
  signal?: AbortSignal,
): CompleteFn {
  return async (prompt: string): Promise<string> => {
    const { loadSettings } = await import("@/services/settings");
    const { completeOnce } = await import("@/services/llm");
    const settings = loadSettings();
    const effective = {
      ...settings,
      ...(overrides?.model ? { model: overrides.model } : {}),
      ...(overrides?.temperature !== undefined
        ? { temperature: overrides.temperature }
        : {}),
    };
    return completeOnce(effective, prompt, undefined, signal);
  };
}
