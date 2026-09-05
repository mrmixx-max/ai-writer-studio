// TranslatorService (Sprint 3, Agent 4): kapitelweise Übersetzung fertiger
// Bücher unter Beibehaltung des Markdown/HTML-Markups.
//
// Pipeline je Kapitel:
//   1. maskMarkup()    — Markup → ⟦M##⟧-Platzhalter (markupGuard.ts)
//   2. LLM-Call        — übersetzt nur den freien Text, Prompt verbietet
//                        Änderungen an Platzhaltern
//   3. restoreMarkup() — Platzhalter aus der Antwort restaurieren; verlorene
//                        Block-Präfixe aus dem Original ergänzen
//   4. markupIntact()  — Struktur-Verifikation (Headings/Bold/Links/Tags)
//
// Der Chat-Call ist über einen generischen Callback abstrahiert
// (LLMChatFn), damit der Service mit jedem Provider (createProvider aus
// @/services/llm) und in Tests mit Fake-Providern läuft.

import { maskMarkup, restoreMarkup, markupIntact } from "./markupGuard";
import { withRetry, isAbortError, classifyError } from "@/services/writing/retry";
import { ProviderError } from "@/types/llm";

// --- Types ---

/** Ein zu übersetzendes Kapitel (aus dem fertigen Buch). */
export interface TranslationChapter {
  id: string;
  title: string;
  /** Markdown/HTML-Inhalt des Kapitels. */
  content: string;
}

/** Ergebnis der Kapitel-Übersetzung. */
export interface TranslationResult {
  chapterId: string;
  translatedTitle: string;
  /** Übersetzter Inhalt — Markup erhalten. */
  content: string;
  /** true, wenn die Markup-Struktur exakt erhalten blieb. */
  markupIntact: boolean;
  /** true, wenn der Provider-Call genutzt wurde (false = Fallback unverändert). */
  usedProvider: boolean;
}

/** Optionen der Übersetzung. */
export interface TranslationOptions {
  /** Zielsprache, z.B. "Englisch", "Spanish". */
  targetLanguage: string;
  /** Quellsprache (Default: "Deutsch"). */
  sourceLanguage?: string;
  /** Zusätzlicher Glossar-Kontext "Begriff = Übersetzung". */
  glossary?: Record<string, string>;
}

/**
 * Generischer Chat-Call: nimmt die Messages entgegen, liefert die
 * vollständige Antwort. In Produktion an provider.chat(...) angebunden,
 * in Tests durch Fake-Provider ersetzt.
 */
export type LLMChatFn = (
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
) => Promise<string>;

// --- Masking-Anteil des Prompts -------------------------------------------------

/**
 * Maskiert Kapitel-Titel + -Inhalt und liefert (maskierterPromptAnhang,
 * maskedContent) für die Restaurierung.
 */
function maskChapter(title: string, content: string): {
  maskedTitle: string;
  maskedContent: string;
  maskedTitleResult: ReturnType<typeof maskMarkup>;
  maskedContentResult: ReturnType<typeof maskMarkup>;
} {
  const maskedTitleResult = maskMarkup(title);
  const maskedContentResult = maskMarkup(content);
  return {
    maskedTitle: maskedTitleResult.masked,
    maskedContent: maskedContentResult.masked,
    maskedTitleResult,
    maskedContentResult,
  };
}

/**
 * Baut den Übersetzungs-Prompt für ein Kapitel (exponiert für Tests):
 * markup-maskiert, mit Markup-Schutzregeln und Glossar.
 */
export function buildChapterPrompt(
  title: string,
  content: string,
  options: TranslationOptions,
): { prompt: string; masked: { title: string; content: string } } {
  const { maskedTitle, maskedContent } = maskChapter(title, content);
  const glossaryBlock =
    options.glossary && Object.keys(options.glossary).length > 0
      ? `\n\nGlossar (verwende EXAKT diese Übersetzungen):\n${Object.entries(options.glossary)
          .map(([k, v]) => `- ${k} = ${v}`)
          .join("\n")}`
      : "";

  const prompt = `Übersetze den folgenden Buchkapitel-Text von ${options.sourceLanguage ?? "Deutsch"} nach ${options.targetLanguage}.

REGELN:
1. Übersetze NUR den freien Text.
2. Token der Form ⟦M##⟧ (z.B. ⟦M01⟧) sind geschützte Markup-Platzhalter — kopiere sie ZEICHENGENAU an ihre Position, füge nichts ein, lösche nichts.
3. Behalte Absatz- und Zeilenstruktur exakt bei.
4. Keine Erklärungen, keine Anmerkungen — nur der übersetzte Text.

KAPITELTITEL:
${maskedTitle}

KAPITELTEXT:
${maskedContent}${glossaryBlock}`;

  return { prompt, masked: { title: maskedTitle, content: maskedContent } };
}

/**
 * Übersetzt ein einzelnes Kapitel mit Markup-Erhaltung.
 *
 * @param chat      Chat-Funktion (Provider-Adapter oder Fake)
 * @param options   Zielsprache etc.
 * @param settings  AppSettings (für den Produktionseinstieg, s. translateBookWithSettings)
 * @param signal    AbortSignal für Abbruch
 */
export async function translateChapter(
  chapter: TranslationChapter,
  chat: LLMChatFn,
  options: TranslationOptions,
  _settings?: unknown,
  signal?: AbortSignal,
): Promise<TranslationResult> {
  if (signal?.aborted) {
    throw new DOMException("Übersetzung abgebrochen.", "AbortError");
  }

  const { prompt, masked } = buildChapterPrompt(chapter.title, chapter.content, options);
  const messages = [
    {
      role: "system" as const,
      content:
        "Du bist ein präziser literarischer Übersetzer. Gib ausschließlich den übersetzten Text zurück — kein Vorwort, keine Anmerkungen.",
    },
    { role: "user" as const, content: prompt },
  ];

  let raw: string;
  try {
    raw = await withRetry(async () => {
      const out = await chat(messages, signal);
      if (signal?.aborted) {
        throw new DOMException("Übersetzung abgebrochen.", "AbortError");
      }
      return out.trim();
    }, signal);
  } catch (err) {
    if (isAbortError(err)) throw err;
    // Netzwerk-/Timeout-/4xx-Fehler: Provider nicht erreichbar → No-op-
    // Übersetzung (Original unverändert), damit die Buch-Pipeline nicht
    // bricht. JSON-/Sonstige Fehler werden als ProviderError geworfen.
    const kind = classifyError(err);
    if (kind === "timeout" || kind === "network" || kind === "http4xx") {
      return {
        chapterId: chapter.id,
        translatedTitle: chapter.title,
        content: chapter.content,
        markupIntact: true,
        usedProvider: false,
      };
    }
    throw new ProviderError(
      `Übersetzung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  // Restaurierung: Platzhalter aus der Antwort + Fallback aus dem Original.
  const restoredContent = restoreMarkup(chapter.content, raw, masked.content);
  const restoredTitle = restoreMarkup(chapter.title, extractTitleFrom(raw, chapter.title), masked.title);

  const intact = markupIntact(chapter.content, restoredContent);

  return {
    chapterId: chapter.id,
    translatedTitle: restoredTitle,
    content: restoredContent,
    markupIntact: intact,
    usedProvider: true,
  };
}

/**
 * Extrahiert den übersetzten Titel aus der Modell-Antwort: Zeile, die dem
 * TITEL-Block entspricht (erste Nicht-leere Zeile des Antworten-Titelteils).
 * Fallback: Original-Titel.
 */
function extractTitleFrom(raw: string, fallback: string): string {
  // Nach KAPITELTITEL-Block suchen; sonst erste Zeile.
  const m = raw.match(/KAPITELTITEL:\s*\n([\s\S]*?)\n\nKAPITELTEXT:/);
  if (m) {
    const line = m[1].trim();
    if (line) return line;
  }
  const firstLine = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine ?? fallback;
}

/**
 * Übersetzt ein ganzes Buch kapitelweise (sequentiell, mit Fortschritt).
 *
 * @param chapters      Kapitel des fertigen Buchs
 * @param chat          Chat-Funktion
 * @param options       Zielsprache etc.
 * @param onProgress    (completed, total) nach jedem Kapitel
 */
export async function translateBook(
  chapters: TranslationChapter[],
  chat: LLMChatFn,
  options: TranslationOptions,
  _settings?: unknown,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];
  let completed = 0;
  for (const chapter of chapters) {
    if (signal?.aborted) break;
    const result = await translateChapter(chapter, chat, options, undefined, signal);
    results.push(result);
    completed += 1;
    onProgress?.(completed, chapters.length);
  }
  return results;
}
