// Sprint 14, Agent 6: Bild-Prompt-Kette (NEUE Datei, ADDITIV).
//
// Baut strukturierte Prompts fuer die Bildgenerierung aus Kapitel-Kontext:
// - extractKeyScene: heuristische Schluessel-Szenen-Extraktion (pure).
// - buildImagePrompt: Kapiteltext -> strukturierter Bild-Prompt (pure).
// - buildCaptionPrompt: Bildbeschreibung -> Caption-Anfrage-Prompt (pure).
// - refineImagePrompt: LLM-gestuetzte Verfeinerung mit injizierbarer
//   Complete-Funktion (Dependency Injection, KEIN Provider-Import).
//
// Regeln (analog zu src/services/prompts/templates.ts):
// - KEINE Netzwerk-/Disk-Zugriffe. Alles pure Functions, ausser der
//   injizierbaren Complete-Funktion.
// - Deterministisch: gleiche Eingabe -> gleiche Ausgabe.
// - Nie werfen bei leerem/fehlendem Input: konservative Fallbacks.

/** Injizierbare Vervollstaendigungs-Funktion (z. B. Router-Call des Callers). */
export type ImageCompleteFn = (prompt: string) => Promise<string>;

/** Bekannte Stil-Presets (frei erweiterbar: unbekannte Strings = wörtlich). */
export const IMAGE_STYLE_PRESETS: Record<string, string> = {
  cinematic: "cinematic lighting, film still, rich detail",
  watercolor: "soft watercolor painting, gentle washes, paper texture",
  noir: "black-and-white film noir, deep shadows, high contrast",
  fantasy: "epic fantasy illustration, intricate detail, painterly",
  scifi: "science-fiction concept art, clean lines, atmospheric depth",
};

export const DEFAULT_IMAGE_STYLE = "cinematic";
export const IMAGE_PROMPT_SUFFIX = "detailed, high quality, no text, no watermark";
export const MAX_SCENE_CHARS = 300;

/** Fallback-Szene wenn der Kapiteltext leer/ungenügend ist. */
export const EMPTY_SCENE_FALLBACK = "an empty quiet room, minimal detail";

/** Visuelle Ankerwörter für das Scoring (DE + EN, bewusst klein). */
const VISUAL_KEYWORDS = [
  "licht", "schatten", "nebel", "wald", "burg", "schloss", "meer", "stadt",
  "gesicht", "auge", "feuer", "nacht", "morgen", "sonne", "mond", "strasse",
  "tür", "fenster", "berg", "fluss",
  "light", "shadow", "mist", "forest", "castle", "sea", "city", "face",
  "eye", "fire", "night", "morning", "sun", "moon", "street", "door",
  "window", "mountain", "river", "storm", "snow",
];

function normalize(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?]["'»”]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function scoreSentence(sentence: string): number {
  const lower = sentence.toLowerCase();
  let hits = 0;
  for (const kw of VISUAL_KEYWORDS) {
    if (lower.includes(kw)) hits += 1;
  }
  return hits * 10 + Math.min(sentence.length, 200) / 10;
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Extrahiert die visuell stärkste Szene aus einem Kapiteltext (pure).
 * Heuristik: Satz mit den meisten visuellen Ankerwörtern (+ Länge als
 * Tiebreaker). Fallback: erste 300 Zeichen an Wortgrenze — nie leer.
 */
export function extractKeyScene(chapterText: string): string {
  const clean = normalize(chapterText);
  if (!clean) return EMPTY_SCENE_FALLBACK;
  const sentences = splitSentences(clean);
  if (sentences.length === 0) return truncateAtWord(clean, MAX_SCENE_CHARS);
  let best = sentences[0];
  let bestScore = -Infinity;
  for (const s of sentences) {
    const score = scoreSentence(s);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return truncateAtWord(best, MAX_SCENE_CHARS);
}

/** Löst einen Stil auf: Preset-Key -> Phrase, sonst wörtlich, leer -> Default. */
export function resolveImageStyle(style?: string): string {
  const clean = normalize(style ?? "");
  if (!clean) return IMAGE_STYLE_PRESETS[DEFAULT_IMAGE_STYLE];
  const key = clean.toLowerCase();
  return IMAGE_STYLE_PRESETS[key] ?? clean;
}

/**
 * Baut einen strukturierten Bild-Prompt aus Kapitel-Kontext (pure).
 * Format: "<Szene>, <Stil-Phrase>, <Qualitäts-Suffix>".
 */
export function buildImagePrompt(chapterText: string, style?: string): string {
  const scene = extractKeyScene(chapterText);
  const stylePhrase = resolveImageStyle(style);
  return `${scene}, ${stylePhrase}, ${IMAGE_PROMPT_SUFFIX}`;
}

/**
 * Baut einen Caption-Anfrage-Prompt aus einer Bildbeschreibung (pure).
 * Gibt dem LLM Szene + harte Constraints (ein Satz, max. 140 Zeichen,
 * keine Spoiler über die Szene hinaus).
 */
export function buildCaptionPrompt(imageDescription: string): string {
  const desc = normalize(imageDescription) || "no description provided";
  return [
    "Write a one-sentence image caption (max 140 characters,",
    "no spoilers beyond the scene) for the following image description:",
    desc,
  ].join("\n");
}

/**
 * Verfeinert einen Bild-Prompt per LLM (injizierbare Complete-Funktion).
 * Gibt die getrimmte LLM-Antwort zurück; bei leerer Antwort den
 * Original-Prompt (konservativer Fallback, kein Throw).
 */
export async function refineImagePrompt(
  prompt: string,
  complete: ImageCompleteFn,
): Promise<string> {
  const base = normalize(prompt) || EMPTY_SCENE_FALLBACK;
  const instruction =
    "Improve the following image-generation prompt. Keep it one paragraph, " +
    `concrete and visual, max 300 characters. Return only the prompt:\n${base}`;
  const refined = normalize(await complete(instruction));
  return refined || base;
}
