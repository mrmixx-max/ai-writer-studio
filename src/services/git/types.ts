// Git-Service: Typen für Status, Log, Branches, Konflikte und Diffs.

/** Eine Datei aus `git status --porcelain=v1`. */
export interface GitStatusEntry {
  /** Pfad relativ zum Repo-Root. */
  path: string;
  /** Index-Status (X): M, A, D, R, C, U, ?, ! */
  indexStatus: string;
  /** Working-Tree-Status (Y): M, D, U, ?, ! */
  worktreeStatus: string;
  /** Beide Status kombiniert, z.B. "M ", " M", "??", "UU". */
  statusCode: string;
  /** Datei ist Teil eines Merge-Konflikts (z.B. UU, AA, DD). */
  conflicted: boolean;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  /** UNIX-Sekunden. */
  timestamp: number;
  subject: string;
  refs: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export type ConflictStrategy = "ours" | "theirs" | "both" | "manual";

export interface GitConflict {
  path: string;
  strategy: ConflictStrategy;
}

/** Ergebnis eines Git-Laufs. */
export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Eine Zeile im Text-Diff für die Visualisierung. */
export interface DiffLine {
  type: "add" | "remove" | "same" | "info";
  /** Zeileninhalt ohne Vorzeichen. */
  text: string;
  /** Zeilennummer alt (falls vorhanden). */
  oldNo?: number;
  /** Zeilennummer neu (falls vorhanden). */
  newNo?: number;
}

/** Diff-Statistik. */
export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}
