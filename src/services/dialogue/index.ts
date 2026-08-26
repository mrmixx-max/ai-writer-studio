// Dialog mit dem Text: Kapitel antwortet aus verschiedenen Rollen.
import { getDb, persist } from "@/services/db";
import type { ChapterDialogue } from "@/types/project";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function saveDialogue(
  chapterId: string, role: string, message: string, response: string
): Promise<ChapterDialogue> {
  const db = getDb();
  const id = uid("dlg");
  db.run(
    "INSERT INTO chapter_dialogues (id, chapter_id, role, message, response, created_at) VALUES (?,?,?,?,?,?)",
    [id, chapterId, role, message, response, Date.now()],
  );
  await persist();
  return { id, chapterId, role, message, response, createdAt: Date.now() };
}

export function listDialogues(chapterId: string): ChapterDialogue[] {
  const db = getDb();
  const row = db.exec("SELECT id, chapter_id, role, message, response, created_at FROM chapter_dialogues WHERE chapter_id = ? ORDER BY created_at", [chapterId]);
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string, chapterId: v[1] as string, role: v[2] as string,
    message: v[3] as string, response: v[4] as string, createdAt: v[5] as number,
  }));
}
