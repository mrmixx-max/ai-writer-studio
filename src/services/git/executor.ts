// Git-Executor: Brücke zum Rust-Backend (`run_git`-Kommando in src-tauri/src/git.rs).
//
// Die eigentliche Ausführung ist austauschbar (runner), damit die Parsing- und
// Konflikt-Logik in Vitest ohne Tauri-Backend getestet werden kann.
import { invoke } from "@tauri-apps/api/core";
import type { GitResult, GitStatusEntry } from "./types";

/** Signatur des plattformabhängigen Git-Laufs. */
export type GitRunner = (cwd: string, args: string[]) => Promise<GitResult>;

/** Standard-Runner: delegiert an das Tauri-Backend. */
export const tauriRunner: GitRunner = async (cwd, args) =>
  invoke<GitResult>("run_git", { cwd, args });

/** Aktiver Runner (tests können ihn austauschen). */
let runner: GitRunner = tauriRunner;

/** Runner austauschen (nur für Tests). */
export function setGitRunner(r: GitRunner): void {
  runner = r;
}

/** Fehlerklasse für Git-Läufe mit nicht-erfolgreichem Exit-Code. */
export class GitError extends Error {
  constructor(
    public readonly result: GitResult,
    public readonly args: string[],
  ) {
    super(`git ${args.join(" ")} fehlgeschlagen (Code ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`);
    this.name = "GitError";
  }
}

/**
 * Führt `git <args>` im Verzeichnis `cwd` aus.
 * Wirft GitError bei Exit-Code != 0.
 */
export async function git(cwd: string, ...args: string[]): Promise<GitResult> {
  const res = await runner(cwd, args);
  if (res.code !== 0) throw new GitError(res, args);
  return res;
}

/**
 * Wie git(), ignoriert aber definierte "leere" Ergebnisse:
 * Commit ohne Änderungen (1), Pull ohne Merge-Kandidaten usw.
 */
export async function gitAllowFail(cwd: string, ...args: string[]): Promise<GitResult> {
  return runner(cwd, args);
}

/** Liefert die git-Version vom Backend (Fehler → null). */
export async function gitVersion(): Promise<string | null> {
  try {
    return await invoke<string>("git_version");
  } catch {
    return null;
  }
}

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Parst `git status --porcelain=v1 -b` in strukturierte Einträge.
 * Exportiert für Unit-Tests (kein Backend nötig).
 */
export function parsePorcelainStatus(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  for (const raw of output.split("\n")) {
    if (!raw || raw.startsWith("##")) continue;
    const line = raw.replace(/\r$/, "");
    if (line.length < 4) continue;
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    const path = line.slice(3);
    const statusCode = indexStatus + worktreeStatus;
    entries.push({
      path,
      indexStatus,
      worktreeStatus,
      statusCode,
      conflicted: CONFLICT_CODES.has(statusCode),
    });
  }
  return entries;
}

/** Nur die konfliktbehafteten Dateien aus einem Status-Output. */
export function conflictedPaths(output: string): string[] {
  return parsePorcelainStatus(output)
    .filter((e) => e.conflicted)
    .map((e) => e.path);
}
