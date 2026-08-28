// @vitest-environment happy-dom
// Unit-Tests für das Multi-Platform-Publishing (Smashwords / D2D / Kobo).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — für diese Tests brauchen
// wir das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import JSZip from "jszip";
import { buildPublishPackage, buildAllPublishPackages, downloadPublishBundle } from "./publishing";
import type { Project } from "@/types/project";

let project: Project;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  project = await createProject("Publish-Projekt");
  await createChapter(project.id, "Kapitel Eins", JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Erster Text" }] }],
  }));
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

const meta = { title: "Mein Buch", author: "Erika Muster", language: "de" };

describe("buildPublishPackage", () => {
  it("Smashwords → DOCX mit Checkliste und bereinigtem Dateinamen", async () => {
    const pkg = await buildPublishPackage(project, "smashwords", meta);
    expect(pkg.format).toBe("docx");
    expect(pkg.checklist.length).toBeGreaterThan(0);
    expect(pkg.filename).toBe("Mein Buch - Erika Muster - smashwords.docx");
    const zip = await JSZip.loadAsync(await pkg.blob.arrayBuffer());
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Erster Text");
  });

  it("Kobo → EPUB", async () => {
    const pkg = await buildPublishPackage(project, "kobo", meta);
    expect(pkg.format).toBe("epub");
    expect(pkg.filename.endsWith(".epub")).toBe(true);
    const zip = await JSZip.loadAsync(await pkg.blob.arrayBuffer());
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
  });

  it("einzelnes Kapitel exportieren (chapterId)", async () => {
    const { listChapters } = await import("@/services/project");
    const ch = listChapters(project.id)[0];
    const pkg = await buildPublishPackage(project, "draft2digital", meta, { chapterId: ch.id });
    expect(pkg.format).toBe("docx");
  });

  it("meldet Fortschritt bis 100", async () => {
    const events: number[] = [];
    await buildPublishPackage(project, "smashwords", meta, {
      onProgress: (p) => events.push(p),
    });
    expect(events[0]).toBe(5);
    expect(events[events.length - 1]).toBe(100);
  });

  it("Dateiname fällt auf „manuskript“ zurück, wenn der Titel nur Sonderzeichen enthält", async () => {
    const pkg = await buildPublishPackage(project, "smashwords", { ...meta, title: "***" });
    expect(pkg.filename.startsWith("manuskript - ")).toBe(true);
  });
});

describe("buildAllPublishPackages", () => {
  it("erzeugt je Plattform ein Paket (3 Stück) und meldet 100 %", async () => {
    const events: number[] = [];
    const pkgs = await buildAllPublishPackages(project, meta, {
      onProgress: (p) => events.push(p),
    });
    expect(pkgs.map((p) => p.platform)).toEqual(["smashwords", "draft2digital", "kobo"]);
    expect(events[events.length - 1]).toBe(100);
  });
});

describe("downloadPublishBundle", () => {
  it("packt alle Pakete als ZIP und stößt genau einen Download an", async () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const pkgs = await buildAllPublishPackages(project, meta);
    await downloadPublishBundle(pkgs);
    expect(click).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
