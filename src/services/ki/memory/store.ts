// KI-Gedächtnis: Persistenz in SQLite (ki_memory_entries, Migration 017).
import { getDb, persist } from "@/services/db";
import type { SqlValue } from "sql.js";
import type { MemoryEntry, MemoryKind, MemoryStats } from "./types";

const KINDS: MemoryKind[] = ["charakter", "ort", "fakt", "gespraech", "stil"];

function uid(): string {
  return "mem_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rowToEntry(row: unknown[]): MemoryEntry {
  return {
    id: String(row[0]),
    projectId: row[1] === null ? null : String(row[1]),
    chapterId: row[2] === null ? null : String(row[2]),
    sessionId: row[3] === null ? null : String(row[3]),
    kind: row[4] as MemoryKind,
    title: String(row[5]),
    content: String(row[6]),
    importance: Number(row[7]),
    source: row[8] as MemoryEntry["source"],
    createdAt: Number(row[9]),
    updatedAt: Number(row[10]),
    lastUsedAt: row[11] === null ? null : Number(row[11]),
  };
}

const COLS = "id, project_id, chapter_id, session_id, kind, title, content, importance, source, created_at, updated_at, last_used_at";

/** Speichert (oder aktualisiert) eine Erinnerung. Duplikate (gleicher Titel+Kind+Projekt) werden gemerged. */
export async function saveMemory(
  entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt" | "lastUsedAt"> & { id?: string },
): Promise<MemoryEntry> {
  const db = getDb();
  const now = Date.now();
  // Duplikat-Check: gleicher Titel + Kind im selben Projekt -> Inhalt anreichern statt neu anlegen
  const dup = db.exec(
    `SELECT id, content, importance FROM ki_memory_entries
     WHERE kind = ? AND title = ? AND COALESCE(project_id, '') = COALESCE(?, '') LIMIT 1`,
    [entry.kind, entry.title, entry.projectId ?? null],
  );
  if (dup.length) {
    const [id, oldContent, oldImp] = dup[0].values[0];
    const content = String(oldContent) === entry.content ? String(oldContent) : `${oldContent}\n${entry.content}`;
    const importance = Math.max(Number(oldImp), entry.importance);
    db.run(
      `UPDATE ki_memory_entries SET content = ?, importance = ?, updated_at = ? WHERE id = ?`,
      [content.slice(0, 4000), importance, now, String(id)],
    );
    await persist();
    return getMemoryById(String(id))!;
  }

  const mem: MemoryEntry = {
    id: entry.id ?? uid(),
    projectId: entry.projectId ?? null,
    chapterId: entry.chapterId ?? null,
    sessionId: entry.sessionId ?? null,
    kind: entry.kind,
    title: entry.title.slice(0, 200),
    content: entry.content.slice(0, 4000),
    importance: Math.min(5, Math.max(1, Math.round(entry.importance))),
    source: entry.source,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };
  db.run(
    `INSERT INTO ki_memory_entries (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [mem.id, mem.projectId, mem.chapterId, mem.sessionId, mem.kind, mem.title, mem.content,
     mem.importance, mem.source, mem.createdAt, mem.updatedAt, mem.lastUsedAt],
  );
  await persist();
  return mem;
}

export function getMemoryById(id: string): MemoryEntry | null {
  const res = getDb().exec(`SELECT ${COLS} FROM ki_memory_entries WHERE id = ?`, [id]);
  return res.length ? rowToEntry(res[0].values[0]) : null;
}

/** Alle Erinnerungen, optional gefiltert. */
export function listMemory(opts: { projectId?: string | null; chapterId?: string | null; kind?: MemoryKind } = {}): MemoryEntry[] {
  const clauses: string[] = [];
  const args: SqlValue[] = [];
  if (opts.projectId !== undefined) {
    clauses.push("COALESCE(project_id, '') = COALESCE(?, '')");
    args.push(opts.projectId ?? null);
  }
  if (opts.chapterId !== undefined) {
    clauses.push("COALESCE(chapter_id, '') = COALESCE(?, '')");
    args.push(opts.chapterId ?? null);
  }
  if (opts.kind) {
    clauses.push("kind = ?");
    args.push(opts.kind);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const res = getDb().exec(
    `SELECT ${COLS} FROM ki_memory_entries${where} ORDER BY importance DESC, updated_at DESC`,
    args,
  );
  return res.length ? res[0].values.map(rowToEntry) : [];
}

/** Sucht Erinnerungen per Stichwort (LIKE über Titel + Inhalt). */
export function searchMemory(query: string, projectId?: string | null): MemoryEntry[] {
  const q = `%${query.replace(/[%_]/g, "")}%`;
  const res = getDb().exec(
    `SELECT ${COLS} FROM ki_memory_entries
     WHERE (title LIKE ? OR content LIKE ?)
       AND (COALESCE(project_id, '') = COALESCE(?, ''))
     ORDER BY importance DESC, updated_at DESC LIMIT 50`,
    [q, q, projectId ?? null],
  );
  return res.length ? res[0].values.map(rowToEntry) : [];
}

/** Markiert Erinnerungen als "gerade im Prompt benutzt" (für Relevanz-Tracking). */
export async function touchMemories(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  db.run(`UPDATE ki_memory_entries SET last_used_at = ? WHERE id IN (${placeholders})`, [Date.now(), ...ids]);
  await persist();
}

/** Löscht eine einzelne Erinnerung. */
export async function deleteMemory(id: string): Promise<void> {
  getDb().run("DELETE FROM ki_memory_entries WHERE id = ?", [id]);
  await persist();
}

/** Statistik fürs Panel / Cleanup-Dialog. */
export function memoryStats(): MemoryStats {
  const all = listMemory();
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<MemoryKind, number>;
  for (const m of all) byKind[m.kind]++;
  return {
    total: all.length,
    byKind,
    oldest: all.length ? Math.min(...all.map((m) => m.createdAt)) : null,
    newest: all.length ? Math.max(...all.map((m) => m.updatedAt)) : null,
    auto: all.filter((m) => m.source === "auto").length,
    manual: all.filter((m) => m.source === "manuell").length,
  };
}

/**
 * Baut einen kompakten Gedächtnis-Block für den System-Prompt.
 * Wichtigste Einträge zuerst, Zeichenbudget begrenzt (maxChars).
 */
export function buildMemoryPrompt(entries: MemoryEntry[], maxChars = 1500): string {
  if (!entries.length) return "";
  const parts: string[] = [];
  let used = 0;
  for (const m of entries) {
    const line = `- [${m.kind}] ${m.title}: ${m.content.replace(/\n+/g, " ").slice(0, 240)}`;
    if (used + line.length > maxChars) break;
    parts.push(line);
    used += line.length;
  }
  return parts.length ? `BEKANNTE ERINNERUNGEN AUS FRÜHEREN SESSIONS:\n${parts.join("\n")}` : "";
}
