// AutoBookWriter: vollautomatische Buchgenerierung via Ollama. Keine DB-Persistenz.
import { OllamaProvider } from "@/services/llm/ollama";

/** Extrahiert das erste gültige JSON-Objekt aus einem String (robust gegen nachgestellten Text). */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export interface BookOutline {
  title: string;
  genre: string;
  targetAudience: string;
  chapters: { number: number; title: string; summary: string }[];
}

export interface BookChapter {
  number: number;
  title: string;
  content: string;
}

export interface BookWriterConfig {
  topic: string;
  genre: string;
  targetAudience: string;
  chapterCount: number;
  model: string;
  baseUrl: string;
  language: string;
}

export async function generateOutline(
  config: BookWriterConfig,
  signal?: AbortSignal,
): Promise<BookOutline> {
  const provider = new OllamaProvider(config.baseUrl);
  const prompt = `Erstelle eine detaillierte Gliederung für ein Buch:
- Thema: ${config.topic}
- Genre: ${config.genre}
- Zielgruppe: ${config.targetAudience}
- Kapitel: ${config.chapterCount}
- Sprache: ${config.language}

Antwitte NUR als JSON-Objekt:
{"title": "Titel", "genre": "${config.genre}", "targetAudience": "${config.targetAudience}", "chapters": [{"number": 1, "title": "...", "summary": "..."}]}`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 4096, temperature: 0.8, timeoutMs: 120000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  const raw = chunks.join("");
  // Extrahiere JSON: finde ersten { und zähle Klammern bis zum Match
  const json = extractJson(raw);
  if (!json) throw new Error("Keine gültige Gliederung erhalten: " + raw.slice(0, 200));
  return JSON.parse(json) as BookOutline;
}

export async function generateChapter(
  config: BookWriterConfig,
  outline: BookOutline,
  chapterNumber: number,
  previousChapters: BookChapter[],
  signal?: AbortSignal,
): Promise<BookChapter> {
  const provider = new OllamaProvider(config.baseUrl);
  const chapter = outline.chapters.find((c) => c.number === chapterNumber);
  if (!chapter) throw new Error(`Kapitel ${chapterNumber} nicht gefunden`);

  const contextChapters = outline.chapters
    .map((c) => `K${c.number}: ${c.title} — ${c.summary}`)
    .join("\n");

  const prevCtx = previousChapters.length > 0
    ? `\n\nVorherige Kapitel (Kontext):\n${previousChapters.map((c) => `K${c.number}: ${c.title}\n${c.content.slice(0, 150)}...`).join("\n")}`
    : "";

  const prompt = `Schreibe Kapitel ${chapterNumber} von "${outline.title}".
Genre: ${outline.genre} | Zielgruppe: ${outline.targetAudience} | Sprache: ${config.language}

Gliederung: ${contextChapters}
Kapitel-${chapterNumber}-Details: ${chapter.summary}${prevCtx}

Schreibe nur den Kapiteltext (min. 1000 Wörter). Keine Überschriften.`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 8192, temperature: 0.7, timeoutMs: 180000 },
    signal,
  )) {
    chunks.push(chunk);
  }

  return { number: chapterNumber, title: chapter.title, content: chunks.join("") };
}

export async function generateBook(
  config: BookWriterConfig,
  onProgress: (current: number, total: number, chapter: BookChapter | null) => void,
  signal?: AbortSignal,
): Promise<{ outline: BookOutline; chapters: BookChapter[] }> {
  const outline = await generateOutline(config, signal);
  const chapters: BookChapter[] = [];

  for (let i = 1; i <= outline.chapters.length; i++) {
    if (signal?.aborted) break;
    onProgress(i, outline.chapters.length, null);
    const chapter = await generateChapter(config, outline, i, chapters, signal);
    chapters.push(chapter);
    onProgress(i, outline.chapters.length, chapter);
  }

  return { outline, chapters };
}
