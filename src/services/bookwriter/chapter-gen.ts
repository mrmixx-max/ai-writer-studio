// Bookwriter: Kapitelgenerierung mit Streaming und Kontrolle.

import { loadSettings } from "@/services/settings";
import { createProvider, buildMessages } from "@/services/llm";
import { createChapter, updateChapter } from "@/services/project";
import { markdownToTipTap } from "@/services/editor/markdown";
import { promptWriteChapter, promptSummarizeChapter, systemForGenre, getStyle } from "./prompts";

/**
 * Sprint 7 (Agent 3): Löst den tone-Wert eines Briefings als Stil-Preset auf.
 * Die GUI setzt tone auf eine Preset-ID (Dropdown) — ist es eine bekannte
 * Preset-ID, liefert getStyle() das Preset und systemForGenre injiziert das
 * Stil-Overlay. Freier Text (Legacy-Briefings) oder leer → kein Overlay,
 * der tone-Wert wirkt unverändert als "Tonalität:"-Zeile weiter.
 */
function styleFromBriefing(briefing: BookBriefing): string | null {
  return getStyle(briefing.tone) ? briefing.tone : null;
}
import { saveArtifact } from "./state";
import { searchDocuments } from "./documents";
import { buildContextBlock } from "./contextManager";
import type { BookBriefing, BookOutline, OutlineChapter } from "@/types/bookwriter";

/** Ein generiertes Kapitel. */
export interface GeneratedChapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  summary: string;
}

/** Status der Kapitelgenerierung. */
export interface GenerationStatus {
  total: number;
  completed: number;
  current: number | null;
  currentTitle: string | null;
  status: "idle" | "running" | "paused" | "done" | "error";
  error: string | null;
}

/** Zählt Wörter. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/**
 * Generiert ein einzelnes Kapitel mit Streaming.
 *
 * @param onToken wird für jedes Token-Delta aufgerufen — für die
 *   Live-Anzeige in der Oberfläche.
 * @param signal AbortSignal zum Unterbrechen der Generierung.
 */
export async function generateChapter(
  briefing: BookBriefing,
  chapter: OutlineChapter,
  previousSummaries: string[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
  projectId?: string,
): Promise<string> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, styleFromBriefing(briefing));

  // RAG: Relevante Dokument-Passagen suchen.
  let ragNotes: string[] = [];
  if (projectId) {
    const query = `${chapter.title} ${chapter.goal} ${chapter.conflict} ${chapter.outcome}`;
    const hits = searchDocuments(projectId, query, 3);
    ragNotes = hits.map((h) => `[Quelle: ${h.docTitle}]\n${h.text}`);
    // Sprint 3 (Long-Term Memory): Fakten-Base als verbindlichen Kontext
    // voranstellen — Charaktere, Orte, Zeitlinien bleiben über alle Kapitel
    // hinweg konsistent. Leere Base → keine Änderung am Prompt.
    const memoryContext = buildContextBlock(projectId);
    if (memoryContext) ragNotes = [memoryContext, ...ragNotes];
  }

  const userPrompt = promptWriteChapter(briefing, chapter, {
    previousSummaries,
    researchNotes: ragNotes,
  });

  const messages = buildMessages(userPrompt, settings, [{ role: "system", content: system }]);

  let content = "";
  for await (const token of provider.chat(messages, {
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  })) {
    if (signal?.aborted) {
      throw new Error("Generierung abgebrochen.");
    }
    content += token;
    onToken(token);
  }

  return content;
}

/**
 * Generiert alle Kapitel sequentiell.
 *
 * Fortsetzbar: Bereits generierte Kapitel werden aus dem übergebenen
 * `chapters`-Array gelesen und nicht erneut generiert.
 */
export async function generateManuskriptStreaming(
  runId: string,
  briefing: BookBriefing,
  outline: BookOutline,
  existingChapters: GeneratedChapter[],
  onProgress: (status: GenerationStatus) => void,
  onToken: (token: string) => void,
  signal?: AbortSignal,
  projectId?: string,
): Promise<GeneratedChapter[]> {
  const settings = loadSettings();
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, styleFromBriefing(briefing));
  const results: GeneratedChapter[] = [...existingChapters];
  const summaries: string[] = existingChapters.map((c) => c.summary);

  for (let i = existingChapters.length; i < outline.chapters.length; i++) {
    if (signal?.aborted) {
      onProgress({
        total: outline.chapters.length,
        completed: results.length,
        current: null,
        currentTitle: null,
        status: "paused",
        error: null,
      });
      break;
    }

    const ch = outline.chapters[i];

    onProgress({
      total: outline.chapters.length,
      completed: results.length,
      current: i,
      currentTitle: ch.title,
      status: "running",
      error: null,
    });

    try {
      // Kapitel generieren.
      const content = await generateChapter(
        briefing,
        ch,
        summaries,
        onToken,
        signal,
        projectId,
      );

      // Kapitel in der DB speichern.
      let chapterId: string;
      if (results[i]?.id) {
        // Regenerierung: Bestehendes Kapitel überschreiben.
        chapterId = results[i].id;
        await updateChapter(chapterId, markdownToTipTap(content));
      } else {
        // Neues Kapitel.
        const created = await createChapter(runId, ch.title, markdownToTipTap(content));
        chapterId = created.id;
      }

      // Zusammenfassung für Kontext.
      const summary = await generateSummary(settings, system, ch.title, content);

      const generated: GeneratedChapter = {
        id: chapterId,
        title: ch.title,
        content,
        wordCount: countWords(content),
        summary,
      };

      results[i] = generated;
      summaries.push(summary);

      // Zwischenspeichern — verhindert Datenverlust bei Unterbrechung.
      await saveArtifact(runId, "manuskript", "chapters", results);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      onProgress({
        total: outline.chapters.length,
        completed: results.length,
        current: i,
        currentTitle: ch.title,
        status: "error",
        error: msg,
      });
      throw e;
    }
  }

  if (!signal?.aborted) {
    onProgress({
      total: outline.chapters.length,
      completed: results.length,
      current: null,
      currentTitle: null,
      status: "done",
      error: null,
    });
  }

  return results;
}

/** Generiert eine Kapitelzusammenfassung. */
async function generateSummary(
  settings: ReturnType<typeof loadSettings>,
  system: string,
  title: string,
  content: string,
): Promise<string> {
  const provider = createProvider(settings);
  const prompt = promptSummarizeChapter(title, content);
  const messages = buildMessages(prompt, settings, [{ role: "system", content: system }]);

  let summary = "";
  for await (const token of provider.chat(messages, {
    model: settings.model,
    temperature: 0.3,
    maxTokens: 500,
  })) {
    summary += token;
  }
  return summary.trim();
}

/**
 * Regeneriert ein einzelnes Kapitel.
 *
 * Nützlich, wenn der Autor mit einem Kapitel unzufrieden ist, ohne
 * den gesamten Lauf neu zu starten.
 */
export async function regenerateChapter(
  briefing: BookBriefing,
  outline: BookOutline,
  chapterIndex: number,
  existingChapters: GeneratedChapter[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<GeneratedChapter> {
  const ch = outline.chapters[chapterIndex];
  if (!ch) throw new Error(`Kapitel ${chapterIndex + 1} nicht gefunden.`);

  // Zusammenfassungen der Vorkapitel als Kontext.
  const previousSummaries = existingChapters
    .slice(0, chapterIndex)
    .map((c) => c.summary);

  const content = await generateChapter(
    briefing,
    ch,
    previousSummaries,
    onToken,
    signal,
  );

  const chapterId = existingChapters[chapterIndex]?.id ?? "";
  if (chapterId) {
    await updateChapter(chapterId, JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
    }));
  }

  const settings = loadSettings();
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, styleFromBriefing(briefing));
  const summary = await generateSummary(settings, system, ch.title, content);

  return {
    id: chapterId,
    title: ch.title,
    content,
    wordCount: countWords(content),
    summary,
  };
}
