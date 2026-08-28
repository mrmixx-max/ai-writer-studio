// KI-Gedächtnis: Bereinigung — alte, unbenutzte oder schwache Einträge löschen.
import { listMemory } from "./store";
import { getDb, persist } from "@/services/db";
import type { MemoryEntry, MemoryKind } from "./types";

export interface CleanupOptions {
  /** Einträge älter als X Tage löschen (0 = nicht nach Alter filtern). */
  olderThanDays?: number;
  /** Nur Einträge dieser Wichtigkeit oder niedriger löschen (1–5). */
  importanceAtMost?: number;
  /** Nur automatisch extrahierte Einträge löschen. */
  autoOnly?: boolean;
  /** Nur Einträge, die nie in einem Prompt benutzt wurden (last_used_at IS NULL). */
  neverUsedOnly?: boolean;
  /** Auf bestimmte Art(en) beschränken. */
  kinds?: MemoryKind[];
}

export interface CleanupPreview {
  entries: MemoryEntry[];
  count: number;
}

/** Vorschau: welche Einträge würden gelöscht (ohne zu löschen). */
export function previewCleanup(opts: CleanupOptions): CleanupPreview {
  const all = listMemory();
  const cutoff = opts.olderThanDays && opts.olderThanDays > 0
    ? Date.now() - opts.olderThanDays * 86_400_000
    : null;
  const entries = all.filter((m) => {
    if (cutoff !== null && m.updatedAt >= cutoff) return false;
    if (opts.importanceAtMost !== undefined && m.importance > opts.importanceAtMost) return false;
    if (opts.autoOnly && m.source !== "auto") return false;
    if (opts.neverUsedOnly && m.lastUsedAt !== null) return false;
    if (opts.kinds?.length && !opts.kinds.includes(m.kind)) return false;
    return true;
  });
  return { entries, count: entries.length };
}

/** Führt die Bereinigung aus und gibt die Anzahl gelöschter Einträge zurück. */
export async function runCleanup(opts: CleanupOptions): Promise<number> {
  const { entries } = previewCleanup(opts);
  if (!entries.length) return 0;
  const db = getDb();
  const placeholders = entries.map(() => "?").join(",");
  db.run(`DELETE FROM ki_memory_entries WHERE id IN (${placeholders})`, entries.map((e) => e.id));
  await persist();
  return entries.length;
}

/** Löscht ALLE Erinnerungen eines Projekts (bzw. alle, wenn projectId null). */
export async function clearAllMemory(projectId?: string | null): Promise<number> {
  const db = getDb();
  const all = projectId ? listMemory({ projectId }) : listMemory();
  if (!all.length) return 0;
  const placeholders = all.map(() => "?").join(",");
  db.run(`DELETE FROM ki_memory_entries WHERE id IN (${placeholders})`, all.map((e) => e.id));
  await persist();
  return all.length;
}
