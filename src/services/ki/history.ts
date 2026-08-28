// Feature: KI-Chatverlauf — Session-Persistenz in SQLite (ki_chat_messages).
// Verlauf wird pro Session geführt, persistiert und an neue KI-Aufrufe angehängt.
import { getDb, persist } from "@/services/db";
import type { ChatMessage } from "@/types/llm";

export interface StoredChatMessage extends ChatMessage {
  id: string;
  sessionId: string;
  chapterId: string | null;
  provider: string | null;
  model: string | null;
  createdAt: number;
}

function uid(): string {
  return "cm_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rowToMessage(row: unknown[]): StoredChatMessage {
  return {
    id: String(row[0]),
    sessionId: String(row[1]),
    chapterId: row[2] === null ? null : String(row[2]),
    role: row[3] as ChatMessage["role"],
    content: String(row[4]),
    provider: row[5] === null ? null : String(row[5]),
    model: row[6] === null ? null : String(row[6]),
    createdAt: Number(row[7]),
  };
}

/** Speichert eine Chat-Nachricht im persistenten Verlauf. */
export async function saveChatMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
  opts: { chapterId?: string | null; provider?: string | null; model?: string | null } = {},
): Promise<StoredChatMessage> {
  const db = getDb();
  const msg: StoredChatMessage = {
    id: uid(),
    sessionId,
    chapterId: opts.chapterId ?? null,
    role,
    content,
    provider: opts.provider ?? null,
    model: opts.model ?? null,
    createdAt: Date.now(),
  };
  db.run(
    `INSERT INTO ki_chat_messages (id, session_id, chapter_id, role, content, provider, model, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [msg.id, msg.sessionId, msg.chapterId, msg.role, msg.content, msg.provider, msg.model, msg.createdAt],
  );
  await persist();
  return msg;
}

/** Lädt den Verlauf einer Session (chronologisch). */
export function listChatMessages(sessionId: string): StoredChatMessage[] {
  const res = getDb().exec(
    `SELECT id, session_id, chapter_id, role, content, provider, model, created_at
     FROM ki_chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId],
  );
  if (!res.length) return [];
  return res[0].values.map(rowToMessage);
}

/** Löscht eine komplette Session (Chat-Verlauf zurücksetzen). */
export async function clearSession(sessionId: string): Promise<void> {
  getDb().run("DELETE FROM ki_chat_messages WHERE session_id = ?", [sessionId]);
  await persist();
}

/**
 * Erzeugt (oder lädt) eine Session-ID für ein Kapitel.
 * Kapitel-Wechsel führt zu eigener Session; "global" für kapitelübergreifenden Chat.
 */
export function sessionKeyFor(chapterId: string | null | undefined): string {
  return `ki-${chapterId || "global"}`;
}

/** Wandelt persistierte Nachrichten in LLM-History um (ohne system-Rollen). */
export function toLLMHistory(messages: StoredChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}
