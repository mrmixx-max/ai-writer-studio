// Snapshot-Versionierung — Typen.

/** Kopf eines Snapshots. */
export interface Snapshot {
  id: string;
  projectId: string;
  /** Frei wählbarer Name, etwa "Rohfassung komplett" oder "KDP-final". */
  name: string;
  note: string | null;
  /** Projektmetadaten zum Zeitpunkt der Aufnahme. */
  meta: SnapshotMeta;
  chapterCount: number;
  wordCount: number;
  /** Verweis auf den Preflight-Bericht, sofern vor dem Export erstellt. */
  preflightReportId: string | null;
  createdAt: number;
}

/** Metadaten, die mit dem Snapshot festgehalten werden. */
export interface SnapshotMeta {
  projectName: string;
  /** Titel der Kapitel in ihrer Reihenfolge — für den Strukturvergleich. */
  chapterTitles: string[];
  /** Wie der Snapshot entstanden ist. */
  origin: "manual" | "before-export" | "bookwriter";
  /** Schema-Version zur Zeit der Aufnahme, für spätere Wiederherstellung. */
  schemaVersion: number;
}

/** Ein Kapitel im Snapshot. */
export interface SnapshotItem {
  id: string;
  snapshotId: string;
  chapterId: string;
  title: string;
  /** Vollständiger TipTap-Inhalt. */
  content: string;
  orderIndex: number;
  wordCount: number;
}

/** Art einer Änderung zwischen zwei Snapshots. */
export type DiffKind = "added" | "removed" | "renamed" | "changed" | "moved" | "unchanged";

/** Eine einzelne Änderung. */
export interface DiffEntry {
  kind: DiffKind;
  chapterId: string;
  /** Titel im älteren Snapshot, null bei Neuanlage. */
  titleBefore: string | null;
  /** Titel im neueren Snapshot, null bei Löschung. */
  titleAfter: string | null;
  wordsBefore: number;
  wordsAfter: number;
  /** Differenz der Wortzahl, negativ bei Kürzung. */
  wordDelta: number;
  /** Verschiebung der Position, sofern verschoben. */
  positionBefore: number | null;
  positionAfter: number | null;
}

/** Vergleich zweier Snapshots. */
export interface SnapshotDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  entries: DiffEntry[];
  /** Klartext-Zusammenfassung der Strukturänderung. */
  structureSummary: string;
  /** KI-Zusammenfassung der Ton-/Stilveränderung, sofern erzeugt. */
  toneSummary: string | null;
  /** Kennzahlen des Vergleichs. */
  totals: {
    added: number;
    removed: number;
    renamed: number;
    changed: number;
    moved: number;
    unchanged: number;
    wordDelta: number;
  };
}

/** Ergebnis einer Wiederherstellung. */
export interface RestoreResult {
  /** Kapitel, die inhaltlich zurückgesetzt wurden. */
  restored: number;
  /** Kapitel, die neu angelegt wurden, weil sie fehlten. */
  recreated: number;
  /** Kapitel, die es im Snapshot nicht gab. */
  extra: number;
  /** Was mit den überzähligen Kapiteln geschehen ist. */
  extraHandling: "kept" | "deleted";
  /** Snapshot, der vor der Wiederherstellung als Sicherung angelegt wurde. */
  safetySnapshotId: string | null;
}

/** Optionen für die Wiederherstellung. */
export interface RestoreOptions {
  /**
   * Kapitel löschen, die im Snapshot nicht enthalten sind.
   * Standard false — Löschen ist die gefährlichere Wahl und braucht
   * eine ausdrückliche Entscheidung.
   */
  deleteExtra?: boolean;
  /**
   * Vor der Wiederherstellung einen Sicherungs-Snapshot anlegen.
   * Standard true: Ein Restore ist die einzige Aktion im Programm, die
   * Text vernichten kann. Ohne Netz darf sie nicht laufen.
   */
  createSafetySnapshot?: boolean;
}
