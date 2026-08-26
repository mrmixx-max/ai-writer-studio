// Konsistenz- und Stil-Checker — Typen.

/** Prüfbereich. */
export type DiagnosticCategory =
  | "character"     // Figurenkonsistenz
  | "world"         // Orts- und Weltdaten
  | "timeline"      // Zeitlinie
  | "pov"           // Perspektive
  | "style"         // Stil
  | "repetition"    // Wiederholungen
  | "termdrift";    // Begriffsdrift

/**
 * Einordnung des Befunds. Zentrale Produktregel:
 * "error" = harter Widerspruch, "possible" = mögliche Inkonsistenz,
 * "intentional" = vom Autor als bewusste literarische Abweichung markiert.
 */
export type FindingKind = "error" | "possible" | "intentional";

/** Schweregrad. */
export type Severity = "critical" | "warning" | "info";

/** Bearbeitungsstatus eines Befunds. */
export type FindingStatus = "open" | "ignored" | "intentional" | "resolved";

/** Ein Konsistenz- oder Stilbefund. */
export interface DiagnosticFinding {
  id: string;
  reportId: string;
  projectId: string;
  /** null = projektweiter Befund ohne konkrete Kapitelzuordnung. */
  chapterId: string | null;
  category: DiagnosticCategory;
  kind: FindingKind;
  severity: Severity;
  status: FindingStatus;
  /** Kurztitel, z. B. "Alter von Anna widersprüchlich". */
  title: string;
  /** Verständliche Erklärung auf Deutsch. */
  explanation: string;
  /** Zitat der betroffenen Textstelle. */
  excerpt: string | null;
  /** Zeichen-Offset im Kapitel-Plaintext für den Sprung zur Stelle. */
  charStart: number | null;
  charEnd: number | null;
  /** Vom Regelsystem oder LLM erzeugter Verbesserungsvorschlag. */
  suggestion: string | null;
  /** Regel-ID, die den Befund erzeugt hat (z. B. "style.filler"). */
  ruleId: string;
  /** true wenn dieser Befund ohne LLM allein durch Regeln entstand. */
  ruleBased: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Analyselauf über ein Kapitel oder Projekt. */
export interface DiagnosticReport {
  id: string;
  projectId: string;
  /** null = ganzes Projekt. */
  chapterId: string | null;
  /** Welche Kategorien geprüft wurden (JSON-Array). */
  categories: string;
  /** true wenn ein LLM beteiligt war. */
  usedLlm: boolean;
  /** Klartext-Hinweis, falls Teilfunktionen fehlten. */
  notice: string | null;
  findingCount: number;
  criticalCount: number;
  /** Aggregierte Stilmetriken als JSON (StyleMetrics). */
  metrics: string | null;
  createdAt: number;
  durationMs: number;
}

/** Rein rechnerische Stilmetriken (ohne LLM ermittelbar). */
export interface StyleMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  /** Standardabweichung der Satzlänge — niedrige Werte = monotoner Rhythmus. */
  sentenceLengthStdDev: number;
  longestSentence: number;
  /** Anteil Passivkonstruktionen an allen Sätzen (0..1). */
  passiveRatio: number;
  /** Anteil Nominalisierungen (…ung, …heit, …keit) an allen Wörtern. */
  nominalRatio: number;
  /** Anteil Füllwörter an allen Wörtern. */
  fillerRatio: number;
  /** Anteil Dialogzeilen an allen Absätzen. */
  dialogueRatio: number;
  /** Type-Token-Ratio als Maß lexikalischer Vielfalt. */
  typeTokenRatio: number;
}

/** Filter für die Diagnostik-Ansicht. */
export interface DiagnosticFilter {
  categories: DiagnosticCategory[] | null;
  severities: Severity[] | null;
  kinds: FindingKind[] | null;
  statuses: FindingStatus[] | null;
  chapterId: string | null;
}
