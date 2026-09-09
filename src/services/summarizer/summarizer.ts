// Text-Zusammenfassung via LLM (Sprint 25, Agent 3): Länge + Stil,
// Kapitel-/Projekt-Zusammenfassung aus dem Store, Versionsvergleich.
//
// - summarize(): LLM-Zusammenfassung via Provider (Rohtext), mit lokaler
//   Extraktions-Heuristik als Offline-Fallback (Muster: feedback.ts localReview).
// - Der LLM-Client ist injizierbar (opts.client) — so bleibt die Funktion
//   ohne Provider-Mock testbar (Muster: BilingualPanel `chat`-Prop).
// - summarizeChapter()/summarizeProject(): lesen aus dem Project-Store
//   (injizierbar via opts.getChapterText/getProjectText für Tests).
// - compareVersions(): LLM-Vergleich zweier Textstände, mit lokalem
//   Kennzahlen-Fallback (Wörter, hinzugefügte/entfernte Sätze).

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";
import { useProjectStore } from "@/store/projectStore";

export type SummaryLength = "short" | "medium" | "long";
export type SummaryStyle = "bullet" | "paragraph" | "key-points";
export type SummaryLanguage = "de" | "en";

export interface SummaryRequest {
  text: string;
  length: SummaryLength;
  style?: SummaryStyle;
  language: SummaryLanguage;
  /** Optionaler Fokus-Schwerpunkt (Sprint 25, Agent 3): fliesst in den Prompt ein. */
  focus?: string;
}

export interface SummaryResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
}

/** Injizierbarer LLM-Client: Prompt rein, Rohtext raus. Default nutzt den Provider. */
export type SummaryClient = (prompt: string, signal?: AbortSignal) => Promise<string>;

export interface SummaryOptions {
  client?: SummaryClient;
  signal?: AbortSignal;
  /** Überschreibt die Store-Anbindung (Tests). */
  getChapterText?: (chapterId: string) => string | null;
  /** Überschreibt die Store-Anbindung (Tests). */
  getProjectText?: (projectId: string) => string | null;
}

export interface ChapterSummaryRequest {
  length?: SummaryLength;
  style?: SummaryStyle;
  language?: SummaryLanguage;
}

/** Ziel-Satzanzahl je Länge für Prompt + lokalen Fallback. */
const LENGTH_SENTENCES: Record<SummaryLength, number> = {
  short: 3,
  medium: 8,
  long: 20,
};

const LENGTH_HINT: Record<SummaryLanguage, Record<SummaryLength, string>> = {
  de: {
    short: "Fasse den Text in höchstens 3 Sätzen zusammen (das Allerwichtigste).",
    medium: "Fasse den Text in ca. 100–150 Wörtern zusammen (ein Absatz, alle Kernpunkte).",
    long: "Fasse den Text ausführlich in ca. 250–300 Wörtern zusammen (mehrere Absätze, Handlung, Figuren, Kernthemen).",
  },
  en: {
    short: "Summarize the text in at most 3 sentences (only the essentials).",
    medium: "Summarize the text in about 100–150 words (one paragraph, all key points).",
    long: "Summarize the text in detail in about 250–300 words (multiple paragraphs: plot, characters, core themes).",
  },
};

const STYLE_HINT: Record<SummaryLanguage, Record<SummaryStyle, string>> = {
  de: {
    bullet: "Format: Stichpunktliste (jeder Punkt beginnt mit „- “).",
    paragraph: "Format: Fließtext in zusammenhängenden Sätzen (keine Aufzählung).",
    "key-points": "Format: nummerierte Kernaussagen („1. …“, „2. …“, …).",
  },
  en: {
    bullet: "Format: bullet list (each item starts with “- ”).",
    paragraph: "Format: flowing paragraph text (no bullet list).",
    "key-points": "Format: numbered key points (“1. …”, “2. …”, …).",
  },
};

/** Baut den Zusammenfassungs-Prompt für das LLM. */
export function buildSummaryPrompt(req: SummaryRequest): string {
  const langInstruction =
    req.language === "de"
      ? "Antworte auf Deutsch."
      : "Answer in English.";
  const style = req.style ?? "paragraph";
  const focusLine =
    req.focus && req.focus.trim()
      ? req.language === "de"
        ? `Schwerpunkt: ${req.focus.trim()}\n`
        : `Focus: ${req.focus.trim()}\n`
      : "";
  return (
    `Du bist eine präzise Lektorats-KI. Fasse den folgenden Text zusammen.\n` +
    `${LENGTH_HINT[req.language][req.length]}\n` +
    `${STYLE_HINT[req.language][style]}\n` +
    focusLine +
    `${langInstruction}\n\nTEXT:\n${req.text}\n\nNur die Zusammenfassung, sonst nichts.`
  );
}

function wordsOf(s: string): string[] {
  return s.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Extrahiert lesbaren Text aus Kapitelinhalten. Kapitel können als
 * Tiptap-JSON (z. B. "{\"type\":\"doc\",...}") vorliegen — dann werden die
 * Textknoten rekursiv eingesammelt. Sonst wird der Rohtext übernommen.
 */
export function extractPlainText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return content;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const parts: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node !== "object" || node === null) return;
      const rec = node as Record<string, unknown>;
      if (typeof rec.text === "string") parts.push(rec.text);
      if (Array.isArray(rec.content)) rec.content.forEach(walk);
    };
    walk(parsed);
    return parts.join(" ").replace(/\s{2,}/g, " ").trim();
  } catch {
    return content;
  }
}

function formatSummary(sentences: string[], style: SummaryStyle): string {
  if (style === "bullet") return sentences.map((s) => `- ${s}`).join("\n");
  if (style === "key-points") return sentences.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return sentences.join(" ");
}

/** Lokale, LLM-freie Extraktions-Heuristik (Offline-Fallback): erste N Sätze. */
export function localSummarize(req: SummaryRequest): SummaryResult {
  const plain = extractPlainText(req.text).trim();
  const originalLength = wordsOf(plain).length;
  if (!plain) {
    return { summary: "", originalLength: 0, summaryLength: 0, compressionRatio: 0 };
  }
  const sentences = sentencesOf(plain);
  const picked = sentences.slice(0, LENGTH_SENTENCES[req.length]);
  const summary = formatSummary(picked.length > 0 ? picked : [plain], req.style);
  const summaryLength = wordsOf(summary).length;
  return {
    summary,
    originalLength,
    summaryLength,
    compressionRatio: originalLength > 0 ? round3(summaryLength / originalLength) : 0,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Default-Client über den konfigurierten LLM-Provider (streamt, sammelt, gibt Rohtext zurück). */
async function providerClient(prompt: string, signal?: AbortSignal): Promise<string> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) throw new Error("Provider nicht erreichbar");
  let raw = "";
  for await (
    const token of provider.chat(
      [
        { role: "system" as const, content: "Du bist eine präzise Lektorats-KI. Antworte nur mit der verlangten Zusammenfassung." },
        { role: "user" as const, content: prompt },
      ],
      { model: settings.model, temperature: 0.3, maxTokens: settings.maxTokens },
      signal,
    )
  ) {
    raw += token;
  }
  return raw;
}

/**
 * Fasst einen freien Text zusammen. Nutzt opts.client (Tests/Panel-Mock) oder
 * den konfigurierten Provider; bei Fehlern greift die lokale Heuristik
 * (außer bei explizitem Abort — der wird weitergereicht).
 */
export async function summarize(request: SummaryRequest, opts?: SummaryOptions): Promise<SummaryResult> {
  const plain = extractPlainText(request.text).trim();
  const originalLength = wordsOf(plain).length;
  if (!plain) {
    return { summary: "", originalLength: 0, summaryLength: 0, compressionRatio: 0 };
  }
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildSummaryPrompt(request), opts?.signal);
    const summary = raw.trim();
    if (!summary) return localSummarize(request);
    const summaryLength = wordsOf(summary).length;
    return {
      summary,
      originalLength,
      summaryLength,
      compressionRatio: originalLength > 0 ? round3(summaryLength / originalLength) : 0,
    };
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || opts?.signal?.aborted) throw e;
    return localSummarize(request);
  }
}

function defaultChapterText(chapterId: string): string | null {
  const { chapters, activeChapterId, activeContent } = useProjectStore.getState();
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  // Aktives Kapitel: frischester Stand liegt in activeContent.
  if (chapter.id === activeChapterId && activeContent) return extractPlainText(activeContent);
  return extractPlainText(chapter.content);
}

function defaultProjectText(projectId: string): string | null {
  const { chapters } = useProjectStore.getState();
  const mine = chapters.filter((c) => c.projectId === projectId);
  if (mine.length === 0) return null;
  const joined = mine
    .map((c) => extractPlainText(c.content).trim())
    .filter(Boolean)
    .join("\n\n");
  return joined || null;
}

/**
 * Fasst ein Kapitel aus dem Projekt-Store zusammen.
 * Wirft, wenn das Kapitel nicht gefunden wurde oder keinen Text enthält.
 */
export async function summarizeChapter(
  chapterId: string,
  partial: ChapterSummaryRequest = {},
  opts?: SummaryOptions,
): Promise<SummaryResult> {
  const text = opts?.getChapterText?.(chapterId) ?? defaultChapterText(chapterId);
  if (text === null || !text.trim()) {
    throw new Error(`Kapitel nicht gefunden oder ohne Text: ${chapterId}`);
  }
  return summarize(
    {
      text,
      length: partial.length ?? "medium",
      style: partial.style ?? "paragraph",
      language: partial.language ?? "de",
    },
    opts,
  );
}

/**
 * Fasst ein ganzes Projekt (alle Kapitelinhalte) zusammen.
 * Wirft, wenn das Projekt keine Kapitel mit Text enthält.
 */
export async function summarizeProject(
  projectId: string,
  partial: ChapterSummaryRequest = {},
  opts?: SummaryOptions,
): Promise<SummaryResult> {
  const text = opts?.getProjectText?.(projectId) ?? defaultProjectText(projectId);
  if (text === null || !text.trim()) {
    throw new Error(`Projekt nicht gefunden oder ohne Text: ${projectId}`);
  }
  return summarize(
    {
      text,
      length: partial.length ?? "long",
      style: partial.style ?? "paragraph",
      language: partial.language ?? "de",
    },
    opts,
  );
}

/** Baut den Vergleichs-Prompt für das LLM (Original vs. Überarbeitung). */
export function buildComparePrompt(original: string, revised: string, language: SummaryLanguage = "de"): string {
  const head = language === "de"
    ? "Du bist eine präzise Lektorats-KI. Vergleiche ORIGINAL und ÜBERARBEITUNG: Was wurde geändert, gestrichen, hinzugefügt? Antworte auf Deutsch, kurz und strukturiert."
    : "You are a precise editorial AI. Compare ORIGINAL and REVISION: what was changed, removed, added? Answer in English, briefly and structured.";
  return `${head}\n\nORIGINAL:\n${original}\n\nÜBERARBEITUNG / REVISION:\n${revised}\n\nNur der Vergleich, sonst nichts.`;
}

/** Lokaler Kennzahlen-Vergleich (Offline-Fallback für compareVersions). */
export function localCompare(original: string, revised: string): string {
  const oWords = wordsOf(original).length;
  const rWords = wordsOf(revised).length;
  const oSent = sentencesOf(original);
  const rSent = sentencesOf(revised);
  const oSet = new Set(oSent);
  const rSet = new Set(rSent);
  const added = rSent.filter((s) => !oSet.has(s));
  const removed = oSent.filter((s) => !rSet.has(s));
  const delta = rWords - oWords;
  const lines = [
    `Wörter: ${oWords} → ${rWords} (${delta >= 0 ? "+" : ""}${delta})`,
    `Sätze: ${oSent.length} → ${rSent.length}`,
    added.length > 0 ? `Hinzugefügt (${added.length}): ${added.slice(0, 3).join(" ")}` : "Hinzugefügt: —",
    removed.length > 0 ? `Entfernt (${removed.length}): ${removed.slice(0, 3).join(" ")}` : "Entfernt: —",
  ];
  return lines.join("\n");
}

/**
 * Vergleicht zwei Textstände (z. B. Original vs. Überarbeitung).
 * Nutzt opts.client oder den Provider; bei Fehlern greift der lokale
 * Kennzahlen-Vergleich (außer bei explizitem Abort).
 */
export async function compareVersions(
  original: string,
  revised: string,
  opts?: { client?: SummaryClient; signal?: AbortSignal; language?: SummaryLanguage },
): Promise<string> {
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildComparePrompt(original, revised, opts?.language ?? "de"), opts?.signal);
    const text = raw.trim();
    return text || localCompare(original, revised);
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || opts?.signal?.aborted) throw e;
    return localCompare(original, revised);
  }
}
