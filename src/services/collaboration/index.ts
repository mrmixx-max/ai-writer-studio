// Collaboration-Service: Kommentare, Track Changes, Vorschläge (SQLite via sql.js).
import { getDb, persist } from "@/services/db";
import type { Comment, TrackChange, Suggestion, CommentStatus, SuggestionStatus } from "@/types/collaboration";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---------- Kommentare ----------

export async function addComment(
  chapterId: string,
  anchorStart: number,
  anchorEnd: number,
  anchorText: string,
  body: string,
  author = "Autor",
): Promise<Comment> {
  const db = getDb();
  const id = uid("cmt");
  const now = Date.now();
  db.run(
    "INSERT INTO comments (id, chapter_id, anchor_start, anchor_end, anchor_text, author, body, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, chapterId, anchorStart, anchorEnd, anchorText, author, body, "open", now],
  );
  await persist();
  return { id, chapterId, anchorStart, anchorEnd, anchorText, author, body, status: "open", createdAt: now, resolvedAt: null };
}

export function listComments(chapterId: string): Comment[] {
  const db = getDb();
  const res = db.exec(
    "SELECT id, chapter_id, anchor_start, anchor_end, anchor_text, author, body, status, created_at, resolved_at FROM comments WHERE chapter_id = ? ORDER BY anchor_start, created_at",
    [chapterId],
  );
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, chapterId: v[1] as string,
    anchorStart: v[2] as number, anchorEnd: v[3] as number,
    anchorText: v[4] as string, author: v[5] as string, body: v[6] as string,
    status: v[7] as CommentStatus, createdAt: v[8] as number, resolvedAt: v[9] as number | null,
  }));
}

export async function setCommentStatus(id: string, status: CommentStatus): Promise<void> {
  getDb().run("UPDATE comments SET status = ?, resolved_at = ? WHERE id = ?", [
    status, status === "resolved" ? Date.now() : null, id,
  ]);
  await persist();
}

export async function deleteComment(id: string): Promise<void> {
  getDb().run("DELETE FROM comments WHERE id = ?", [id]);
  await persist();
}

// ---------- Track Changes ----------

export async function recordChange(
  chapterId: string,
  kind: "insert" | "delete",
  position: number,
  text: string,
  replacedText: string | null,
  author = "Autor",
): Promise<TrackChange> {
  const db = getDb();
  const id = uid("tc");
  const now = Date.now();
  db.run(
    "INSERT INTO track_changes (id, chapter_id, kind, position, text, replaced_text, author, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, chapterId, kind, position, text, replacedText, author, now],
  );
  await persist();
  return { id, chapterId, kind, position, text, replacedText, author, createdAt: now };
}

export function listChanges(chapterId: string): TrackChange[] {
  const db = getDb();
  const res = db.exec(
    "SELECT id, chapter_id, kind, position, text, replaced_text, author, created_at FROM track_changes WHERE chapter_id = ? ORDER BY created_at DESC",
    [chapterId],
  );
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, chapterId: v[1] as string, kind: v[2] as "insert" | "delete",
    position: v[3] as number, text: v[4] as string, replacedText: v[5] as string | null,
    author: v[6] as string, createdAt: v[7] as number,
  }));
}

export async function clearChanges(chapterId: string): Promise<void> {
  getDb().run("DELETE FROM track_changes WHERE chapter_id = ?", [chapterId]);
  await persist();
}

// ---------- Vorschläge ----------

export async function addSuggestion(
  chapterId: string,
  kind: "insert" | "replace" | "delete",
  anchorStart: number,
  anchorEnd: number,
  originalText: string,
  proposedText: string,
  note = "",
  author = "Lektor",
): Promise<Suggestion> {
  const db = getDb();
  const id = uid("sug");
  const now = Date.now();
  db.run(
    "INSERT INTO suggestions (id, chapter_id, kind, anchor_start, anchor_end, original_text, proposed_text, author, note, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [id, chapterId, kind, anchorStart, anchorEnd, originalText, proposedText, author, note, "pending", now],
  );
  await persist();
  return {
    id, chapterId, kind, anchorStart, anchorEnd, originalText, proposedText,
    author, note, status: "pending", createdAt: now, decidedAt: null,
  };
}

export function listSuggestions(chapterId: string, pendingOnly = false): Suggestion[] {
  const db = getDb();
  const sql =
    "SELECT id, chapter_id, kind, anchor_start, anchor_end, original_text, proposed_text, author, note, status, created_at, decided_at FROM suggestions WHERE chapter_id = ?" +
    (pendingOnly ? " AND status = 'pending'" : "") +
    " ORDER BY created_at DESC";
  const res = db.exec(sql, [chapterId]);
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, chapterId: v[1] as string, kind: v[2] as Suggestion["kind"],
    anchorStart: v[3] as number, anchorEnd: v[4] as number,
    originalText: v[5] as string, proposedText: v[6] as string,
    author: v[7] as string, note: v[8] as string,
    status: v[9] as SuggestionStatus, createdAt: v[10] as number, decidedAt: v[11] as number | null,
  }));
}

export async function setSuggestionStatus(id: string, status: "accepted" | "rejected"): Promise<void> {
  getDb().run("UPDATE suggestions SET status = ?, decided_at = ? WHERE id = ?", [status, Date.now(), id]);
  await persist();
}

export async function deleteSuggestion(id: string): Promise<void> {
  getDb().run("DELETE FROM suggestions WHERE id = ?", [id]);
  await persist();
}
