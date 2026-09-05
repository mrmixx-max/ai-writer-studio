// Coverage-Nachtrag Sprint 3 (Agent 1 — Task 4): version/index.ts +
// dialogue/index.ts — CRUD über In-Memory-SQLite (echtes sql.js, wie in
// bookwriter.e2e.simulation.test.ts).
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());

import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import { createVersion, listVersions, deleteVersion } from "@/services/version";
import { saveDialogue, listDialogues } from "@/services/dialogue";

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as unknown as { __aws_db?: unknown }).__aws_db = db;
});

/** Projekt + Kapitel anlegen (FK-Basis für Versionen/Dialoge). */
async function makeChapter(): Promise<{ projectId: string; chapterId: string }> {
  const p = await createProject("VersionDialog-Test");
  const c = await createChapter(p.id, "Kapitel 1");
  return { projectId: p.id, chapterId: c.id };
}

describe("version/index.ts (literary_versions)", () => {
  it("createVersion + listVersions Rundtrip", async () => {
    const { chapterId } = await makeChapter();
    const v = await createVersion(chapterId, "Erste Fassung", "Inhalt v1", "draft", { words: 100 });
    expect(v.chapterId).toBe(chapterId);
    expect(v.label).toBe("Erste Fassung");
    expect(v.metrics).toBe(JSON.stringify({ words: 100 }));
    const list = listVersions(chapterId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(v.id);
    expect(list[0].content).toBe("Inhalt v1");
  });

  it("mehrere Versionen nach createdAt sortiert", async () => {
    const { chapterId } = await makeChapter();
    await createVersion(chapterId, "v1", "a", "draft");
    await createVersion(chapterId, "v2", "b", "draft");
    await createVersion(chapterId, "v3", "c", "draft");
    const list = listVersions(chapterId);
    expect(list).toHaveLength(3);
    expect(list.map((x) => x.label)).toEqual(["v1", "v2", "v3"]);
  });

  it("listVersions ohne Treffer → leer", () => {
    expect(listVersions("niemand")).toEqual([]);
  });

  it("deleteVersion entfernt den Eintrag", async () => {
    const { chapterId } = await makeChapter();
    const v = await createVersion(chapterId, "x", "y", "draft");
    await deleteVersion(v.id);
    expect(listVersions(chapterId)).toEqual([]);
  });
});

describe("dialogue/index.ts (chapter_dialogues)", () => {
  it("saveDialogue + listDialogues Rundtrip", async () => {
    const { chapterId } = await makeChapter();
    const d = await saveDialogue(chapterId, "Herausgeber", "Was fehlt?", "Ein Beleg in Absatz 2.");
    expect(d.chapterId).toBe(chapterId);
    expect(d.role).toBe("Herausgeber");
    const list = listDialogues(chapterId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(d.id);
    expect(list[0].response).toContain("Beleg");
  });

  it("mehrere Dialoge je Kapitel, sortiert", async () => {
    const { chapterId } = await makeChapter();
    await saveDialogue(chapterId, "Autor", "a", "b");
    await saveDialogue(chapterId, "Kritiker", "c", "d");
    const list = listDialogues(chapterId);
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.role)).toEqual(["Autor", "Kritiker"]);
  });

  it("listDialogues ohne Treffer → leer", () => {
    expect(listDialogues("leer")).toEqual([]);
  });
});
