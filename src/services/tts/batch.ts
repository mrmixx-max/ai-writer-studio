// Batch-TTS: ganzes Buch (mehrere Kapitel) sequenziell vorlesen.
// Teilt lange Kapitel in Provider-taugliche Chunks und synthetisiert
// Kapitel für Kapitel mit Fortschritts-Callback und Abbruchmöglichkeit.
import type { TTSProvider, TTSConfig, TTSProviderId } from "./tts";
import { createTTSProvider } from "./tts";

export interface BatchTTSChapter {
  id: string;
  title: string;
  content: string;
}

export interface BatchTTSResultItem {
  chapterId: string;
  chunkIndex: number;
  audio: ArrayBuffer;
}

export interface BatchTTSProgress {
  chapterIndex: number;
  totalChapters: number;
  chapterTitle: string;
  chunkIndex: number;
  totalChunks: number;
  phase: "chunking" | "synthesizing" | "done" | "cancelled" | "error";
  message?: string;
}

/** Harte Limits pro Provider-Request (Zeichen). */
const CHUNK_LIMITS: Record<TTSProviderId, number> = {
  "openai-tts": 4000,
  "edge-tts": 3000,
  piper: 1900,
};

const SENTENCE_SPLIT = /(?<=[.!?…])\s+/;

/**
 * Teilt einen Kapiteltext in Chunks <= limit Zeichen, bevorzugt an
 * Satzgrenzen, sonst hart an Wortgrenzen.
 */
export function chunkChapterText(text: string, limit: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  const chunks: string[] = [];
  let current = "";

  const push = (part: string) => {
    const trimmed = part.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const sentence of clean.split(SENTENCE_SPLIT)) {
    if (sentence.length > limit) {
      // Überlange Sätze hart an Wortgrenzen zerteilen.
      if (current) {
        push(current);
        current = "";
      }
      let wordBuf = "";
      for (const word of sentence.split(" ")) {
        if ((wordBuf + " " + word).trim().length > limit) {
          push(wordBuf);
          wordBuf = word;
        } else {
          wordBuf = (wordBuf + " " + word).trim();
        }
      }
      if (wordBuf) current = wordBuf;
      continue;
    }
    if ((current + " " + sentence).trim().length > limit) {
      push(current);
      current = sentence;
    } else {
      current = (current + " " + sentence).trim();
    }
  }
  push(current);
  return chunks;
}

export interface BatchTTSHandle {
  cancel(): void;
}

/**
 * Synthetisiert alle Kapitel eines Buches als MP3/PCM-Chunks.
 * onResult wird pro Chunk aufgerufen, damit die UI Audio sofort abspielbar halten kann.
 */
export async function batchSynthesizeBook(
  providerId: TTSProviderId,
  config: TTSConfig,
  chapters: BatchTTSChapter[],
  options: { voice?: string; speed?: number },
  onProgress: (p: BatchTTSProgress) => void,
  onResult: (item: BatchTTSResultItem) => void,
): Promise<{ cancelled: boolean; chunks: BatchTTSResultItem[] }> {
  const provider: TTSProvider = createTTSProvider(providerId, config);
  const limit = CHUNK_LIMITS[providerId];
  const chunks: BatchTTSResultItem[] = [];
  let cancelled = false;

  const handle: BatchTTSHandle = {
    cancel() {
      cancelled = true;
    },
  };
  currentHandle = handle;

  for (let ci = 0; ci < chapters.length; ci++) {
    if (cancelled) break;
    const chapter = chapters[ci];
    const parts = chunkChapterText(chapter.content, limit);
    onProgress({
      chapterIndex: ci, totalChapters: chapters.length, chapterTitle: chapter.title,
      chunkIndex: 0, totalChunks: parts.length, phase: "chunking",
    });
    if (!parts.length) continue;

    for (let pi = 0; pi < parts.length; pi++) {
      if (cancelled) break;
      onProgress({
        chapterIndex: ci, totalChapters: chapters.length, chapterTitle: chapter.title,
        chunkIndex: pi, totalChunks: parts.length, phase: "synthesizing",
      });
      const audio = await provider.speak({ text: parts[pi], voice: options.voice, speed: options.speed });
      const item: BatchTTSResultItem = { chapterId: chapter.id, chunkIndex: pi, audio };
      chunks.push(item);
      onResult(item);
    }
  }

  onProgress({
    chapterIndex: chapters.length, totalChapters: chapters.length, chapterTitle: "",
    chunkIndex: 0, totalChunks: 0, phase: cancelled ? "cancelled" : "done",
  });
  currentHandle = null;
  return { cancelled, chunks };
}

let currentHandle: BatchTTSHandle | null = null;

/** Bricht einen laufenden Batch nach dem aktuellen Chunk ab. */
export function cancelBatchSynthesis(): void {
  currentHandle?.cancel();
}
