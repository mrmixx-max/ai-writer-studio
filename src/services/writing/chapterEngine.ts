// KapitelEngine: chunkweise KI-Generierung mit Wortzahl-Steuerung.
import { OllamaProvider } from "@/services/llm/ollama";
import { countWords, computeWordStats } from "./chapterPlan";
import { withRetry, isAbortError, createTimeoutController } from "./retry";
import {
  availablePromptTokens,
  fitToBudget,
  renderSections,
  truncateToTokens,
  SECTION_PRIORITY,
  type ContextSection,
} from "@/services/llm/contextBudget";
import type { Chapter } from "@/types/project";

export interface BookContext {
  title: string;
  genre: string;
  targetAudience: string;
  language: string;
  premise?: string;       // Exposé/Prämisse
  synopsis?: string;      // Kurzzusammenfassung
  concept?: string;       // Ganzes Buchkonzept (Generierprompt)
  /**
   * Vorgerenderter Welt-/Fakten-Kontext (World-Bible, Lore, Fakten-Base).
   * Wird gegen das Kontextfenster budgetiert und bei Platzmangel gekürzt.
   */
  extraContext?: string;
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
  /** A3: Timeout pro Chunk-Request in ms (Default 120000 = 120s). */
  timeoutMs: number;
}

const DEFAULT_CONFIG: GenerationConfig = {
  model: "llama3.2:latest",
  baseUrl: "http://127.0.0.1:11434",
  maxTokensPerChunk: 4096,
  chunkTargetWords: 800,
  timeoutMs: 120000,
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
 * Fasst einen Chunk zu einer knappen Kontext-Zeile zusammen.
 * Kürzt an der Satzgrenze, damit der Rolling Context nicht mitten im Wort endet.
 */
function summarizeChunk(text: string, maxTokens: number): string {
  return truncateToTokens(text.replace(/\s+/g, " ").trim(), maxTokens);
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
  /** Zusätzlicher Kontext (Fakten-Base, Welt-Kontext) — wird budgetiert. */
  extraContext = "",
): Promise<ChunkResult> {
  const provider = new OllamaProvider(config.baseUrl);

  // Kontext zusammenstellen: Zusammenfassungen vorheriger Chunks (nicht der
  // Volltext). Die Zahl der berücksichtigten Chunks und ihre Länge richten
  // sich nach dem Kontextfenster des Modells — vorher waren es pauschal die
  // letzten 200 Zeichen je Chunk, unabhängig vom Modell.
  const budget = availablePromptTokens(config.model);
  const previousSummary = previousChunks.length > 0
    ? previousChunks
        .map((c, i) => `Teil ${i + 1}: ${summarizeChunk(c.text, 90)}`)
        .join("\n")
    : "";

  // Bausteine mit Kürzungs-Priorität: Das Konzept ist entbehrlicher als der
  // unmittelbare Rolling Context, die Recherche/Fakten am wenigsten.
  const sections: ContextSection[] = [];
  if (book.premise) sections.push({ name: "premise", text: `Buch-Prämisse: ${book.premise}`, priority: SECTION_PRIORITY.concept });
  if (book.concept?.trim()) sections.push({ name: "concept", text: `Buchkonzept (bindend — Figuren, Welt, Erzählstimme und Spannungsbogen einhalten):\n${book.concept.trim()}`, priority: SECTION_PRIORITY.concept });
  if (extraContext.trim()) sections.push({ name: "world", text: extraContext.trim(), priority: SECTION_PRIORITY.world });
  if (previousSummary) sections.push({ name: "previousChapters", text: `Bisheriger Kontext:\n${previousSummary}`, priority: SECTION_PRIORITY.previousChapters });

  const fitted = fitToBudget(sections, config.model, budget);

  const prompt = `Schreibe einen Abschnitt für Kapitel "${chapter.title}" von "${book.title}".
Genre: ${book.genre} | Zielgruppe: ${book.targetAudience} | Sprache: ${book.language}

${chapter.synopsis ? `Kapitel-Synopsis: ${chapter.synopsis}\n` : ""}${chapter.purpose ? `Kapitel-Funktion: ${chapter.purpose}\n` : ""}
${renderSections(fitted.sections)}

Aufgabe für diesen Abschnitt: ${chunk.purpose}
Ziel: ca. ${chunk.targetWords} Wörter.

Schreibe NUR den Kapiteltext. Keine Überschriften. Keine Erklärungen.
WICHTIG: Nutze Absätze (doppelter Zeilenumbruch zwischen Textblöcken).`;

  // A3: Timeout via kombiniertem Signal — bricht den laufenden Request ab.
  const { controller, clear } = createTimeoutController(config.timeoutMs, signal);
  const chunks: string[] = [];
  try {
    for await (const text of provider.chat(
      [{ role: "user", content: prompt }],
      {
        model: config.model,
        maxTokens: config.maxTokensPerChunk,
        temperature: 0.7,
        timeoutMs: config.timeoutMs,
      },
      controller.signal,
    )) {
      chunks.push(text);
    }
  } finally {
    clear();
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
        // A3: Abbruch → Status auf "planned" zurücksetzen (kein Ghost-State).
        return {
          chapter: { ...chapter, content, currentWordCount: countWords(content), status: "planned" },
          chunks,
          totalWordCount: countWords(content),
          completed: false,
          error: "Abgebrochen",
        };
      }

      const chunkResult = await withRetry(
        () => generateChunk(chunkPlans[i], book, chapter, chunks, cfg, signal, book.extraContext ?? ""),
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
    // A3: Abbruch während der Generierung → Kapitel-Status sauber auf
    // "planned" zurücksetzen (kein Ghost-State "generating").
    if (isAbortError(error)) {
      return {
        chapter: {
          ...chapter,
          content,
          currentWordCount: countWords(content),
          status: "planned",
          updatedAt: Date.now(),
        },
        chunks,
        totalWordCount: countWords(content),
        completed: false,
        error: "Abgebrochen",
      };
    }
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

${book.extraContext?.trim() ? `${truncateToTokens(book.extraContext.trim(), Math.floor(availablePromptTokens(cfg.model) * 0.4))}\n\n` : ""}Bisheriger Inhalt:
${truncateToTokens(chapter.content, 400)}

Schreibe NUR den ergänzenden Text (der an den bestehenden Inhalt angehängt wird). Keine Überschriften.`;

  const chunks: string[] = [];
  // A3: Timeout via kombiniertem Signal.
  const { controller, clear } = createTimeoutController(cfg.timeoutMs, signal);
  try {
    for await (const text of provider.chat(
      [{ role: "user", content: prompt }],
      { model: cfg.model, maxTokens: cfg.maxTokensPerChunk, temperature: 0.7, timeoutMs: cfg.timeoutMs },
      controller.signal,
    )) {
      chunks.push(text);
    }
  } finally {
    clear();
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
