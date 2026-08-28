// Gemeinsame Typen für alle Import-Services.
// Import-Pipeline: externe Datei → ImportedDocument → createProject/createChapter.

export interface ImportedChapter {
  /** Kapitel-Titel (Binder-Label, Markdown-# / Docx-Heading 1 oder Dateiname). */
  title: string;
  /** Kapitelinhalt als TipTap-JSON-String (kompatibel zum Editor/Export). */
  content: string;
  /** Reihenfolge, wie sie in der Quelle vorkam. */
  orderIndex: number;
}

export interface ImportedDocument {
  /** Vorgeschlagener Projektname. */
  title: string;
  chapters: ImportedChapter[];
  /** Optionale Metadaten (Autor, Sprache, …) je nach Quellformat. */
  meta?: Record<string, string>;
}

export interface ImportProgress {
  (percent: number, label: string): void;
}

export class ImportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ImportError";
  }
}
