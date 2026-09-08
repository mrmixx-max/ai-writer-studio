// AdvancedExport Engine (Sprint 23, Agent 6): erweiterter Buch-Export mit
// Titelseite, Widmung, Inhaltsverzeichnis, Kapiteln, Appendix, Danksagung,
// Über-den-Autor und Kolofon. Keine neuen Dependencies — reine
// Markdown/HTML-Transformation + Blob-Erzeugung.
export type BookSectionType =
  | "title-page"
  | "dedication"
  | "toc"
  | "chapter"
  | "appendix"
  | "acknowledgments"
  | "about-author"
  | "colophon";

export interface BookSection {
  type: BookSectionType;
  title: string;
  content: string;
  pageBreak: boolean;
}

export interface BookConfig {
  title: string;
  subtitle?: string;
  author: string;
  isbn?: string;
  dedication?: string;
  acknowledgments?: string;
  aboutAuthor?: string;
  sections: BookSection[];
  format: "pdf" | "docx" | "epub";
  includeTOC: boolean;
  includePageNumbers: boolean;
  fontFamily: string;
  fontSize: number;
}

export interface TocEntry {
  title: string;
  pageNumber: number;
}

/** Deutschsprachiges Label pro Sektionstyp (UI + Export). */
export const SECTION_LABELS: Record<BookSectionType, string> = {
  "title-page": "Titelseite",
  dedication: "Widmung",
  toc: "Inhaltsverzeichnis",
  chapter: "Kapitel",
  appendix: "Appendix",
  acknowledgments: "Danksagung",
  "about-author": "Über den Autor",
  colophon: "Kolofon",
};

/** Standard-Sektionen für ein neues Buch (Reihenfolge wie im Buchblock). */
export function defaultSections(): BookSection[] {
  return [
    { type: "title-page", title: "Titelseite", content: "", pageBreak: true },
    { type: "dedication", title: "Widmung", content: "", pageBreak: true },
    { type: "toc", title: "Inhaltsverzeichnis", content: "", pageBreak: true },
    { type: "chapter", title: "Kapitel 1", content: "", pageBreak: true },
    { type: "appendix", title: "Anhang", content: "", pageBreak: true },
    { type: "acknowledgments", title: "Danksagung", content: "", pageBreak: true },
    { type: "about-author", title: "Über den Autor", content: "", pageBreak: true },
    { type: "colophon", title: "Kolofon", content: "", pageBreak: false },
  ];
}

/** Leere Standard-Konfiguration. */
export function defaultBookConfig(): BookConfig {
  return {
    title: "",
    subtitle: "",
    author: "",
    sections: defaultSections(),
    format: "pdf",
    includeTOC: true,
    includePageNumbers: true,
    fontFamily: "Georgia, serif",
    fontSize: 12,
  };
}

/** Erzeugt ein textbasiertes Inhaltsverzeichnis mit Seitenzahlen. */
export function generateTOC(chapters: TocEntry[]): string {
  const lines = ["# Inhaltsverzeichnis", ""];
  if (chapters.length === 0) {
    lines.push("_Keine Kapitel vorhanden._");
    return lines.join("\n");
  }
  for (const ch of chapters) {
    const dots = ".".repeat(Math.max(2, 40 - ch.title.length));
    lines.push(`- ${ch.title} ${dots} ${ch.pageNumber}`);
  }
  return lines.join("\n");
}

/** Erzeugt die Titelseite (Titel + Untertitel + Autor + ISBN). */
export function generateTitlePage(config: BookConfig): string {
  const lines = [`# ${config.title || "(Ohne Titel)"}`, ""];
  if (config.subtitle) lines.push(`## ${config.subtitle}`, "");
  lines.push(`**${config.author || "(Unbekannter Autor)"}**`, "");
  if (config.isbn) lines.push(`ISBN: ${config.isbn}`, "");
  return lines.join("\n");
}

/** Erzeugt die Widmungsseite. */
export function generateDedicationPage(text: string): string {
  const body = text.trim() ? text.trim() : "_Keine Widmung._";
  return ["# Widmung", "", `_${body}_`].join("\n");
}

/** Erzeugt die „Über den Autor“-Seite. */
export function generateAboutAuthorPage(text: string): string {
  const body = text.trim() ? text.trim() : "_Keine Autoreninfo._";
  return ["# Über den Autor", "", body].join("\n");
}

/** Erzeugt das Kolofon (Titel, Autor, ISBN, Schrift, Datum). */
export function generateColophonPage(config: BookConfig): string {
  const year = new Date().getFullYear();
  const lines = [
    "# Kolofon",
    "",
    `**${config.title || "(Ohne Titel)"}**`,
    `von ${config.author || "(Unbekannter Autor)"}`,
    "",
    `© ${year} ${config.author || "(Unbekannter Autor)"}. Alle Rechte vorbehalten.`,
  ];
  if (config.isbn) lines.push(`ISBN: ${config.isbn}`);
  lines.push(`Satz: ${config.fontFamily}, ${config.fontSize}pt`);
  return lines.join("\n");
}

/** Schätzt die Seitenzahl (ca. 300 Wörter/Seite + 1 Seite je Umbruch-Sektion). */
export function estimatePageCount(config: BookConfig): number {
  let words = 0;
  const count = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  words += count(config.title) + count(config.subtitle ?? "") + count(config.author);
  words += count(config.dedication ?? "");
  words += count(config.acknowledgments ?? "");
  words += count(config.aboutAuthor ?? "");
  for (const s of config.sections) words += count(s.title) + count(s.content);
  const textPages = Math.max(1, Math.ceil(words / 300));
  const breaks = config.sections.filter((s) => s.pageBreak).length;
  return textPages + breaks;
}

/** Baut das komplette Buch als Markdown-Text. */
export function buildBookMarkdown(config: BookConfig): string {
  const parts: string[] = [];
  const tocEntries: TocEntry[] = [];
  // Seitenzahlen grob vorab schätzen: 1 Seite je Umbruch-Sektion davor.
  let page = 1;
  const pageOf = config.sections.map(() => page++);

  for (let i = 0; i < config.sections.length; i++) {
    const s = config.sections[i];
    if (s.type === "toc" && !config.includeTOC) continue;
    if (s.type === "toc") {
      const entries: TocEntry[] = config.sections
        .filter((x) => x.type === "chapter" || x.type === "appendix")
        .map((x) => {
          const idx = config.sections.indexOf(x);
          return { title: x.title, pageNumber: pageOf[idx] ?? 1 };
        });
      tocEntries.push(...entries);
      parts.push(generateTOC(entries));
    } else if (s.type === "title-page") {
      parts.push(generateTitlePage(config));
    } else if (s.type === "dedication") {
      parts.push(generateDedicationPage(config.dedication ?? s.content));
    } else if (s.type === "acknowledgments") {
      const body = (config.acknowledgments ?? s.content).trim() || "_Keine Danksagung._";
      parts.push(["# Danksagung", "", body].join("\n"));
    } else if (s.type === "about-author") {
      parts.push(generateAboutAuthorPage(config.aboutAuthor ?? s.content));
    } else if (s.type === "colophon") {
      parts.push(generateColophonPage(config));
    } else {
      parts.push([`# ${s.title}`, "", s.content.trim() || "_Leer._"].join("\n"));
    }
    if (s.pageBreak) parts.push("\n---\n");
  }
  const header = config.includePageNumbers
    ? `<!-- ${config.title} — ${config.author} -->\n\n`
    : "";
  return header + parts.join("\n\n");
}

/** Generiert das Buch als Blob (Markdown-Text; Format steht im MIME-Typ). */
export async function generateBook(config: BookConfig): Promise<Blob> {
  const md = buildBookMarkdown(config);
  const mime =
    config.format === "epub"
      ? "application/epub+zip"
      : config.format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
  return new Blob([md], { type: `${mime};charset=utf-8` });
}
