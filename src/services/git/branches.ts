// Branching: Entwurf → Endversion-Workflow für Manuskripte.
import { git, gitAllowFail } from "./executor";
import { currentBranch } from "./repo";
import { WORKFLOW_BRANCHES } from "./conflicts";
import type { GitResult } from "./types";

/** Erstellt einen Branch und wechselt ggf. dorthin. */
export async function createBranch(dir: string, name: string, switchTo = true): Promise<void> {
  await git(dir, "branch", name);
  if (switchTo) await git(dir, "switch", name);
}

/** Wechselt den Branch (checked out auch Dateiinhalte neu). */
export async function switchBranch(dir: string, name: string): Promise<void> {
  await git(dir, "switch", name);
}

/** Löscht einen Branch (nur wenn gemerged; -D via force). */
export async function deleteBranch(dir: string, name: string, force = false): Promise<GitResult> {
  return gitAllowFail(dir, "branch", force ? "-D" : "-d", name);
}

/**
 * Merged `source` in den aktuellen Branch. Liefert das rohe Ergebnis —
 * bei Konflikten (code != 0) wird der Merge nicht automatisch abgeschlossen;
 * siehe conflicts.resolveConflicts().
 */
export async function mergeBranch(dir: string, source: string): Promise<GitResult> {
  return gitAllowFail(dir, "merge", "--no-ff", "--no-edit", source);
}

/** Stellt sicher, dass der Arbeitsbranch existiert und wechselt dorthin. */
export async function openDraftBranch(dir: string): Promise<string> {
  return ensureBranch(dir, WORKFLOW_BRANCHES.draft);
}

/** Fördert den aktuellen Stand in den Endversion-Branch (Merge von dort aus). */
export async function promoteToFinal(dir: string): Promise<GitResult> {
  const current = (await currentBranch(dir)) ?? "main";
  await git(dir, "switch", WORKFLOW_BRANCHES.final).catch(async () => {
    await createBranch(dir, WORKFLOW_BRANCHES.final, true);
  });
  return gitAllowFail(dir, "merge", "--no-ff", "--no-edit", current);
}

async function ensureBranch(dir: string, name: string): Promise<string> {
  const cur = await currentBranch(dir);
  if (cur === name) return name;
  const res = await gitAllowFail(dir, "switch", name);
  if (res.code !== 0) {
    await createBranch(dir, name, true);
  }
  return name;
}
