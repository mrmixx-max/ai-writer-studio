// Snapshot-Vergleich und Wiederherstellung.
//
// Die Wiederherstellung ist die einzige Aktion im Programm, die geschriebenen
// Text vernichten kann. Sie legt deshalb vorher selbst einen Snapshot an —
// auch dann, wenn der Nutzer bestätigt hat. Ein bestätigter Irrtum ist noch
// ein Irrtum.

import { getDb, persistNow } from "@/services/db";
import { listChapters, createChapter, updateChapter, renameChapter, deleteChapter } from "@/services/project";
import { tiptapToText } from "@/services/editor/count";
import { uid } from "@/services/knowledge/util";
import { createSnapshot, getSnapshot, getSnapshotItems } from "./store";
import type {
  DiffEntry,
  RestoreOptions,
  RestoreResult,
  SnapshotDiff,
} from "@/types/snapshot";

function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/**
 * Vergleicht zwei Snapshots.
 *
 * Verglichen wird über die Kapitel-Id, nicht über den Titel: Ein umbenanntes
 * Kapitel ist dasselbe Kapitel, kein neues. Über den Titel verglichen würde
 * jede Umbenennung als Löschung plus Neuanlage erscheinen.
 */
export function diffSnapshots(fromId: string, toId: string): SnapshotDiff {
  const fromItems = getSnapshotItems(fromId);
  const toItems = getSnapshotItems(toId);

  const fromMap = new Map(fromItems.map((i) => [i.chapterId, i]));
  const toMap = new Map(toItems.map((i) => [i.chapterId, i]));
  const allIds = new Set([...fromMap.keys(), ...toMap.keys()]);

  const entries: DiffEntry[] = [];

  for (const id of allIds) {
    const a = fromMap.get(id);
    const b = toMap.get(id);

    if (!a && b) {
      entries.push({
        kind: "added",
        chapterId: id,
        titleBefore: null,
        titleAfter: b.title,
        wordsBefore: 0,
        wordsAfter: b.wordCount,
        wordDelta: b.wordCount,
        positionBefore: null,
        positionAfter: b.orderIndex,
      });
      continue;
    }

    if (a && !b) {
      entries.push({
        kind: "removed",
        chapterId: id,
        titleBefore: a.title,
        titleAfter: null,
        wordsBefore: a.wordCount,
        wordsAfter: 0,
        wordDelta: -a.wordCount,
        positionBefore: a.orderIndex,
        positionAfter: null,
      });
      continue;
    }

    if (!a || !b) continue;

    const titleChanged = a.title !== b.title;
    const contentChanged = a.content !== b.content;
    const moved = a.orderIndex !== b.orderIndex;

    // Reihenfolge der Einordnung: Inhaltsänderung wiegt schwerer als
    // Umbenennung, Umbenennung schwerer als Verschiebung. Ein Kapitel kann
    // alles drei sein — die Anzeige nennt den wichtigsten Aspekt.
    let kind: DiffEntry["kind"] = "unchanged";
    if (contentChanged) kind = "changed";
    else if (titleChanged) kind = "renamed";
    else if (moved) kind = "moved";

    entries.push({
      kind,
      chapterId: id,
      titleBefore: a.title,
      titleAfter: b.title,
      wordsBefore: a.wordCount,
      wordsAfter: b.wordCount,
      wordDelta: b.wordCount - a.wordCount,
      positionBefore: a.orderIndex,
      positionAfter: b.orderIndex,
    });
  }

  // Nach Position im neueren Stand sortieren, damit die Liste der
  // Kapitelfolge entspricht.
  entries.sort((x, y) => (x.positionAfter ?? 999) - (y.positionAfter ?? 999));

  const totals = {
    added: entries.filter((e) => e.kind === "added").length,
    removed: entries.filter((e) => e.kind === "removed").length,
    renamed: entries.filter((e) => e.kind === "renamed").length,
    changed: entries.filter((e) => e.kind === "changed").length,
    moved: entries.filter((e) => e.kind === "moved").length,
    unchanged: entries.filter((e) => e.kind === "unchanged").length,
    wordDelta: entries.reduce((sum, e) => sum + e.wordDelta, 0),
  };

  return {
    fromSnapshotId: fromId,
    toSnapshotId: toId,
    entries,
    structureSummary: summarizeStructure(totals),
    toneSummary: null,
    totals,
  };
}

/** Klartext-Zusammenfassung der Strukturänderung. */
function summarizeStructure(t: SnapshotDiff["totals"]): string {
  const parts: string[] = [];
  if (t.added) parts.push(`${t.added} ${t.added === 1 ? "Kapitel neu" : "Kapitel neu"}`);
  if (t.removed) parts.push(`${t.removed} entfernt`);
  if (t.changed) parts.push(`${t.changed} inhaltlich geändert`);
  if (t.renamed) parts.push(`${t.renamed} umbenannt`);
  if (t.moved) parts.push(`${t.moved} verschoben`);
  if (t.unchanged) parts.push(`${t.unchanged} unverändert`);

  if (parts.length === 0) return "Keine Unterschiede.";

  const delta =
    t.wordDelta === 0
      ? "Wortzahl gleich"
      : t.wordDelta > 0
        ? `${t.wordDelta.toLocaleString("de-DE")} Wörter mehr`
        : `${Math.abs(t.wordDelta).toLocaleString("de-DE")} Wörter weniger`;

  return `${parts.join(", ")}. ${delta}.`;
}

/** Speichert einen Vergleich, damit er nicht jedes Mal neu berechnet wird. */
export async function saveDiff(diff: SnapshotDiff): Promise<void> {
  getDb().run(
    `INSERT INTO snapshot_diffs
       (id, from_snapshot_id, to_snapshot_id, entries, structure_summary,
        tone_summary, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      uid("snapd"),
      diff.fromSnapshotId,
      diff.toSnapshotId,
      JSON.stringify(diff.entries),
      diff.structureSummary,
      diff.toneSummary,
      Date.now(),
    ],
  );
  await persistNow();
}

/**
 * Stellt einen Snapshot wieder her.
 *
 * Ablauf:
 *   1. Sicherungs-Snapshot des aktuellen Stands (standardmäßig an)
 *   2. Kapitel aus dem Snapshot zurückschreiben
 *   3. Fehlende Kapitel neu anlegen
 *   4. Überzählige Kapitel behalten oder löschen — je nach Option
 *
 * Wirft, wenn der Snapshot nicht existiert. Ein stiller Fehlschlag wäre hier
 * das Schlimmste: Der Nutzer glaubte, sein alter Stand sei wieder da.
 */
export async function restoreSnapshot(
  snapshotId: string,
  projectName: string,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot) {
    throw new Error(
      `Der Snapshot wurde nicht gefunden (${snapshotId}). Es wurde nichts verändert.`,
    );
  }

  const items = getSnapshotItems(snapshotId);
  if (items.length === 0) {
    throw new Error(
      "Der Snapshot enthält keine Kapitel. Eine Wiederherstellung würde das " +
        "Projekt leeren — sie wurde abgebrochen.",
    );
  }

  const withSafety = options.createSafetySnapshot !== false;
  let safetySnapshotId: string | null = null;

  if (withSafety) {
    const stamp = new Date().toLocaleString("de-DE");
    const safety = await createSnapshot(
      snapshot.projectId,
      projectName,
      `Vor Wiederherstellung (${stamp})`,
      `Automatisch angelegt vor der Wiederherstellung von „${snapshot.name}“.`,
      "manual",
    );
    safetySnapshotId = safety.id;
  }

  const current = listChapters(snapshot.projectId);
  const currentIds = new Set(current.map((c) => c.id));
  const snapshotIds = new Set(items.map((i) => i.chapterId));

  let restored = 0;
  let recreated = 0;

  for (const it of items) {
    if (currentIds.has(it.chapterId)) {
      await updateChapter(it.chapterId, it.content);
      // Titel kann sich seit dem Snapshot geändert haben.
      const now = current.find((c) => c.id === it.chapterId);
      if (now && now.title !== it.title) {
        await renameChapter(it.chapterId, it.title);
      }
      restored++;
    } else {
      // Das Kapitel wurde inzwischen gelöscht — neu anlegen. Es bekommt
      // dabei eine neue Id; der alte Inhalt ist das Entscheidende.
      await createChapter(snapshot.projectId, it.title, it.content);
      recreated++;
    }
  }

  const extra = current.filter((c) => !snapshotIds.has(c.id));
  let extraHandling: RestoreResult["extraHandling"] = "kept";

  if (options.deleteExtra) {
    for (const c of extra) {
      await deleteChapter(c.id);
    }
    extraHandling = "deleted";
  }

  await persistNow();

  return {
    restored,
    recreated,
    extra: extra.length,
    extraHandling,
    safetySnapshotId,
  };
}

/**
 * Beschreibt, was eine Wiederherstellung tun würde — ohne sie auszuführen.
 *
 * Grundlage für die Schutzabfrage: Der Nutzer soll vorher lesen, was
 * geschieht, nicht hinterher merken, was geschehen ist.
 */
export function previewRestore(
  snapshotId: string,
): { willRestore: number; willRecreate: number; extra: string[]; warning: string | null } {
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot) {
    return { willRestore: 0, willRecreate: 0, extra: [], warning: "Snapshot nicht gefunden." };
  }

  const items = getSnapshotItems(snapshotId);
  const current = listChapters(snapshot.projectId);
  const currentIds = new Set(current.map((c) => c.id));
  const snapshotIds = new Set(items.map((i) => i.chapterId));

  const willRestore = items.filter((i) => currentIds.has(i.chapterId)).length;
  const willRecreate = items.length - willRestore;
  const extra = current.filter((c) => !snapshotIds.has(c.id)).map((c) => c.title);

  // Wortzahl-Verlust abschätzen, damit die Warnung konkret ist.
  let currentWords = 0;
  for (const c of current) {
    currentWords += countWords(tiptapToText(c.content ?? "{}"));
  }
  const lostWords = currentWords - snapshot.wordCount;

  let warning: string | null = null;
  if (lostWords > 200) {
    warning =
      `Der aktuelle Stand hat etwa ${lostWords.toLocaleString("de-DE")} Wörter mehr ` +
      "als der Snapshot. Diese Arbeit wird überschrieben — der " +
      "Sicherungs-Snapshot bewahrt sie auf.";
  } else if (extra.length > 0) {
    warning =
      `${extra.length} ${extra.length === 1 ? "Kapitel existiert" : "Kapitel existieren"} ` +
      "nur im aktuellen Stand. Sie bleiben erhalten, sofern du sie nicht " +
      "ausdrücklich löschen lässt.";
  }

  return { willRestore, willRecreate, extra, warning };
}
