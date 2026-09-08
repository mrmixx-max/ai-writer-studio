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
    "Write a complete story with beginning, middle, end in under {maxWords} words. Twist ending preferred.",
  "micro-story":
    "A single scene, a single moment. Show, don't tell. Under {maxWords} words.",
  kurzgeschichte:
    "Deutsche Kurzgeschichte. Literarischer Stil, {maxWords} Worte. Point of View: {perspective}.",
  snapshot:
    "A frozen moment in time. Sensory details. Under {maxWords} words.",
  fable:
    "A short tale with a moral. Simple language. Under {maxWords} words.",
};

const STYLE_INSTRUCTIONS: Record<ShortproseStyle, string> = {
  literary: "Literary style: rich language, subtext, careful imagery.",
  minimalist: "Minimalist style: short sentences, sparse adjectives, much left unsaid.",
  noir: "Noir style: hard-boiled tone, shadows, moral ambiguity.",
  lyrical: "Lyrical style: musical sentences, rhythm, poetic imagery.",
  experimental: "Experimental style: unusual structure, fragmented or playful form.",
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
  const lines = [
    `Genre: ${request.genre}.`,
    genreInstruction,
    `Style: ${STYLE_INSTRUCTIONS[request.style]}`,
    `Perspective: ${PERSPECTIVE_INSTRUCTIONS[request.perspective]}`,
    `Length: at most ${maxWords} words.`,
    langLine,
    `Seed/Topic: „${request.prompt.trim()}“`,
    "Gib NUR die Geschichte zurueck, ohne Erklaerung, ohne Einleitung.",
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
      { model: request.model, temperature: request.temperature },
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
