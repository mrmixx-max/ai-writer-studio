// KDP-/Export-Preflight — Typen.

/** Zielformat des Exports. */
export type ExportFormat = "docx" | "epub" | "pdf" | "md" | "txt";

/** Prüfbereich des Preflight. */
export type PreflightCategory =
  | "structure"    // Kapitelstruktur, leere Kapitel, Duplikate
  | "headings"     // Überschriften-Hierarchie
  | "whitespace"   // Mehrfachleerzeilen, Absatzabstände
  | "characters"   // problematische Sonderzeichen
  | "frontmatter"  // Titel, Impressum, Inhaltsverzeichnis
  | "backmatter"   // Autorenseite, weitere Bücher
  | "format"       // formatspezifische Warnungen
  | "kdp";         // KDP-Hinweise (Kapitellänge, Szenentrenner …)

/** Schweregrad eines Preflight-Befunds. */
export type PreflightSeverity = "blocker" | "warning" | "hint";

/** Ein einzelner Preflight-Befund. */
export interface PreflightFinding {
  id: string;
  reportId: string;
  projectId: string;
  chapterId: string | null;
  category: PreflightCategory;
  severity: PreflightSeverity;
  /** Regel-ID, z. B. "structure.empty_chapter". */
  ruleId: string;
  title: string;
  /** Verständliche Erklärung auf Deutsch. */
  explanation: string;
  /** Konkrete Handlungsempfehlung. */
  recommendation: string | null;
  /** Betroffene Stelle als Zitat. */
  excerpt: string | null;
  /** Für welche Formate dieser Befund relevant ist (JSON-Array von ExportFormat). */
  affectedFormats: string;
  createdAt: number;
}

/** Ergebnis eines Preflight-Laufs. */
export interface PreflightReport {
  id: string;
  projectId: string;
  /** Für welches Format geprüft wurde; null = formatunabhängig. */
  targetFormat: ExportFormat | null;
  blockerCount: number;
  warningCount: number;
  hintCount: number;
  /** true wenn Frontmatter-Prüfung aktiv war. */
  checkedFrontmatter: boolean;
  checkedBackmatter: boolean;
  createdAt: number;
  durationMs: number;
}

/** Konfiguration eines Preflight-Laufs. */
export interface PreflightOptions {
  targetFormat: ExportFormat | null;
  checkFrontmatter: boolean;
  checkBackmatter: boolean;
  /** Kapitel über dieser Wortzahl gelten als "sehr lang". */
  maxChapterWords: number;
}

export const DEFAULT_PREFLIGHT_OPTIONS: PreflightOptions = {
  targetFormat: null,
  checkFrontmatter: false,
  checkBackmatter: false,
  maxChapterWords: 8000,
};
