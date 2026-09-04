// Buch-Markdown (KDP-tauglich): Titel, Autor, Impressum, klickbares
// Inhaltsverzeichnis (Markdown-Anker), Kapitel untereinander mit "Kapitel N".

import type { Block } from "@/services/export/blocks";
import type { BookChapterInput } from "./types";
import {
  buildTocEntries,
  chapterHeading,
  normalizedChapterBlocks,
} from "./structure";
import { normalizeTypography } from "./typography";

/** Markdown-Anker-Id wie GitHub/VS Code sie aus Überschriften ableitet. */
function mdAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .trim()
    .replace(/ +/g, "-");
}

/** Block → Markdown-Zeilen. */
function blockToMd(b: Block): string {
  if (b.type === "h1") return `# ${b.text}`;
  if (b.type === "h2") return `## ${b.text}`;
  if (b.type === "h3") return `### ${b.text}`;
  if (b.type === "quote") return `> ${b.text}`;
  if (b.type === "code") return `\`\`\`\n${b.text}\n\`\`\``;
  if (b.type === "list_item" && b.items) {
    return b.items
      .map((it, i) => (b.ordered ? `${i + 1}. ` : "- ") + it.text)
      .join("\n");
  }
  if (b.type === "image") return `*${b.text}*`;
  return b.text;
}

export function buildBookMarkdown(
  meta: { title: string; author: string; language?: string },
  chapters: BookChapterInput[],
  blocksPerChapter: Block[][],
): string {
  const year = new Date().getFullYear();
  const parts: string[] = [];

  // Titelblatt + Impressum
  parts.push(`# ${normalizeTypography(meta.title)}\n`);
  parts.push(`**von ${meta.author}**\n`);
  parts.push(`© ${year} ${meta.author}\n`);
  parts.push("Alle Rechte vorbehalten.\n");

  // Klickbares Inhaltsverzeichnis
  const entries = buildTocEntries(chapters);
  const tocLines = entries.map((e) => {
    const heading = chapterHeading(
      chapters[entries.indexOf(e)],
      entries.indexOf(e),
    );
    return `- [${heading}](#${mdAnchor(heading)})`;
  });
  parts.push(`## Inhaltsverzeichnis\n\n${tocLines.join("\n")}\n`);

  // Kapitel
  chapters.forEach((c, i) => {
    const heading = chapterHeading(c, i);
    const blocks = normalizedChapterBlocks(blocksPerChapter[i] ?? []);
    const body = blocks.map(blockToMd).join("\n\n");
    parts.push(`## ${heading}\n\n${body}`);
  });

  return parts.join("\n\n") + "\n";
}