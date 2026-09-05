// Typen für den Book-Export (Markdown/DOCX/EPUB).

export type ExportFormat = "markdown" | "docx" | "epub" | "opml";

/** Ein Kapitel des Buchs. `content` ist TipTap-JSON (auch Klartext erlaubt). */
export interface BookChapterInput {
  /** Kapitelnummer (1-basiert). */
  number?: number;
  title: string;
  /** TipTap-JSON des Kapitels — Fallback: Klartext. */
  content: string;
  /** Kapitel-Status — needs_revision-Kapitel werden exportiert und gemeldet. */
  status?: string;
}

export interface ExportBookInput {
  title: string;
  author?: string;
  language?: string;
  /** Erscheinungsjahr fürs Impressum (Default: aktuelles Jahr). */
  year?: number;
  chapters: BookChapterInput[];
}

export interface ExportBookResult {
  filename: string;
  blob: Blob;
  format: ExportFormat;
  /** Sprint 4: passendes VBA-Makro (.bas) für die Word-Post-Production. */
  vbaMacro?: ExportVbaMacroResult;
}

/** Sprint 4: Generiertes VBA-Modul ("AI Text Refinement") für Word. */
export interface ExportVbaMacroResult {
  /** Dateiname des .bas-Moduls (dateisystem-sicher, aus Buchtitel abgeleitet). */
  filename: string;
  /** Vollständiger VBA-Quelltext (Attribut-Header + Refinement-Subs). */
  content: string;
}

/** Ein generiertes Buch mit Status je Kapitel (Export-Gate + needs_revision-Warnung). */
export interface ExportableBook {
  title: string;
  author?: string;
  language?: string;
  chapters: BookChapterInput[];
}