// Bilingual-Export (Sprint 15, Agent 4): zweisprachiges Buch (DE + EN) als
// Markdown-Blob — Kapitel nebeneinander (DE links, EN rechts) via
// Zwei-Spalten-Tabelle plus Volltext-Sektionen mit Sprach-Markern und einer
// sprachumschaltbaren Inhaltsübersicht (TOC mit <!-- lang:de --> /
// <!-- lang:en -->-Blöcken).
//
// Baut auf der bestehenden Export-Infrastruktur auf (toBlocks + toMd aus
// ./index): TipTap-JSON-Inhalte werden über die Pipeline konvertiert,
// Markdown-Inhalte (z.B. aus dem TranslatorService) werden direkt übernommen.

import { toBlocks, toMd } from "./index";

/** Ein Kapitel in beiden Sprachen. Inhalte je als TipTap-JSON oder Markdown. */
export interface BilingualChapter {
  id: string;
  titleDe: string;
  titleEn: string;
  /** TipTap-JSON (doc) oder Markdown/Rohtext — wird automatisch erkannt. */
  contentDe: string;
  contentEn: string;
}

/** Ein zweisprachiges Buch. */
export interface BilingualBook {
  id: string;
  title: string;
  titleDe?: string;
  titleEn?: string;
  author?: string;
  chapters: BilingualChapter[];
}

/** Primärsprache des Dokuments (Metadaten, Titel-Präferenz). DE links, EN rechts bleibt fix. */
export type BilingualTargetLang = "de" | "en";

/** URL-sicherer Anker aus Kapitel-ID. */
export function slugifyChapterId(id: string): string {
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "chapter"
  );
}

/**
 * Konvertiert einen Kapitel-Inhalt (TipTap-JSON oder Markdown) nach Markdown.
 * Nutzt die bestehende Export-Pipeline (toBlocks → toMd) für TipTap-JSON.
 */
export function contentToMarkdown(content: string): string {
  if (!content || !content.trim()) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return toMd(toBlocks(trimmed));
      }
    } catch {
      // Kein valides JSON → als Rohtext/Markdown behandeln.
    }
  }
  return trimmed;
}

/** Inline-fähige Kurzform für die Tabellenzelle (Absätze → <br>). */
function toInlineCell(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, "<br>").replace(/\|/g, "\\|").trim())
    .filter(Boolean)
    .join("<br><br>");
}

/** Sprachumschaltbares Inhaltsverzeichnis (DE- und EN-Block mit Markern). */
export function buildBilingualToc(book: BilingualBook): string {
  const lines: string[] = [];
  lines.push("## Inhaltsverzeichnis / Table of Contents");
  lines.push("");
  lines.push("<!-- lang:de -->");
  lines.push("### 🇩🇪 Inhalt (Deutsch)");
  lines.push("");
  book.chapters.forEach((ch, i) => {
    lines.push(`${i + 1}. [${ch.titleDe}](#${slugifyChapterId(ch.id)}-de)`);
  });
  lines.push("<!-- /lang:de -->");
  lines.push("");
  lines.push("<!-- lang:en -->");
  lines.push("### 🇬🇧 Contents (English)");
  lines.push("");
  book.chapters.forEach((ch, i) => {
    lines.push(`${i + 1}. [${ch.titleEn}](#${slugifyChapterId(ch.id)}-en)`);
  });
  lines.push("<!-- /lang:en -->");
  return lines.join("\n");
}

/** Ein Kapitel nebeneinander: Side-by-Side-Tabelle + Volltext mit Sprach-Markern. */
export function buildBilingualChapterMd(ch: BilingualChapter, index: number): string {
  const slug = slugifyChapterId(ch.id);
  const deMd = contentToMarkdown(ch.contentDe);
  const enMd = contentToMarkdown(ch.contentEn);
  const lines: string[] = [];
  lines.push(`<a id="${slug}-de"></a><a id="${slug}-en"></a>`);
  lines.push("");
  lines.push(`## ${index + 1}. ${ch.titleDe} / ${ch.titleEn}`);
  lines.push("");
  lines.push("| 🇩🇪 Deutsch (DE) | 🇬🇧 English (EN) |");
  lines.push("|---|---|");
  lines.push(`| ${toInlineCell(deMd) || "—"} | ${toInlineCell(enMd) || "—"} |`);
  lines.push("");
  lines.push("<!-- lang:de -->");
  lines.push(`### 🇩🇪 ${ch.titleDe}`);
  lines.push("");
  lines.push(deMd || "_Kein deutscher Inhalt._");
  lines.push("<!-- /lang:de -->");
  lines.push("");
  lines.push("<!-- lang:en -->");
  lines.push(`### 🇬🇧 ${ch.titleEn}`);
  lines.push("");
  lines.push(enMd || "_No English content._");
  lines.push("<!-- /lang:en -->");
  return lines.join("\n");
}

/** Komplettes bilinguales Markdown-Dokument. */
export function buildBilingualMarkdown(
  book: BilingualBook,
  targetLang: BilingualTargetLang = "de",
  complete = true,
): string {
  const title =
    targetLang === "en" ? (book.titleEn ?? book.title) : (book.titleDe ?? book.title);
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  if (book.author) {
    lines.push(`*${book.author}*`);
    lines.push("");
  }
  lines.push("*Bilinguale Ausgabe / Bilingual edition (DE/EN)*");
  lines.push("<!-- bilingual: de+en -->");
  lines.push("");

  if (complete) {
    lines.push(buildBilingualToc(book));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  book.chapters.forEach((ch, i) => {
    lines.push(buildBilingualChapterMd(ch, i));
    if (i < book.chapters.length - 1) {
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  });

  return lines.join("\n") + "\n";
}

/**
 * Exportiert ein zweisprachiges Buch (DE + EN) als Markdown-Blob.
 *
 * @param book       Bilinguales Buch (Kapitel je mit DE- und EN-Inhalt).
 * @param targetLang Primärsprache für Titel/Metadaten ("de" | "en"); die
 *                   Spaltenreihenfolge bleibt fix: DE links, EN rechts.
 * @param complete   true = mit Titelseite + TOC (vollständiges Buch);
 *                   false = nur die Kapitel (z.B. für Vorschau/Teilexport).
 */
export async function exportBilingual(
  book: BilingualBook,
  targetLang: BilingualTargetLang = "de",
  complete = true,
): Promise<Blob> {
  const md = buildBilingualMarkdown(book, targetLang, complete);
  return new Blob([md], { type: "text/markdown;charset=utf-8" });
}
