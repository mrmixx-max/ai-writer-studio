// Tests: Snapshot-Versionierung.
//
// Schwerpunkt Datensicherheit. Die Wiederherstellung ist die einzige Aktion
// im Programm, die geschriebenen Text vernichten kann — jeder Pfad dorthin
// braucht einen Test.

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter, listChapters, getChapter, updateChapter, deleteChapter } from "@/services/project";
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getSnapshotItems,
  deleteSnapshot,
  renameSnapshot,
  snapshotStats,
} from "@/services/snapshot/store";
import {
  diffSnapshots,
  restoreSnapshot,
  previewRestore,
  saveDiff,
} from "@/services/snapshot/restore";

function doc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("Snapshot-Testprojekt");
  projectId = p.id;
});

describe("Snapshot anlegen", () => {
  it("hält alle Kapitel fest", async () => {
    await createChapter(projectId, "Eins", doc("Text des ersten Kapitels hier."));
    await createChapter(projectId, "Zwei", doc("Text des zweiten Kapitels."));

    const snap = await createSnapshot(projectId, "Testprojekt", "Rohfassung");

    expect(snap.chapterCount).toBe(2);
    expect(snap.wordCount).toBeGreaterThan(5);
    expect(getSnapshotItems(snap.id)).toHaveLength(2);
  });

  it("speichert den vollständigen Kapitelinhalt, nicht nur den Kopf", async () => {
    const content = doc("Ein sehr spezifischer Satz zum Wiedererkennen.");
    await createChapter(projectId, "Eins", content);

    const snap = await createSnapshot(projectId, "T", "S");
    const items = getSnapshotItems(snap.id);

    expect(items[0].content).toBe(content);
    expect(items[0].content).toContain("spezifischer Satz");
  });

  it("hält die Kapitelreihenfolge fest", async () => {
    await createChapter(projectId, "Erstes", doc("A"));
    await createChapter(projectId, "Zweites", doc("B"));
    await createChapter(projectId, "Drittes", doc("C"));

    const snap = await createSnapshot(projectId, "T", "S");
    const items = getSnapshotItems(snap.id);

    expect(items.map((i) => i.title)).toEqual(["Erstes", "Zweites", "Drittes"]);
  });

  it("hält Metadaten fest", async () => {
    await createChapter(projectId, "Eins", doc("Text"));
    const snap = await createSnapshot(projectId, "Mein Buch", "S", null, "before-export");

    expect(snap.meta.projectName).toBe("Mein Buch");
    expect(snap.meta.origin).toBe("before-export");
    expect(snap.meta.chapterTitles).toEqual(["Eins"]);
    expect(snap.meta.schemaVersion).toBeGreaterThan(0);
  });

  it("funktioniert bei einem Projekt ohne Kapitel", async () => {
    const snap = await createSnapshot(projectId, "T", "Leer");
    expect(snap.chapterCount).toBe(0);
    expect(snap.wordCount).toBe(0);
  });

  it("verknüpft optional einen Preflight-Bericht", async () => {
    const snap = await createSnapshot(projectId, "T", "Vor Export", null, "before-export", "rep123");
    expect(snap.preflightReportId).toBe("rep123");
  });
});

describe("Snapshots verwalten", () => {
  beforeEach(async () => {
    await createChapter(projectId, "Eins", doc("Text"));
  });

  it("listet neueste zuerst", async () => {
    const a = await createSnapshot(projectId, "T", "Alt");
    // Zeitstempel unterscheidbar machen.
    await new Promise((r) => setTimeout(r, 5));
    const b = await createSnapshot(projectId, "T", "Neu");

    const list = listSnapshots(projectId);
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("liefert einen Snapshot nach Id", async () => {
    const snap = await createSnapshot(projectId, "T", "Stand");
    expect(getSnapshot(snap.id)?.name).toBe("Stand");
  });

  it("liefert null für unbekannte Id", () => {
    expect(getSnapshot("gibt-es-nicht")).toBeNull();
  });

  it("benennt um", async () => {
    const snap = await createSnapshot(projectId, "T", "Alt");
    await renameSnapshot(snap.id, "Neu", "Mit Notiz");

    const after = getSnapshot(snap.id);
    expect(after?.name).toBe("Neu");
    expect(after?.note).toBe("Mit Notiz");
  });

  it("löscht Snapshot samt Kapitelkopien", async () => {
    const snap = await createSnapshot(projectId, "T", "Weg");
    await deleteSnapshot(snap.id);

    expect(getSnapshot(snap.id)).toBeNull();
    expect(getSnapshotItems(snap.id)).toHaveLength(0);
  });

  it("liefert Kennzahlen", async () => {
    await createSnapshot(projectId, "T", "A");
    await createSnapshot(projectId, "T", "B");

    const s = snapshotStats(projectId);
    expect(s.count).toBe(2);
    expect(s.newest).toBeTypeOf("number");
  });
});

describe("Vergleich", () => {
  it("erkennt inhaltliche Änderung", async () => {
    const ch = await createChapter(projectId, "Eins", doc("Alter Text hier."));
    const a = await createSnapshot(projectId, "T", "Vorher");

    await updateChapter(ch.id, doc("Neuer, deutlich längerer Text an dieser Stelle."));
    const b = await createSnapshot(projectId, "T", "Nachher");

    const d = diffSnapshots(a.id, b.id);
    expect(d.totals.changed).toBe(1);
    expect(d.entries[0].wordDelta).toBeGreaterThan(0);
  });

  it("erkennt neue Kapitel", async () => {
    await createChapter(projectId, "Eins", doc("A"));
    const a = await createSnapshot(projectId, "T", "Vorher");

    await createChapter(projectId, "Zwei", doc("B"));
    const b = await createSnapshot(projectId, "T", "Nachher");

    const d = diffSnapshots(a.id, b.id);
    expect(d.totals.added).toBe(1);
    expect(d.entries.find((e) => e.kind === "added")?.titleAfter).toBe("Zwei");
  });

  it("erkennt gelöschte Kapitel", async () => {
    const ch = await createChapter(projectId, "Weg", doc("Verschwindet"));
    await createChapter(projectId, "Bleibt", doc("Bleibt da"));
    const a = await createSnapshot(projectId, "T", "Vorher");

    await deleteChapter(ch.id);
    const b = await createSnapshot(projectId, "T", "Nachher");

    const d = diffSnapshots(a.id, b.id);
    expect(d.totals.removed).toBe(1);
    expect(d.entries.find((e) => e.kind === "removed")?.titleBefore).toBe("Weg");
  });

  it("erkennt eine Umbenennung als Umbenennung, nicht als Löschung plus Neuanlage", async () => {
    // Entscheidend: Verglichen wird über die Id. Über den Titel verglichen
    // wäre jede Umbenennung ein Kapitelwechsel.
    const ch = await createChapter(projectId, "Alter Titel", doc("Gleicher Text bleibt."));
    const a = await createSnapshot(projectId, "T", "Vorher");

    const { renameChapter } = await import("@/services/project");
    await renameChapter(ch.id, "Neuer Titel");
    const b = await createSnapshot(projectId, "T", "Nachher");

    const d = diffSnapshots(a.id, b.id);
    expect(d.totals.renamed).toBe(1);
    expect(d.totals.added).toBe(0);
    expect(d.totals.removed).toBe(0);
  });

  it("meldet unveränderte Kapitel als unverändert", async () => {
    await createChapter(projectId, "Eins", doc("Bleibt gleich."));
    const a = await createSnapshot(projectId, "T", "A");
    const b = await createSnapshot(projectId, "T", "B");

    const d = diffSnapshots(a.id, b.id);
    expect(d.totals.unchanged).toBe(1);
    expect(d.structureSummary).toContain("unverändert");
  });

  it("fasst die Änderung in Klartext zusammen", async () => {
    await createChapter(projectId, "Eins", doc("Kurz."));
    const a = await createSnapshot(projectId, "T", "A");
    await createChapter(projectId, "Zwei", doc("Ein deutlich längerer zweiter Text hier."));
    const b = await createSnapshot(projectId, "T", "B");

    const d = diffSnapshots(a.id, b.id);
    expect(d.structureSummary).toMatch(/Kapitel neu/);
    expect(d.structureSummary).toMatch(/Wörter mehr/);
  });

  it("speichert einen Vergleich", async () => {
    await createChapter(projectId, "Eins", doc("Text"));
    const a = await createSnapshot(projectId, "T", "A");
    const b = await createSnapshot(projectId, "T", "B");

    await expect(saveDiff(diffSnapshots(a.id, b.id))).resolves.toBeUndefined();
  });
});

describe("Wiederherstellung", () => {
  it("setzt Kapitelinhalte zurück", async () => {
    const ch = await createChapter(projectId, "Eins", doc("Ursprünglicher Text."));
    const snap = await createSnapshot(projectId, "T", "Gut");

    await updateChapter(ch.id, doc("Verpfuschte Fassung."));
    expect(getChapter(ch.id)?.content).toContain("Verpfuschte");

    const r = await restoreSnapshot(snap.id, "T");

    expect(r.restored).toBe(1);
    expect(getChapter(ch.id)?.content).toContain("Ursprünglicher");
  });

  it("legt vor der Wiederherstellung selbst einen Snapshot an", async () => {
    // Ein Restore darf nie ohne Netz laufen — auch nicht auf Zuruf.
    const ch = await createChapter(projectId, "Eins", doc("Alt"));
    const snap = await createSnapshot(projectId, "T", "Alter Stand");
    await updateChapter(ch.id, doc("Wichtige neue Arbeit, die nicht verloren gehen darf."));

    const r = await restoreSnapshot(snap.id, "T");

    expect(r.safetySnapshotId).toBeTruthy();
    const safety = getSnapshot(r.safetySnapshotId!);
    expect(safety).toBeTruthy();
    expect(getSnapshotItems(safety!.id)[0].content).toContain("Wichtige neue Arbeit");
  });

  it("kann den Sicherungs-Snapshot abwählen", async () => {
    await createChapter(projectId, "Eins", doc("Text"));
    const snap = await createSnapshot(projectId, "T", "S");
    const r = await restoreSnapshot(snap.id, "T", { createSafetySnapshot: false });
    expect(r.safetySnapshotId).toBeNull();
  });

  it("legt gelöschte Kapitel neu an", async () => {
    const ch = await createChapter(projectId, "Wichtig", doc("Wertvoller Inhalt."));
    const snap = await createSnapshot(projectId, "T", "Mit Kapitel");

    await deleteChapter(ch.id);
    expect(listChapters(projectId)).toHaveLength(0);

    const r = await restoreSnapshot(snap.id, "T");

    expect(r.recreated).toBe(1);
    const after = listChapters(projectId);
    expect(after).toHaveLength(1);
    expect(getChapter(after[0].id)?.content).toContain("Wertvoller Inhalt");
  });

  it("behält überzählige Kapitel standardmäßig", async () => {
    await createChapter(projectId, "Alt", doc("Alt"));
    const snap = await createSnapshot(projectId, "T", "S");
    await createChapter(projectId, "Neu nach Snapshot", doc("Neue Arbeit"));

    const r = await restoreSnapshot(snap.id, "T");

    expect(r.extra).toBe(1);
    expect(r.extraHandling).toBe("kept");
    // Die neue Arbeit ist noch da — Löschen braucht eine ausdrückliche Wahl.
    expect(listChapters(projectId)).toHaveLength(2);
  });

  it("löscht überzählige Kapitel nur auf ausdrückliche Anweisung", async () => {
    await createChapter(projectId, "Alt", doc("Alt"));
    const snap = await createSnapshot(projectId, "T", "S");
    await createChapter(projectId, "Neu", doc("Weg damit"));

    const r = await restoreSnapshot(snap.id, "T", { deleteExtra: true });

    expect(r.extraHandling).toBe("deleted");
    expect(listChapters(projectId)).toHaveLength(1);
  });

  it("wirft bei unbekanntem Snapshot, ohne etwas zu verändern", async () => {
    const ch = await createChapter(projectId, "Eins", doc("Unverändert bleiben."));
    await expect(restoreSnapshot("gibt-es-nicht", "T")).rejects.toThrow(/nicht gefunden/);
    expect(getChapter(ch.id)?.content).toContain("Unverändert");
  });

  it("verweigert die Wiederherstellung eines leeren Snapshots", async () => {
    // Ein leerer Snapshot würde das Projekt leeren — das ist nie gewollt.
    const empty = await createSnapshot(projectId, "T", "Leer");
    await createChapter(projectId, "Wichtig", doc("Darf nicht verschwinden."));

    await expect(restoreSnapshot(empty.id, "T")).rejects.toThrow(/keine Kapitel/);
    expect(listChapters(projectId)).toHaveLength(1);
  });
});

describe("Vorschau der Wiederherstellung", () => {
  it("nennt Zahlen, ohne etwas zu verändern", async () => {
    const ch = await createChapter(projectId, "Eins", doc("Alt"));
    const snap = await createSnapshot(projectId, "T", "S");
    await updateChapter(ch.id, doc("Neu und viel länger als vorher hier."));

    const p = previewRestore(snap.id);

    expect(p.willRestore).toBe(1);
    expect(p.willRecreate).toBe(0);
    // Nichts verändert.
    expect(getChapter(ch.id)?.content).toContain("Neu und viel länger");
  });

  it("warnt bei drohendem Wortverlust", async () => {
    const ch = await createChapter(projectId, "Eins", doc("Kurz."));
    const snap = await createSnapshot(projectId, "T", "S");
    await updateChapter(ch.id, doc("Wort ".repeat(400)));

    const p = previewRestore(snap.id);
    expect(p.warning).toBeTruthy();
    expect(p.warning).toMatch(/Wörter mehr/);
  });

  it("nennt überzählige Kapitel", async () => {
    await createChapter(projectId, "Alt", doc("Alt"));
    const snap = await createSnapshot(projectId, "T", "S");
    await createChapter(projectId, "Später dazugekommen", doc("Neu"));

    const p = previewRestore(snap.id);
    expect(p.extra).toContain("Später dazugekommen");
  });

  it("meldet unbekannten Snapshot", () => {
    const p = previewRestore("gibt-es-nicht");
    expect(p.warning).toContain("nicht gefunden");
  });
});
