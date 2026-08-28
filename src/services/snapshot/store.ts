// Snapshot-Versionierung: Anlegen, Laden, Löschen.
//
// Ein Snapshot ist eine vollständige Kopie aller Kapitelinhalte zu einem
// Zeitpunkt. Bewusst als Kopie und nicht als Differenz: Ein Manuskript ist
// selten größer als wenige Megabyte, und eine Kopie kann nicht durch eine
// kaputte Kette unbrauchbar werden.

import { getDb, persist, persistNow } from "@/services/db";
import { listChapters } from "@/services/project";
import { tiptapToText } from "@/services/editor/count";
import { uid } from "@/services/knowledge/util";
import { currentSchemaVersion } from "@/services/db/migrations";
import type { Snapshot, SnapshotItem, SnapshotMeta } from "@/types/snapshot";

/** Zählt Wörter wie der Editor. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/**
 * Legt einen Snapshot des aktuellen Projektzustands an.
 *
 * @param origin Wie der Snapshot entstanden ist. "before-export" und
 *   "bookwriter" werden von den jeweiligen Abläufen gesetzt, damit im
 *   Verlauf erkennbar bleibt, warum ein Stand festgehalten wurde.
 */
export async function createSnapshot(
  projectId: string,
  projectName: string,
  name: string,
  note: string | null = null,
  origin: SnapshotMeta["origin"] = "manual",
  preflightReportId: string | null = null,
): Promise<Snapshot> {
  const db = getDb();
  const snapshotId = uid("snap");
  const now = Date.now();

  const chapters = listChapters(projectId);
  const items: SnapshotItem[] = [];
  let totalWords = 0;

  for (const ch of chapters) {
    // listChapters() liefert bereits den vollständigen Inhalt (content-Spalte)
    const content = ch.content ?? "{}";
    const words = countWords(tiptapToText(content));
    totalWords += words;

    items.push({
      id: uid("snapi"),
      snapshotId,
      chapterId: ch.id,
      title: ch.title,
      content,
      orderIndex: ch.orderIndex,
      wordCount: words,
    });
  }

  const meta: SnapshotMeta = {
    projectName,
    chapterTitles: chapters.map((c) => c.title),
    origin,
    schemaVersion: currentSchemaVersion(db),
  };

  db.run(
    `INSERT INTO snapshots
       (id, project_id, name, note, meta, chapter_count, word_count,
        preflight_report_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      snapshotId,
      projectId,
      name,
      note,
      JSON.stringify(meta),
      chapters.length,
      totalWords,
      preflightReportId,
      now,
    ],
  );

  for (const it of items) {
    db.run(
      `INSERT INTO snapshot_items
         (id, snapshot_id, chapter_id, title, content, order_index, word_count)
       VALUES (?,?,?,?,?,?,?)`,
      [it.id, it.snapshotId, it.chapterId, it.title, it.content, it.orderIndex, it.wordCount],
    );
  }

  // Sofort schreiben, nicht entprellt: Ein Snapshot ist ein Sicherungspunkt.
  // Ginge er bei einem Absturz verloren, wäre er wertlos.
  await persistNow();

  return {
    id: snapshotId,
    projectId,
    name,
    note,
    meta,
    chapterCount: chapters.length,
    wordCount: totalWords,
    preflightReportId,
    createdAt: now,
  };
}

/** Wandelt eine DB-Zeile in einen Snapshot. */
function rowToSnapshot(r: unknown[]): Snapshot {
  let meta: SnapshotMeta;
  try {
    meta = JSON.parse(String(r[4])) as SnapshotMeta;
  } catch {
    // Beschädigte Metadaten dürfen den Snapshot nicht unbrauchbar machen —
    // die Kapitelinhalte sind das Wertvolle.
    meta = {
      projectName: "",
      chapterTitles: [],
      origin: "manual",
      schemaVersion: 0,
    };
  }

  return {
    id: String(r[0]),
    projectId: String(r[1]),
    name: String(r[2]),
    note: r[3] === null ? null : String(r[3]),
    meta,
    chapterCount: Number(r[5]),
    wordCount: Number(r[6]),
    preflightReportId: r[7] === null ? null : String(r[7]),
    createdAt: Number(r[8]),
  };
}

const SNAPSHOT_COLUMNS = `id, project_id, name, note, meta, chapter_count,
  word_count, preflight_report_id, created_at`;

/** Alle Snapshots eines Projekts, neueste zuerst. */
export function listSnapshots(projectId: string): Snapshot[] {
  const res = getDb().exec(
    `SELECT ${SNAPSHOT_COLUMNS} FROM snapshots WHERE project_id = ?
     ORDER BY created_at DESC`,
    [projectId],
  );
  if (res.length === 0) return [];
  return res[0].values.map(rowToSnapshot);
}

/** Ein Snapshot nach Id, oder null. */
export function getSnapshot(id: string): Snapshot | null {
  const res = getDb().exec(`SELECT ${SNAPSHOT_COLUMNS} FROM snapshots WHERE id = ?`, [id]);
  if (res.length === 0 || res[0].values.length === 0) return null;
  return rowToSnapshot(res[0].values[0]);
}

/** Die Kapitel eines Snapshots, in ihrer Reihenfolge. */
export function getSnapshotItems(snapshotId: string): SnapshotItem[] {
  const res = getDb().exec(
    `SELECT id, snapshot_id, chapter_id, title, content, order_index, word_count
     FROM snapshot_items WHERE snapshot_id = ? ORDER BY order_index`,
    [snapshotId],
  );
  if (res.length === 0) return [];
  return res[0].values.map((r) => ({
    id: String(r[0]),
    snapshotId: String(r[1]),
    chapterId: String(r[2]),
    title: String(r[3]),
    content: String(r[4]),
    orderIndex: Number(r[5]),
    wordCount: Number(r[6]),
  }));
}

/**
 * Löscht einen Snapshot samt Inhalten.
 *
 * Die Kapitel-Kopien gehen dabei verloren. Das ist gewollt: Wer einen
 * Snapshot löscht, will Platz oder Übersicht.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = getDb();
  db.run("DELETE FROM snapshot_items WHERE snapshot_id = ?", [id]);
  db.run("DELETE FROM snapshot_diffs WHERE from_snapshot_id = ? OR to_snapshot_id = ?", [id, id]);
  db.run("DELETE FROM snapshots WHERE id = ?", [id]);
  await persist();
}

/** Benennt einen Snapshot um. */
export async function renameSnapshot(id: string, name: string, note: string | null): Promise<void> {
  getDb().run("UPDATE snapshots SET name = ?, note = ? WHERE id = ?", [name, note, id]);
  await persist();
}

/** Kennzahlen für die Übersicht. */
export function snapshotStats(projectId: string): {
  count: number;
  newest: number | null;
  oldest: number | null;
  totalWords: number;
} {
  const res = getDb().exec(
    `SELECT COUNT(*), MAX(created_at), MIN(created_at), COALESCE(SUM(word_count),0)
     FROM snapshots WHERE project_id = ?`,
    [projectId],
  );
  if (res.length === 0 || res[0].values.length === 0) {
    return { count: 0, newest: null, oldest: null, totalWords: 0 };
  }
  const r = res[0].values[0];
  return {
    count: Number(r[0]),
    newest: r[1] === null ? null : Number(r[1]),
    oldest: r[2] === null ? null : Number(r[2]),
    totalWords: Number(r[3]),
  };
}
