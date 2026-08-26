// Snapshot-Versionierung — Typen.

/** Ein Snapshot des gesamten Projektzustands. */
export interface Snapshot {
  id: string;
  projectId: string;
  /** Frei wählbarer Name, z. B. "KDP-final". */
  name: string;
  /** Notiz des Autors. */
  note: string | null;
  /** Projektmetadaten zum Zeitpunkt des Snapshots als JSON (SnapshotMeta). */
  meta: string;
  chapterCount: number;
  wordCount: number;
  /** ID des zugehörigen Preflight-Reports, falls vor dem Snapshot geprüft wurde. */
  preflightReportId: string | null;
  createdAt: number;
}

/** In `Snapshot.meta` serialisierte Projektmetadaten. */
export interface SnapshotMeta {
  projectName: string;
  chapterTitles: string[];
  /** Preflight-Kurzstatus zum Zeitpunkt der Erstellung. */
  preflight: {
    blockerCount: number;
    warningCount: number;
    hintCount: number;
  } | null;
  /** Stilmetriken über das ganze Projekt, falls berechnet. */
  metrics: Record<string, number> | null;
}

/** Ein einzelnes Kapitel innerhalb eines Snapshots. */
export interface SnapshotItem {
  id: string;
  snapshotId: string;
  /** Ursprüngliche Kapitel-ID (kann nach Restore fehlen). */
  chapterId: string;
  title: string;
  /** TipTap-JSON des Kapitelinhalts. */
  content: string;
  orderIndex: number;
  wordCount: number;
}

/** Art einer Änderung zwischen zwei Snapshots. */
export type DiffChangeType = "added" | "removed" | "modified" | "reordered" | "renamed";

/** Diff-Eintrag für ein Kapitel zwischen zwei Snapshots. */
export interface SnapshotDiffEntry {
  chapterId: string;
  title: string;
  changeType: DiffChangeType;
  wordsBefore: number;
  wordsAfter: number;
  wordDelta: number;
  /** Grobe Ähnlichkeit 0..1 (1 = identisch). */
  similarity: number;
}

/** Vollständiger Vergleich zweier Snapshots. */
export interface SnapshotDiff {
  id: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  /** JSON-Array von SnapshotDiffEntry. */
  entries: string;
  /** Strukturelle Zusammenfassung, rein rechnerisch. */
  structureSummary: string;
  /** KI-Zusammenfassung der Ton-/Stilveränderung; null wenn kein Modell verfügbar war. */
  toneSummary: string | null;
  createdAt: number;
}

/** Ergebnis eines Restore-Vorgangs. */
export interface RestoreResult {
  restoredChapters: number;
  /** Snapshot, der vor dem Restore automatisch als Sicherung erstellt wurde. */
  backupSnapshotId: string;
}
