// KI-Gedächtnis: Typen für Langzeit-Erinnerungen über Sessions hinweg.
export type MemoryKind = "charakter" | "ort" | "fakt" | "gespraech" | "stil";
export type MemorySource = "auto" | "manuell";

export interface MemoryEntry {
  id: string;
  projectId: string | null;
  chapterId: string | null;
  sessionId: string | null;
  kind: MemoryKind;
  title: string;
  content: string;
  /** 1 (nebensächlich) … 5 (essentiell) — wichtigere Einträge werden zuerst in den Prompt aufgenommen. */
  importance: number;
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface MemoryContextSuggestion {
  entry: MemoryEntry;
  reason: string;
  score: number;
}

export type MemoryExportFormat = "json" | "markdown";

export interface MemoryStats {
  total: number;
  byKind: Record<MemoryKind, number>;
  oldest: number | null;
  newest: number | null;
  auto: number;
  manual: number;
}
