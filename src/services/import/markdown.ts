// Markdown-Import: eine oder mehrere .md/.markdown/.txt-Dateien → ImportedDocument.
// Erkennt # / ## / ### Überschriften, Listen, Zitate, Codeblöcke, Absätze.
// Mehrere Dateien werden alphabetisch sortiert als Kapitel übernommen
// (HMR/Export-Konvention: Dateiname = Kapiteltitel, wenn keine H1 vorhanden).

import { ImportError, type ImportedChapter, type ImportedDocument, type ImportProgress } from "./types";
import { blocksToTipTap, type ImportBlock } from "./tiptap";

export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".txt", ".mdown", ".mkd"];

export function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface MarkdownImportOptions {
  /** Fortschritt-Callback. */
  onProgress?: ImportProgress;
  /** Wenn true: jede H1 startet ein neues Kapitel innerhalb EINER Datei. */
  splitOnH1?: boolean;
}

/** Parst einen einzelnen Markdown-String zu Blöcken. */
export function parseMarkdown(text: string): ImportBlock[] {
  const blocks: ImportBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ type: "p", text: para.join(" ").trim() });
      para = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCode = false;
      } else {
        flushPara();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      blocks.push({ type: `h${heading[1].length}` as ImportBlock["type"], text: heading[2].trim() });
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushPara();
      blocks.push({ type: "list_item", text: bullet[1] });
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushPara();
      blocks.push({ type: "list_item", text: ordered[1], ordered: true });
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    para.push(line.trim());
  }
  if (inCode && codeLines.length > 0) blocks.push({ type: "code", text: codeLines.join("\n") });
  flushPara();
  return blocks;
}

/** Parst EINE Markdown-Datei in Kapitel (optional Aufteilung an H1). */
export function parseMarkdownToChapters(
  filename: string,
  text: string,
  startOrder = 0,
  splitOnH1 = false,
): ImportedChapter[] {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) {
    return [{ title: stripExt(filename), content: blocksToTipTap([]), orderIndex: startOrder }];
  }
  if (!splitOnH1 || !blocks.some((b) => b.type === "h1")) {
    const firstHeading = blocks.find((b) => b.type === "h1" || b.type === "h2");
    const title = firstHeading ? firstHeading.text : stripExt(filename);
    return [{ title, content: blocksToTipTap(blocks), orderIndex: startOrder }];
  }
  const chapters: ImportedChapter[] = [];
  let current: { title: string; blocks: ImportBlock[] } | null = null;
  for (const b of blocks) {
    if (b.type === "h1") {
      if (current) chapters.push({ title: current.title, content: blocksToTipTap(current.blocks), orderIndex: startOrder + chapters.length });
      current = { title: b.text, blocks: [] };
    } else if (current) {
      current.blocks.push(b);
    }
    // Blöcke vor der ersten H1 werden ignoriert (typisch: Titel/Vorwort der Datei).
  }
  if (current) {
    chapters.push({ title: current.title, content: blocksToTipTap(current.blocks), orderIndex: startOrder + chapters.length });
  }
  if (chapters.length === 0) {
    chapters.push({ title: stripExt(filename), content: blocksToTipTap(blocks), orderIndex: startOrder });
  }
  return chapters;
}

/** Importiert mehrere Markdown-Dateien (aus Datei-Dialog / Dateisystem). */
export async function importMarkdownFiles(
  files: Array<{ name: string; text: string }>,
  options: MarkdownImportOptions = {},
): Promise<ImportedDocument> {
  const { onProgress, splitOnH1 = false } = options;
  const md = files.filter((f) => isMarkdownFile(f.name));
  if (md.length === 0) {
    throw new ImportError("Keine Markdown-Dateien gefunden (.md/.txt).");
  }
  md.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const chapters: ImportedChapter[] = [];
  for (let i = 0; i < md.length; i++) {
    onProgress?.(Math.round((i / md.length) * 90), `„${md[i].name}“ wird gelesen…`);
    chapters.push(...parseMarkdownToChapters(md[i].name, md[i].text, chapters.length, splitOnH1));
  }
  onProgress?.(100, "Markdown-Import fertig.");
  const title = md.length === 1 ? stripExt(md[0].name) : "Importiertes Manuskript";
  return { title, chapters };
}

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
