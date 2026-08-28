// React-Hook: Git-Status und -Aktionen für die Editor-Sidebar.
import { useCallback, useEffect, useState } from "react";
import {
  isRepo, getStatus, getLog, currentBranch, commitAll, push, pull,
  listBranches, createBranch, switchBranch, mergeBranch, openDraftBranch, promoteToFinal,
  abortMerge, gitVersion,
  type GitBranch, type GitLogEntry, type GitStatusEntry, type ConflictStrategy,
} from "./index";

export interface UseGitResult {
  available: boolean;
  repoReady: boolean;
  branch: string | null;
  status: GitStatusEntry[];
  log: GitLogEntry[];
  branches: GitBranch[];
  conflicts: string[];
  busy: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  commit: (message: string) => Promise<boolean>;
  doPush: () => Promise<void>;
  doPull: () => Promise<void>;
  newBranch: (name: string) => Promise<void>;
  checkout: (name: string) => Promise<void>;
  doMerge: (source: string) => Promise<void>;
  openDraft: () => Promise<void>;
  promoteFinal: () => Promise<void>;
  resolveAll: (strategy: ConflictStrategy) => Promise<void>;
  abort: () => Promise<void>;
}

/** Hook für die Git-Sidebar: Status polling + alle Aktionen. */
export function useGit(dir: string | null): UseGitResult {
  const [available, setAvailable] = useState(false);
  const [repoReady, setRepoReady] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [status, setStatus] = useState<GitStatusEntry[]>([]);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    gitVersion().then((v) => setAvailable(!!v));
  }, []);

  const refresh = useCallback(async () => {
    if (!dir) return;
    try {
      const ready = await isRepo(dir);
      setRepoReady(ready);
      if (!ready) return;
      const [statusRes, logRes, branchRes, branchList] = await Promise.all([
        getStatus(dir), getLog(dir, 30), currentBranch(dir), listBranches(dir),
      ]);
      setStatus(statusRes.filter((e) => e.statusCode !== "!!"));
      setLog(logRes);
      setBranch(branchRes);
      setBranches(branchList);
      setConflicts(statusRes.filter((e) => e.conflicted).map((e) => e.path));
    } catch (e) {
      setLastError(String(e));
    }
  }, [dir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setLastError(null);
    try {
      return await fn();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [refresh]);

  const init = useCallback(async () => {
    if (!dir) return;
    await run(async () => {
      const { initRepo } = await import("./repo");
      await initRepo(dir);
      await commitAll(dir, "Projekt initialisiert (AI Writer Studio)");
    });
  }, [dir, run]);

  const commit = useCallback(async (message: string) => {
    if (!dir) return false;
    return (await run(() => commitAll(dir, message))) ?? false;
  }, [dir, run]);

  const resolveAll = useCallback(async (strategy: ConflictStrategy) => {
    if (!dir) return;
    await run(async () => {
      const files = conflicts;
      if (strategy === "manual" || files.length === 0) return;
      const { resolveConflictContent, markResolved, finishMerge } = await import("./conflicts");
      // Backend-Datei-IO über Tauri-FS-Plugin
      const fs = await import("@tauri-apps/plugin-fs");
      for (const p of files) {
        const content = await fs.readTextFile(`${dir}/${p}`);
        await fs.writeTextFile(`${dir}/${p}`, resolveConflictContent(content, strategy));
      }
      await markResolved(dir, files);
      await finishMerge(dir);
    });
  }, [dir, conflicts, run]);

  const abort = useCallback(async () => {
    if (!dir) return;
    await run(() => abortMerge(dir));
  }, [dir, run]);

  return {
    available,
    repoReady,
    branch,
    status,
    log,
    branches,
    conflicts,
    busy,
    lastError,
    refresh,
    init,
    commit,
    doPush: async () => { if (dir) await run(() => push(dir)); },
    doPull: async () => { if (dir) await run(() => pull(dir)); },
    newBranch: async (name) => { if (dir) await run(() => createBranch(dir, name)); },
    checkout: async (name) => { if (dir) await run(() => switchBranch(dir, name)); },
    doMerge: async (source) => { if (dir) await run(() => mergeBranch(dir, source)); },
    openDraft: async () => { if (dir) await run(() => openDraftBranch(dir)); },
    promoteFinal: async () => { if (dir) await run(() => promoteToFinal(dir)); },
    resolveAll,
    abort,
  };
}
