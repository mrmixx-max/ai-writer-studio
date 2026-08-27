// Projektwissen / RAG — Typen.

/** Art der Wissensquelle. */
export type KnowledgeSourceType =
  | "chapter"
  | "fragment"
  | "character"
  | "location"
  | "note"
  | "reference";

/**
 * Deutsche Bezeichnungen der Quellentypen für die Oberfläche.
 * Hier statt in der Komponente, damit Listen und Filter dieselbe
 * Benennung verwenden.
 */
export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  chapter: "Kapitel",
  fragment: "Fragment",
  character: "Figur",
  location: "Ort",
  note: "Notiz",
  reference: "Referenz",
};

/** Indexierungsstatus einer Quelle. */
export type KnowledgeIndexStatus = "indexed" | "stale" | "failed" | "pending";

/** Eine indizierbare Wissensquelle innerhalb eines Projekts. */
export interface KnowledgeSource {
  id: string;
  projectId: string;
  sourceType: KnowledgeSourceType;
  /** Verweis auf die Ursprungsentität (chapter.id, fragment.id …) — null bei manuellen Referenztexten. */
  refId: string | null;
  title: string;
  /** Volltext der Quelle (bei Kapiteln der extrahierte Plaintext). */
  content: string;
  /** Komma-separierte Tags. */
  tags: string | null;
  status: KnowledgeIndexStatus;
  /** Hash des Inhalts zur Stale-Erkennung. */
  contentHash: string;
  /** Fehlermeldung bei status="failed". */
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  indexedAt: number | null;
}

/** Ein Chunk einer Wissensquelle inklusive Embedding. */
export interface KnowledgeChunk {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  /** Position innerhalb der Quelle (0-basiert). */
  chunkIndex: number;
  text: string;
  /** Überschriften-Pfad, z. B. "Kapitel 3 › Szene 2". */
  headingPath: string | null;
  tokenCount: number;
  /** JSON-Array von Floats; null wenn nur lexikalisch indiziert. */
  embedding: string | null;
  /** Name des Embedding-Modells, z. B. "nomic-embed-text". */
  embeddingModel: string | null;
  /** Zur lexikalischen Suche vorberechnete Term-Frequenzen als JSON. */
  termFreq: string | null;
  createdAt: number;
}

/** Status eines Indexierungsjobs. */
export type IndexJobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** Hintergrundjob zur Indexierung. */
export interface KnowledgeIndexJob {
  id: string;
  projectId: string;
  /** null = ganzes Projekt, sonst einzelne Quelle. */
  sourceId: string | null;
  status: IndexJobStatus;
  /** 0..100 */
  progress: number;
  totalSources: number;
  processedSources: number;
  totalChunks: number;
  /** Verwendete Embedding-Strategie. */
  strategy: RetrievalStrategy;
  message: string | null;
  startedAt: number;
  finishedAt: number | null;
}

/** Retrieval-Strategie. */
export type RetrievalStrategy = "embedding" | "lexical" | "hybrid";

/** Suchmodus im UI. */
export type SearchMode = "semantic" | "exact" | "hybrid";

/** Ein Treffer aus dem Retrieval. */
export interface RetrievalHit {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  headingPath: string | null;
  text: string;
  /** 0..1, höher = relevanter. */
  score: number;
  /** Welche Strategie diesen Treffer geliefert hat. */
  via: RetrievalStrategy;
}

/** Ergebnis einer Retrieval-Anfrage inkl. Diagnose. */
export interface RetrievalResult {
  hits: RetrievalHit[];
  strategyUsed: RetrievalStrategy;
  /** true wenn kein Embedding-Modell erreichbar war und lexikalisch gefallbackt wurde. */
  degraded: boolean;
  /** Klartext-Hinweis für die UI, z. B. "Ollama nicht erreichbar – lexikalische Suche verwendet." */
  notice: string | null;
  totalChunksSearched: number;
}
