// KDP-/Export-Preflight — Typen.

/** Zielformat des Exports. */
export type ExportFormat = "docx" | "pdf" | "epub" | "md" | "txt";

export const EXPORT_FORMATS: ExportFormat[] = ["docx", "pdf", "epub", "md", "txt"];

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  docx: "DOCX",
  pdf: "PDF",
  epub: "EPUB",
  md: "Markdown",
  txt: "Text",
};

/** Prüfbereich — entspricht den Untertabs der Oberfläche. */
export type PreflightCategory =
  | "structure"
  | "frontmatter"
  | "backmatter"
  | "format"
  | "characters";

export const CATEGORY_LABELS: Record<PreflightCategory, string> = {
  structure: "Struktur",
  frontmatter: "Frontmatter",
  backmatter: "Backmatter",
  format: "Formate",
  characters: "Warnungen",
};

/**
 * Schweregrad.
 *
 * blocker  Export würde scheitern oder ein unbrauchbares Ergebnis liefern
 * warning  Export läuft, das Ergebnis hat aber einen sichtbaren Mangel
 * hint     Verbesserungsmöglichkeit ohne Auswirkung auf den Export
 */
export type PreflightSeverity = "blocker" | "warning" | "hint";

export const SEVERITY_LABELS: Record<PreflightSeverity, string> = {
  blocker: "kritisch",
  warning: "Warnung",
  hint: "Hinweis",
};

/**
 * Einordnung, orthogonal zum Schweregrad.
 *
 * Ein bewusst gesetzter Szenentrenner kann als Warnung erscheinen und
 * dennoch richtig sein — deshalb zwei Achsen statt einer.
 */
export type PreflightKind = "error" | "possible" | "intentional";

export const KIND_LABELS: Record<PreflightKind, string> = {
  error: "Fehler",
  possible: "möglich",
  intentional: "bewusst",
};

/** Nutzerentscheidung zu einem Befund. */
export type PreflightStatus = "open" | "ignored" | "accepted";

/** Ein Preflight-Befund. */
export interface PreflightFinding {
  id: string;
  reportId: string;
  projectId: string;
  /** null bei projektweiten Befunden (fehlendes Impressum, Struktur). */
  chapterId: string | null;
  /** Nachgetragen von der Oberfläche; die DB kennt nur die Id. */
  chapterTitle: string | null;
  category: PreflightCategory;
  severity: PreflightSeverity;
  kind: PreflightKind;
  status: PreflightStatus;
  /** Stabile Regel-Kennung, etwa "structure.empty-chapter". */
  ruleId: string;
  title: string;
  explanation: string;
  /** Konkreter Handlungsvorschlag. */
  recommendation: string | null;
  /** Textausschnitt, sofern der Befund eine Textstelle hat. */
  excerpt: string | null;
  /** Strukturhinweis, wenn kein Textausschnitt möglich ist. */
  structureHint: string | null;
  /** Formate, für die der Befund gilt. Leer = alle. */
  affectedFormats: ExportFormat[];
  charStart: number | null;
  charEnd: number | null;
  /** Wiedererkennung nach erneutem Lauf, ohne Positionsangabe gebildet. */
  fingerprint: string;
  createdAt: number;
}

/** Kopf eines Prüflaufs. */
export interface PreflightReport {
  id: string;
  projectId: string;
  chapterId: string | null;
  scope: "project" | "chapter";
  /** Geprüfte Zielformate. */
  formats: ExportFormat[];
  blockerCount: number;
  warningCount: number;
  hintCount: number;
  checkedFrontmatter: boolean;
  checkedBackmatter: boolean;
  /** Klartext-Hinweis, wenn Teile der Prüfung nicht möglich waren. */
  notice: string | null;
  createdAt: number;
  durationMs: number;
}

/** Vollständiges Ergebnis eines Prüflaufs. */
export interface PreflightResult {
  report: PreflightReport;
  findings: PreflightFinding[];
  /** true, wenn Teile übersprungen wurden. */
  degraded: boolean;
}

/** Optionen für einen Prüflauf. */
export interface PreflightOptions {
  /** Nur dieses Kapitel prüfen. */
  chapterId?: string;
  /** Zielformate. Standard: alle. */
  formats?: ExportFormat[];
  /** Frontmatter prüfen (Titel, Impressum, Inhaltsverzeichnis). */
  checkFrontmatter?: boolean;
  /** Backmatter prüfen (Autorenseite, weitere Bücher, Kontakt). */
  checkBackmatter?: boolean;
  onProgress?: (done: number, total: number, label?: string) => void;
}

/** Eine abschaltbare Regel. */
export interface PreflightRule {
  id: string;
  projectId: string;
  ruleId: string;
  enabled: boolean;
  /** Abweichender Schwellwert, sofern die Regel einen kennt. */
  threshold: number | null;
  note: string | null;
}

/** Zählwerk für die Übersicht. */
export interface PreflightStats {
  total: number;
  blocker: number;
  warning: number;
  hint: number;
  byCategory: Record<string, number>;
  byFormat: Record<string, number>;
  /** Zeitpunkt des letzten Laufs, oder null. */
  lastRun: number | null;
}

/**
 * Filter der Befundliste.
 * Wird sowohl von der Oberfläche als auch von den Tests verwendet, damit
 * die Filterlogik an genau einer Stelle liegt.
 */
export interface PreflightFilter {
  category?: PreflightCategory;
  onlyBlockers?: boolean;
  chapterId?: string | null;
  format?: ExportFormat;
  includeResolved?: boolean;
}
