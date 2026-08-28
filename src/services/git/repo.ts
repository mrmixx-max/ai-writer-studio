// Git-Repository-Layer: Init, Clone, Status, Log.
import { git, gitAllowFail, parsePorcelainStatus } from "./executor";
import type { GitBranch, GitLogEntry, GitResult, GitStatusEntry } from "./types";

/** Prüft, ob `dir` ein Git-Repository ist (schneller Status-Lauf). */
export async function isRepo(dir: string): Promise<boolean> {
  const res = await gitAllowFail(dir, "rev-parse", "--is-inside-work-tree");
  return res.code === 0 && res.stdout.trim() === "true";
}

/** Initialisiert ein neues Repository (inkl. initialem Commit-Basiszustand). */
export async function initRepo(dir: string): Promise<void> {
  await git(dir, "init");
  // Sinnvolle Defaults für Autorenprojekte (keine globalen Einstellungen nötig)
  await git(dir, "config", "core.autocrlf", "false");
  await git(dir, "config", "core.quotepath", "false");
}

/**
 * Klont ein Repository nach `targetDir`.
 * Private Remotes nutzen die Git-Credential-Verwaltung des Nutzers.
 */
export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  await git(".", "clone", url, targetDir);
}

/** Sammelstatus: geänderte/untracked/konfliktbehaftete Dateien. */
export async function getStatus(dir: string): Promise<GitStatusEntry[]> {
  const res = await git(dir, "status", "--porcelain=v1", "-b");
  return parsePorcelainStatus(res.stdout);
}

/** Aktueller Branch-Name (leer = detached / kein Repo). */
export async function currentBranch(dir: string): Promise<string | null> {
  const res = await gitAllowFail(dir, "rev-parse", "--abbrev-ref", "HEAD");
  if (res.code !== 0) return null;
  const name = res.stdout.trim();
  return name === "HEAD" ? null : name;
}

/** Listet lokale + Remote-Branches mit Ahead/Behind. */
export async function listBranches(dir: string): Promise<GitBranch[]> {
  const res = await git(
    dir,
    "for-each-ref",
    "--format=%(refname:short)|%(upstream:short)|%(upstream:track)|%(HEAD)",
    "refs/heads",
  );
  return res.stdout
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const [name, upstream = "", track = "", head = ""] = l.split("|");
      let ahead = 0;
      let behind = 0;
      const aheadMatch = track.match(/ahead (\d+)/);
      const behindMatch = track.match(/behind (\d+)/);
      if (aheadMatch) ahead = Number(aheadMatch[1]);
      if (behindMatch) behind = Number(behindMatch[1]);
      return { name, current: head.trim() === "*", upstream: upstream || null, ahead, behind };
    });
}

/** Commit-Historie (neueste zuerst). */
export async function getLog(dir: string, limit = 50): Promise<GitLogEntry[]> {
  const res = await gitAllowFail(
    dir,
    "log",
    `--pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D`,
    `-n${limit}`,
  );
  if (res.code !== 0) return [];
  return res.stdout
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const [hash, shortHash, author, ts, subject, refs = ""] = l.split("\x1f");
      return { hash, shortHash, author, timestamp: Number(ts), subject, refs };
    });
}

/** Committet alle Änderungen mit Message; false wenn nichts zu committen. */
export async function commitAll(dir: string, message: string): Promise<boolean> {
  const status = await git(dir, "status", "--porcelain=v1");
  if (!status.stdout.trim()) return false;
  await git(dir, "add", "-A");
  await git(dir, "commit", "-m", message);
  return true;
}

/** Push mit optionaler Upstream-Setzung. */
export async function push(dir: string): Promise<GitResult> {
  const branch = (await currentBranch(dir)) ?? "main";
  return gitAllowFail(dir, "push", "-u", "origin", branch);
}

/**
 * Pull (merge-basiert, ohne Rebase). Liefert das rohe Ergebnis —
 * Konflikte werden NICHT automatisch aufgelöst, sondern via
 * `detectConflicts` + `resolveConflict` (siehe conflicts.ts) behandelt.
 */
export async function pull(dir: string): Promise<GitResult> {
  return gitAllowFail(dir, "pull", "--no-rebase", "--no-edit");
}
