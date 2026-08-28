// Projekt-Service: CRUD für Projekte + Kapitel (sql.js).
import { getDb, persist } from "@/services/db";
import type { Project, Chapter } from "@/types/project";
import {
  isManuscriptUnlocked,
  encryptChapterContent,
  decryptChapterContent,
} from "@/services/security/manuscriptEncryption";
import { isEncryptedPayload } from "@/services/security/crypto";
import { loadSettings } from "@/services/settings";

/** true, wenn Kapitelinhalte AES-256 verschluesselt werden sollen. */
function encryptionActive(): boolean {
  try {
    return loadSettings().manuscriptEncryption;
  } catch {
    return false;
  }
}

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---- Projekte ----

export async function createProject(name: string): Promise<Project> {
  const db = getDb();
  const id = uid("prj");
  const now = Date.now();
  db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?,?,?,?)", [id, name, now, now]);
  await persist();
  return { id, name, createdAt: now, updatedAt: now };
}

export function listProjects(): Project[] {
  const db = getDb();
  const row = db.exec("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC");
  if (!row.length) return [];
  return row[0].values.map((v) => ({ id: v[0] as string, name: v[1] as string, createdAt: v[2] as number, updatedAt: v[3] as number }));
}

export async function renameProject(id: string, name: string): Promise<void> {
  getDb().run("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?", [name, Date.now(), id]);
  await persist();
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  db.run("DELETE FROM chapters WHERE project_id = ?", [id]);
  db.run("DELETE FROM projects WHERE id = ?", [id]);
  await persist();
}

// ---- Kapitel ----

export async function createChapter(projectId: string, title: string, content = "{}"): Promise<Chapter> {
  const db = getDb();
  const id = uid("chap");
  const now = Date.now();
  const idxRow = db.exec("SELECT COALESCE(MAX(order_index),-1)+1 AS n FROM chapters WHERE project_id = ?", [projectId]);
  const idx = idxRow.length ? (idxRow[0].values[0][0] as number) : 0;
  // Verschlusselung: sensibler Kapitelinhalt wird AES-256-GCM chiffriert gespeichert.
  const stored = encryptionActive() && isManuscriptUnlocked() ? await encryptChapterContent(content) : content;
  db.run(
    "INSERT INTO chapters (id, project_id, title, content, order_index, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [id, projectId, title, stored, idx, now, now],
  );
  await persist();
  return { id, projectId, title, content, orderIndex: idx, createdAt: now, updatedAt: now };
}

export function listChapters(projectId: string): Chapter[] {
  const db = getDb();
  const row = db.exec("SELECT id, project_id, title, content, order_index, created_at, updated_at FROM chapters WHERE project_id = ? ORDER BY order_index", [projectId]);
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string,
    projectId: v[1] as string,
    title: v[2] as string,
    // Chiffrierte Inhalte (AWS1) werden synchron nicht entschluesselt —
    // der Editor ruft decryptChapterContent() asynchron auf.
    content: isEncryptedPayload(v[3] as string) ? (v[3] as string) : (v[3] as string),
    orderIndex: v[4] as number,
    createdAt: v[5] as number,
    updatedAt: v[6] as number,
  }));
}

/** Liefert ein Kapitel mit entschluesseltem Inhalt (Klartext fuer den Editor). */
export async function getChapterDecrypted(id: string): Promise<Chapter | null> {
  const ch = getChapter(id);
  if (!ch) return null;
  try {
    return { ...ch, content: await decryptChapterContent(ch.content) };
  } catch {
    return ch; // entschlsselter Inhalt bleibt geschuetzt; UI zeigt Lock-Hinweis
  }
}

export function getChapter(id: string): Chapter | null {
  const db = getDb();
  const row = db.exec("SELECT id, project_id, title, content, order_index, created_at, updated_at FROM chapters WHERE id = ?", [id]);
  if (!row.length) return null;
  const v = row[0].values[0];
  return {
    id: v[0] as string, projectId: v[1] as string, title: v[2] as string,
    content: v[3] as string, orderIndex: v[4] as number, createdAt: v[5] as number, updatedAt: v[6] as number,
  };
}

export async function updateChapter(id: string, content: string): Promise<void> {
  // Verschlusselung auch beim Speichern bestehender Kapitel.
  const stored = encryptionActive() && isManuscriptUnlocked() ? await encryptChapterContent(content) : content;
  getDb().run("UPDATE chapters SET content = ?, updated_at = ? WHERE id = ?", [stored, Date.now(), id]);
  await persist();
}

export async function renameChapter(id: string, title: string): Promise<void> {
  getDb().run("UPDATE chapters SET title = ? WHERE id = ?", [title, id]);
  await persist();
}

export async function deleteChapter(id: string): Promise<void> {
  getDb().run("DELETE FROM chapters WHERE id = ?", [id]);
  await persist();
}

export async function reorderChapter(id: string, orderIndex: number): Promise<void> {
  getDb().run("UPDATE chapters SET order_index = ? WHERE id = ?", [orderIndex, id]);
  await persist();
}
