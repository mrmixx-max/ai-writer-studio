// Konflikt-Erkennung und -Auflösung für Manuskript-Merges.
//
// Konfliktdateien enthalten Git-Marker:
//   <<<<<<< ours
//   ...
//   =======
//   ...
//   >>>>>>> theirs
// Die Auflösung erfolgt dateibasiert (ours / theirs / both) oder manuell.

import type { ConflictStrategy, GitConflict } from "./types";

/** Ergebnis des Parsens einer Konfliktdatei. */
export interface ParsedConflict {
  /** Abschnitte vor/nach den Markern bleiben unverändert. */
  segments: ConflictSegment[];
}

export interface ConflictSegment {
  before: string;
  ours: string;
  theirs: string;
  after: string;
}

/**
 * Parst eine Datei mit Git-Konfliktmarkern in Segmente.
 * Rein funktional — gut testbar ohne Dateisystem.
 */
export function parseConflicts(content: string): ParsedConflict {
  const lines = content.split("\n");
  const segments: ConflictSegment[] = [];
  let before: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const ours: string[] = [];
      const theirs: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("=======")) {
        ours.push(lines[i]);
        i++;
      }
      i++; // überspringe =======
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        theirs.push(lines[i]);
        i++;
      }
      i++; // überspringe >>>>>>>
      segments.push({
        before: before.join("\n"),
        ours: ours.join("\n"),
        theirs: theirs.join("\n"),
        after: "", // wird beim nächsten Segment bzw. am Ende gesetzt
      });
      before = [];
    } else {
      before.push(lines[i]);
      i++;
    }
  }
  const rest = before.join("\n");
  if (segments.length > 0) {
    segments[segments.length - 1].after = rest;
  }
  return { segments };
}

/** Löst alle Konfliktmarkern einer Datei gemäß Strategie auf (pure). */
export function resolveConflictContent(content: string, strategy: ConflictStrategy): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const ours: string[] = [];
      const theirs: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("=======")) {
        ours.push(lines[i]);
        i++;
      }
      i++; // überspringe =======
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        theirs.push(lines[i]);
        i++;
      }
      i++; // überspringe >>>>>>>
      if (strategy === "ours") out.push(...ours);
      else if (strategy === "theirs") out.push(...theirs);
      else out.push(...ours, ...theirs); // "both": Texte verketten
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

/** Zählt Konfliktblöcke in einer Datei. */
export function countConflicts(content: string): number {
  return parseConflicts(content).segments.length;
}

/**
 * Löst ALLE Konflikte eines Merge gemäß einer Strategie:
 * markiert aufgelöste Dateien (git add) und schließt den Merge ab.
 * strategy="manual" löst nichts auf — es werden nur die Konflikte zurückgegeben.
 */
export async function resolveConflicts(
  dir: string,
  conflicts: GitConflict[],
  strategy: ConflictStrategy,
  readFile: (dir: string, path: string) => Promise<string>,
  writeFile: (dir: string, path: string, content: string) => Promise<void>,
): Promise<void> {
  if (strategy === "manual" || conflicts.length === 0) return;
  for (const c of conflicts) {
    if (c.strategy !== "manual") continue; // bereits durch caller behandelt
    const content = await readFile(dir, c.path);
    await writeFile(dir, c.path, resolveConflictContent(content, strategy));
  }
  await markResolved(dir, conflicts.map((c) => c.path));
  await finishMerge(dir);
}

/** Markiert Dateien als aufgelöst (git add). */
export async function markResolved(dir: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { git } = await import("./executor");
  await git(dir, "add", "--", ...paths);
}

/** Schließt einen laufenden Merge ab (Commit). */
export async function finishMerge(dir: string): Promise<void> {
  const { git } = await import("./executor");
  await git(dir, "commit", "--no-edit");
}

/** Bricht einen laufenden Merge ab und stellt den Vormerge-Zustand her. */
export async function abortMerge(dir: string): Promise<void> {
  const { gitAllowFail } = await import("./executor");
  await gitAllowFail(dir, "merge", "--abort");
}

/**
 * Strategie-Voreinstellungen für den Autorenworkflow:
 *   entwurf   → Arbeitsbranch für Rohfassungen
 *   endversion → stabile, freigegebene Fassung
 */
export const WORKFLOW_BRANCHES = {
  draft: "entwurf",
  final: "endversion",
} as const;
