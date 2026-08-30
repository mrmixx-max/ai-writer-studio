// AutoBookWriter: vollautomatische Buchgenerierung via Ollama.
import { OllamaProvider } from "@/services/llm/ollama";

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
  const prompt = `Erstelle eine detaillierte Gliederung für ein Buch mit folgenden Parametern:
- Thema: ${config.topic}
- Genre: ${config.genre}
- Zielgruppe: ${config.targetAudience}
- Anzahl Kapitel: ${config.chapterCount}
- Sprache: ${config.language}

Antworte als JSON-Objekt mit dieser Struktur:
{
  "title": "Buchtitel",
  "genre": "${config.genre}",
  "targetAudience": "${config.targetAudience}",
  "chapters": [
    {"number": 1, "title": "Kapiteltitel", "summary": "Kurze Zusammenfassung"}
  ]
}

Gib NUR das JSON zurück, keinen anderen Text.`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 4096, temperature: 0.8 },
    signal,
  )) {
    chunks.push(chunk);
  }

  const raw = chunks.join("");
  // JSON aus der Antwort extrahieren
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Keine gültige Gliederung erhalten");
  return JSON.parse(match[0]) as BookOutline;
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
    .map((c) => `Kapitel ${c.number}: ${c.title} — ${c.summary}`)
    .join("\n");

  const previousContext = previousChapters.length > 0
    ? `\n\nBisher geschriebene Kapitel (Kontext):\n${previousChapters.map((c) => `Kapitel ${c.number}: ${c.title}\n${c.content.slice(0, 200)}...`).join("\n\n")}`
    : "";

  const prompt = `Schreibe Kapitel ${chapterNumber} des Buches "${outline.title}".

Gliederung des Buches:
${contextChapters}

Details zu diesem Kapitel:
- Titel: ${chapter.title}
- Zusammenfassung: ${chapter.summary}
- Genre: ${outline.genre}
- Zielgruppe: ${outline.targetAudience}
- Sprache: ${config.language}
${previousContext}

Schreibe das Kapitel als Fließtext. Mindestens 1500 Wörter. Keine Überschriften, nur den Text. Ausgabe auf Deutsch.`;

  const chunks: string[] = [];
  for await (const chunk of provider.chat(
    [{ role: "user", content: prompt }],
    { model: config.model, maxTokens: 8192, temperature: 0.7 },
    signal,
  )) {
    chunks.push(chunk);
  }

  return {
    number: chapterNumber,
    title: chapter.title,
    content: chunks.join(""),
  };
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
