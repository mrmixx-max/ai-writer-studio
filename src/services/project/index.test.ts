// Unit-Tests: Projekt-Service CRUD (sql.js In-Memory).
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import {
  createProject, listProjects, renameProject, deleteProject,
  createChapter, listChapters, getChapter, updateChapter, deleteChapter,
} from "@/services/project";

describe("project service", () => {
  beforeEach(async () => {
    await initDb();
    // DB ist Singleton (cached) → zwischen Tests aufräumen
    const db = (globalThis as any).__aws_db;
    db.run("DELETE FROM chapters");
    db.run("DELETE FROM projects");
  });

  it("erstellt + listet Projekte", async () => {
    const p = await createProject("Mein Roman");
    expect(p.name).toBe("Mein Roman");
    expect(listProjects()).toHaveLength(1);
  });

  it("benennt + löscht Projekt", async () => {
    const p = await createProject("A");
    await renameProject(p.id, "B");
    expect(listProjects()[0].name).toBe("B");
    await deleteProject(p.id);
    expect(listProjects()).toHaveLength(0);
  });

  it("Kapitel CRUD + Inhalt-Update", async () => {
    const p = await createProject("Buch");
    const c = await createChapter(p.id, "Kapitel 1", '{"x":1}');
    expect(listChapters(p.id)).toHaveLength(1);
    await updateChapter(c.id, '{"x":2}');
    expect(getChapter(c.id)?.content).toBe('{"x":2}');
    await deleteChapter(c.id);
    expect(listChapters(p.id)).toHaveLength(0);
  });

  it("Kaskade: Projekt-Löschen entfernt Kapitel", async () => {
    const p = await createProject("Buch");
    await createChapter(p.id, "K1");
    await createChapter(p.id, "K2");
    expect(listChapters(p.id)).toHaveLength(2);
    await deleteProject(p.id);
    expect(listChapters(p.id)).toHaveLength(0);
  });
});
