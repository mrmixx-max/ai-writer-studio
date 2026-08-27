// Bookwriter — Typen.

/** Unterstützte Genres. */
export type BookGenre =
  | "sachbuch"
  | "ratgeber"
  | "technik"
  | "roman"
  | "kurzgeschichte"
  | "essaybuch"
  | "krimi"
  | "fantasy";

export const GENRE_LABELS: Record<BookGenre, string> = {
  sachbuch: "Sachbuch",
  ratgeber: "Ratgeber",
  technik: "Technisches Nonfiction",
  roman: "Roman",
  kurzgeschichte: "Kurzgeschichte / Novella",
  essaybuch: "Essay-Buch",
  krimi: "Krimi / Thriller",
  fantasy: "Fantasy / Science Fiction",
};

/** KDP-Zielformat. */
export type KdpTarget = "ebook" | "taschenbuch" | "beides";

/** Sprache des Manuskripts. */
export type BookLanguage = "de" | "en";

/** Phasen des Workflows. */
export type BookwriterPhase =
  | "briefing"
  | "konzept"
  | "gliederung"
  | "manuskript"
  | "qualitaet"
  | "ueberarbeitung"
  | "metadaten"
  | "export";

export const PHASE_LABELS: Record<BookwriterPhase, string> = {
  briefing: "Briefing",
  konzept: "Konzept",
  gliederung: "Gliederung",
  manuskript: "Manuskript",
  qualitaet: "Qualitätsloop",
  ueberarbeitung: "Überarbeitung",
  metadaten: "KDP-Metadaten",
  export: "Export",
};

export const PHASE_ORDER: BookwriterPhase[] = [
  "briefing",
  "konzept",
  "gliederung",
  "manuskript",
  "qualitaet",
  "ueberarbeitung",
  "metadaten",
  "export",
];

/** Status einer Phase. */
export type PhaseStatus = "pending" | "running" | "done" | "error" | "paused";

/** Freigabemodus. */
export type ApprovalMode = "auto" | "phase" | "manual";

/** Ein laufender Bookwriter-Durchlauf. */
export interface BookwriterRun {
  id: string;
  projectId: string;
  status: "active" | "paused" | "completed" | "aborted";
  mode: ApprovalMode;
  currentPhase: BookwriterPhase;
  /** Fortschritt der aktuellen Phase, 0..1. */
  phaseProgress: number;
  createdAt: number;
  updatedAt: number;
}

/** Eine Phase innerhalb eines Laufs. */
export interface BookwriterPhaseState {
  id: string;
  runId: string;
  phase: BookwriterPhase;
  status: PhaseStatus;
  /** 0..1 */
  progress: number;
  /** Fehlermeldung, sofern status = "error". */
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

/** Ein Artefakt, das eine Phase erzeugt. */
export interface BookwriterArtifact {
  id: string;
  runId: string;
  phase: BookwriterPhase;
  artifactType: string;
  /** JSON-Inhalt, je nach Typ. */
  content: string;
  createdAt: number;
}

/** Ein hochgeladenes Dokument für RAG-Kontext. */
export interface BookwriterDocument {
  id: string;
  projectId: string;
  title: string;
  fileType: string;
  fileName: string;
  content: string;
  chunkCount: number;
  createdAt: number;
}

/** Eine Nutzerentscheidung. */
export interface BookwriterApproval {
  id: string;
  runId: string;
  phase: BookwriterPhase;
  decision: "approved" | "rejected" | "regenerate";
  note: string | null;
  createdAt: number;
}

/** Qualitätskategorie. */
export type QualityDimension =
  | "kohaerenz"
  | "originalitaet"
  | "stilgleichheit"
  | "wiederholungsgrad"
  | "informationsdichte"
  | "kapitelqualitaet"
  | "exportbereitschaft";

export const DIMENSION_LABELS: Record<QualityDimension, string> = {
  kohaerenz: "Kohärenz",
  originalitaet: "Originalität",
  stilgleichheit: "Stilgleichheit",
  wiederholungsgrad: "Wiederholungsgrad",
  informationsdichte: "Informationsdichte",
  kapitelqualitaet: "Kapitelqualität",
  exportbereitschaft: "Exportbereitschaft",
};

/** Ampelstufe. */
export type QualityLevel = "green" | "yellow" | "red";

/** Ein Qualitätswert. */
export interface QualityScore {
  id: string;
  runId: string;
  dimension: QualityDimension;
  level: QualityLevel;
  /** 0..100 */
  score: number;
  details: string | null;
}

/** Ein Kapitel in der Gliederung. */
export interface OutlineChapter {
  title: string;
  goal: string;
  conflict: string;
  outcome: string;
  estimatedWords: number;
  pov: string;
  research: string[];
  subchapters: string[];
}

/** Die vollständige Gliederung. */
export interface BookOutline {
  chapters: OutlineChapter[];
  totalWords: number;
}

/** Konzept-Artefakt. */
export interface BookConcept {
  titles: string[];
  subtitles: string[];
  positions: string[];
  persona: string;
  pitch: string;
  /** Klappentext grob. */
  backmatter: string;
  promises: string[];
  genreFit: string;
  outlineProposals: Array<{ title: string; chapters: string[] }>;
}

/** Briefing-Eingabe. */
export interface BookBriefing {
  genre: BookGenre;
  targetAudience: string;
  tone: string;
  chapterCount: number;
  wordsPerChapter: number;
  idea: string;
  uniqueAngle: string;
  corePromise: string;
  kdpTarget: KdpTarget;
  language: BookLanguage;
  styleReferences: string;
  customOutline: string | null;
}

/** KDP-Metadaten. */
export interface KdpMetadata {
  title: string;
  subtitle: string;
  blurbVariants: string[];
  shortDescription: string;
  keywords: string[];
  categories: string[];
  authorBio: string;
  seriesIdea: string | null;
  marketingNotes: string | null;
}
