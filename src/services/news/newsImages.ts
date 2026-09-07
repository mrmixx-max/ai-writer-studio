// Artikel-Illustrationen fuer den Zeitungsgenerator (Sprint 16, Agent 3).
//
// Duenne Schicht ueber Sprint-14-Service src/services/images/imageGen.ts
// (read-only, Interface wird wiederverwendet, nicht kopiert):
// - generateArticleImage(articlePrompt, style?): Artikel-Illustration,
//   gibt { dataUrl, prompt } zurueck (prompt = tatsächlich genutzter Prompt).
// - generateHeadlineImage(headline): Social-Media-Karte (1200x630-Format).
//
// Grundsaetze (Ollama-/imageGen-Konvention):
// - Additiv, keine UI-Abhaengigkeit. Reine Wrapper, ASCII-only (shell-safe).
// - Fehler aus imageGen (ImageGenError, u.a. kind="offline") werden
//   durchgereicht, nicht geschluckt.
// - Optionen (Backend, fetchFn, Modell) sind injizierbar — Tests mocken
//   generateImage per vi.mock, kein Netz, keine GPU noetig.
import {
  ImageGenError,
  generateImage,
  type ImageBackend,
  type ImageFetchFn,
} from "../images/imageGen";

/** Bildstil einer Artikel-Illustration. Default: "editorial". */
export type NewsImageStyle = "editorial" | "foto" | "illustration" | "minimal";

/** Injizierbare Optionen (Backend-Wahl, Fetch-Mock, Modell, Bildgroesse). */
export interface NewsImageOptions {
  /** Backend-Wahl (Default "ollama", ohne GPU sofort nutzbar). */
  backend?: ImageBackend;
  /** Injizierbarer fetch (Default globalThis.fetch). */
  fetchFn?: ImageFetchFn;
  /** Modellname (optional, wird an generateImage durchgereicht). */
  model?: string;
  /** Bildbreite in px (nur sd-webui; Headline-Default 1200). */
  width?: number;
  /** Bildhoehe in px (nur sd-webui; Headline-Default 630). */
  height?: number;
  /** Request-Timeout in ms (optional, wird durchgereicht). */
  timeoutMs?: number;
}

/** Ergebnis von generateArticleImage(). */
export interface ArticleImageResult {
  /** Fertige Bild-URL ("data:image/...;base64,..."), direkt in <img> nutzbar. */
  dataUrl: string;
  /** Tatsaechlich an generateImage uebergebener Prompt (nach Stil-Anreicherung). */
  prompt: string;
}

/** Ergebnis von generateHeadlineImage(). */
export interface HeadlineImageResult {
  /** Fertige Bild-URL ("data:image/...;base64,..."), direkt in <img> nutzbar. */
  dataUrl: string;
}

/** Default-Stil fuer Artikel-Illustrationen. */
export const DEFAULT_NEWS_IMAGE_STYLE: NewsImageStyle = "editorial";

/** Social-Card-Format (1200x630) fuer generateHeadlineImage (sd-webui). */
export const HEADLINE_CARD_WIDTH = 1200;
export const HEADLINE_CARD_HEIGHT = 630;

/** Stil-Suffixe (englisch, damit SD-/Ollama-Modelle sie robust verstehen). */
const STYLE_SUFFIX: Record<NewsImageStyle, string> = {
  editorial: "editorial newspaper illustration, sober, high contrast, print style",
  foto: "realistic press photograph, natural light, documentary style",
  illustration: "stylized illustration, flat shapes, muted colors",
  minimal: "minimalist vector illustration, few elements, generous whitespace",
};

/** Stil-Label fuer den deutschsprachigen Prompt-Kopf. */
const STYLE_LABEL: Record<NewsImageStyle, string> = {
  editorial: "Redaktionell",
  foto: "Pressefoto",
  illustration: "Illustration",
  minimal: "Minimal",
};

function normalizeStyle(style: NewsImageStyle | undefined): NewsImageStyle {
  if (style === "foto" || style === "illustration" || style === "minimal") return style;
  return DEFAULT_NEWS_IMAGE_STYLE;
}

/**
 * Baut den vollstaendigen Bild-Prompt fuer eine Artikel-Illustration.
 * Exportiert, damit Prompt-Bau ohne Netz testbar ist.
 */
export function buildArticleImagePrompt(articlePrompt: string, style?: NewsImageStyle): string {
  const clean = (articlePrompt ?? "").trim();
  const s = normalizeStyle(style);
  return (
    `Zeitungsillustration (${STYLE_LABEL[s]}): ${clean} ` +
    `[${STYLE_SUFFIX[s]}; no text in image, no watermark, no logo]`
  );
}

/**
 * Baut den vollstaendigen Bild-Prompt fuer eine Social-Media-Karte.
 * Exportiert, damit Prompt-Bau ohne Netz testbar ist.
 */
export function buildHeadlineImagePrompt(headline: string): string {
  const clean = (headline ?? "").trim();
  return (
    `Social-Media-Karte (1200x630) zur Schlagzeile: "${clean}". ` +
    `Fetter Blickfang, einfaches zentrales Motiv, Freiflaeche fuer Headline-Text ` +
    `[bold eye-catcher, single central motif, copy space, no text in image, no watermark, no logo]`
  );
}

function requireNonEmpty(value: string, message: string): string {
  const clean = (value ?? "").trim();
  if (!clean) {
    throw new ImageGenError("bad-request", message);
  }
  return clean;
}

/**
 * Erzeugt eine Artikel-Illustration zum Artikel-Prompt.
 * Ruft generateImage() aus imageGen.ts (Sprint 14) mit angereichertem
 * Prompt auf; Backend-Fehler (z.B. kind="offline") werden durchgereicht.
 */
export async function generateArticleImage(
  articlePrompt: string,
  style?: NewsImageStyle,
  options: NewsImageOptions = {},
): Promise<ArticleImageResult> {
  const clean = requireNonEmpty(
    articlePrompt,
    "Kein Artikel-Prompt angegeben — bitte eine Bildbeschreibung zum Artikel eingeben.",
  );
  const prompt = buildArticleImagePrompt(clean, style);
  const res = await generateImage(prompt, {
    backend: options.backend,
    fetchFn: options.fetchFn,
    model: options.model,
    width: options.width,
    height: options.height,
    timeoutMs: options.timeoutMs,
  });
  return { dataUrl: res.dataUrl, prompt };
}

/**
 * Erzeugt ein Karten-Bild zur Schlagzeile (Social-Media-Format 1200x630).
 * Breite/Hoehe sind nur fuer sd-webui relevant; per Optionen ueberschreibbar.
 */
export async function generateHeadlineImage(
  headline: string,
  options: NewsImageOptions = {},
): Promise<HeadlineImageResult> {
  const clean = requireNonEmpty(
    headline,
    "Keine Schlagzeile angegeben — bitte eine Headline fuer die Social-Media-Karte eingeben.",
  );
  const prompt = buildHeadlineImagePrompt(clean);
  const res = await generateImage(prompt, {
    backend: options.backend,
    fetchFn: options.fetchFn,
    model: options.model,
    width: options.width ?? HEADLINE_CARD_WIDTH,
    height: options.height ?? HEADLINE_CARD_HEIGHT,
    timeoutMs: options.timeoutMs,
  });
  return { dataUrl: res.dataUrl };
}
