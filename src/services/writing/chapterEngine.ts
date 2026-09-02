// KapitelEngine: chunkweise KI-Generierung mit Wortzahl-Steuerung.
import { OllamaProvider } from "@/services/llm/ollama";
import { countWords, computeWordStats } from "./chapterPlan";
import type { Chapter } from "@/types/project";

export interface BookContext {
  title: string;
  genre: string;
  targetAudience: string;
  language: string;
  premise?: string;       // Exposé/Prämisse
  synopsis?: string;      // Kurzzusammenfassung
}

export interface ChunkPlan {
  chunkIndex: number;
  purpose: string;        // Was soll in diesem Chunk passieren
  targetWords: number;    // Zielwortzahl für diesen Chunk
  context: string;        // Kontext für den Prompt
}

export interface GenerationConfig {
  model: string;
  baseUrl: string;
  maxTokensPerChunk: number;
  chunkTargetWords: number;  // Zielwortzahl pro Chunk (600-1200)
}

const DEFAULT_CONFIG: GenerationConfig = {
  model: "llama3.2:latest",
  baseUrl: "http://127.0.0.1:11434",
  maxTokensPerChunk: 4096,
  chunkTargetWords: 800,
};

export interface ChunkResult {
  text: string;
  wordCount: number;
  chunkIndex: number;
}

export interface GenerationResult {
  chapter: Chapter;
  chunks: ChunkResult[];
  totalWordCount: number;
  completed: boolean;
  error?: string;
}

/**
 * Plant die Chunks für ein Kapitel basierend auf Zielwortzahl.
 */
export function planChunks(
  chapter: Chapter,
  existingContent = "",
  config: Partial<GenerationConfig> = {},
): ChunkPlan[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const remainingWords = chapter.targetWordCount - countWords(existingContent);
  if (remainingWords <= 0) return [];

  const chunks: ChunkPlan[] = [];
  let wordsGenerated = countWords(existingContent);
  let chunkIndex = 0;

  while (wordsGenerated < chapter.targetWordCount) {
    const wordsLeft = chapter.targetWordCount - wordsGenerated;
    const targetWords = Math.min(cfg.chunkTargetWords, wordsLeft);

    chunks.push({
      chunkIndex,
      purpose: chunkIndex === 0
        ? (chapter.purpose || "Einleitung des Kapitels")
        : `Fortsetzung (Teil ${chunkIndex + 1})`,
      targetWords,
      context: "", // wird später gefüllt
    });

    wordsGenerated += targetWords;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Generiert einen einzelnen Chunk via Ollama.
 */
async function generateChunk(
  chunk: ChunkPlan,
  book: BookContext,
  chapter: Chapter,
  previousChunks: ChunkResult[],
  config: GenerationConfig,
  signal?: AbortSignal,
): Promise<ChunkResult> {
  const provider = new OllamaProvider(config.baseUrl);

  // Kontext zusammenstellen: Zusammenfassung vorheriger Chunks (nicht vollständig)
  const previousSummary = previousChunks.length > 0
    ? previousChunks.map((c, i) => `Teil ${i + 1}: ${c.text.slice(0, 200)}...`).join("\n")
    : "";

  const prompt = `Schreibe einen Abschnitt für Kapitel "${chapter.title}" von "${book.title}".
Genre: ${book.genre} | Zielgruppe: ${book.targetAudience} | Sprache: ${book.language}

${book.premise ? `Buch-Prämisse: ${book.premise}\n` : ""}
${chapter.synopsis ? `Kapitel-Synopsis: ${chapter.synopsis}\n` : ""}
${chapter.purpose ? `Kapitel-Funktion: ${chapter.purpose}\n` : ""}

Aufgabe für diesen Abschnitt: ${chunk.purpose}
Ziel: ca. ${chunk.targetWords} Wörter.

${previousSummary ? `Bisheriger Kontext (letzte Zusammenfassung):\n${previousSummary}\n` : ""}

Schreibe NUR den Kapiteltext. Keine Überschriften. Keine Erklärungen.
WICHTIG: Nutze Absätze (doppelter Zeilenumbruch zwischen Textblöcken).`;

  const chunks: string[] = [];
  for await (const text of provider.chat(
    [{ role: "user", content: prompt }],
    {
      model: config.model,
      maxTokens: config.maxTokensPerChunk,
      temperature: 0.7,
      timeoutMs: 180000,
    },
    signal,
  )) {
    chunks.push(text);
  }

  const fullText = chunks.join("");
  return {
    text: fullText,
    wordCount: countWords(fullText),
    chunkIndex: chunk.chunkIndex,
  };
}

/**
 * Generiert ein Kapitel chunkweise mit Wortzahl-Steuerung.
 * Unterstützt Abbruch und Fortsetzung.
 */
export async function generateChapterChunked(
  chapter: Chapter,
  book: BookContext,
  config: Partial<GenerationConfig> = {},
  onProgress?: (chunk: number, total: number, wordsGenerated: number) => void,
  signal?: AbortSignal,
  existingContent = "",
): Promise<GenerationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const chunks: ChunkResult[] = [];
  let content = existingContent;

  // Chunk-Planung
  const chunkPlans = planChunks(chapter, content, cfg);

  if (chunkPlans.length === 0) {
    return {
      chapter,
      chunks: [],
      totalWordCount: countWords(content),
      completed: true,
    };
  }

  try {
    for (let i = 0; i < chunkPlans.length; i++) {
      if (signal?.aborted) {
        return {
          chapter: { ...chapter, content, currentWordCount: countWords(content), status: "draft" },
          chunks,
          totalWordCount: countWords(content),
          completed: false,
          error: "Abgebrochen",
        };
      }

      const chunkResult = await generateChunk(
        chunkPlans[i],
        book,
        chapter,
        chunks,
        cfg,
        signal,
      );

      chunks.push(chunkResult);
      content += (content ? "\n\n" : "") + chunkResult.text;

      if (onProgress) {
        onProgress(i + 1, chunkPlans.length, countWords(content));
      }
    }

    // Wortzahl-Prüfung und ggf. Ergänzung
    const finalWordCount = countWords(content);
    const stats = computeWordStats({ ...chapter, currentWordCount: finalWordCount });

    let finalStatus: Chapter["status"] = "draft";
    if (stats.isUnderMinimum) {
      finalStatus = "needs_revision";
    } else if (stats.isOverMaximum) {
      finalStatus = "needs_revision";
    }

    return {
      chapter: {
        ...chapter,
        content,
        currentWordCount: finalWordCount,
        status: finalStatus,
        generatedContent: content,
        updatedAt: Date.now(),
      },
      chunks,
      totalWordCount: finalWordCount,
      completed: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      chapter: {
        ...chapter,
        content,
        currentWordCount: countWords(content),
        status: "needs_revision",
        lastError: message,
        updatedAt: Date.now(),
      },
      chunks,
      totalWordCount: countWords(content),
      completed: false,
      error: message,
    };
  }
}

/**
 * Generiert eine gezielte Ergänzung wenn das Kapitel zu kurz ist.
 */
export async function expandChapter(
  chapter: Chapter,
  book: BookContext,
  config: Partial<GenerationConfig> = {},
  signal?: AbortSignal,
): Promise<GenerationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const provider = new OllamaProvider(cfg.baseUrl);
  const currentWords = countWords(chapter.content);
  const wordsNeeded = chapter.minimumWordCount - currentWords;

  if (wordsNeeded <= 0) {
    return {
      chapter,
      chunks: [],
      totalWordCount: currentWords,
      completed: true,
    };
  }

  const prompt = `Das folgende Kapitel "${chapter.title}" von "${book.title}" ist zu kurz (${currentWords} Wörter, Ziel: ${chapter.minimumWordCount}).

Ergänze den Inhalt um ca. ${wordsNeeded} Wörter. Füge sinnvolle inhaltliche Ergänzungen hinzu — kein Fülltext.

Genre: ${book.genre} | Sprache: ${book.language}

Bisheriger Inhalt:
${chapter.content.slice(-500)}

Schreibe NUR den ergänzenden Text (der an den bestehenden Inhalt angehängt wird). Keine Überschriften.`;

  const chunks: string[] = [];
  for await (const text of provider.chat(
    [{ role: "user", content: prompt }],
    { model: cfg.model, maxTokens: cfg.maxTokensPerChunk, temperature: 0.7, timeoutMs: 180000 },
    signal,
  )) {
    chunks.push(text);
  }

  const expansion = chunks.join("");
  const newContent = chapter.content + "\n\n" + expansion;
  const newWordCount = countWords(newContent);

  return {
    chapter: {
      ...chapter,
      content: newContent,
      currentWordCount: newWordCount,
      status: "draft",
      generatedContent: newContent,
      updatedAt: Date.now(),
    },
    chunks: [{ text: expansion, wordCount: countWords(expansion), chunkIndex: 999 }],
    totalWordCount: newWordCount,
    completed: true,
  };
}
