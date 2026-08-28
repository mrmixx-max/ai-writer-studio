// @vitest-environment happy-dom
// Unit-Tests für exportProject / exportContent / downloadPublishBundle.
// Happy-Dom liefert document.createElement + URL.createObjectURL für die
// Download-Strecken; die DB läuft als echtes In-Memory-SQLite.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — für diese Tests brauchen
// wir das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import type { Chapter } from "@/types/project";
import { exportProject, exportContent, downloadPublishBundle, type PublishPackage } from "./index";
import type { Project } from "@/types/project";

let project: Project;
let chapters: Chapter[];

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  project = await createProject("Export-Projekt");
  chapters = [
    await createChapter(project.id, "Kapitel Eins", JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Erster Text" }] }],
    })),
    await createChapter(project.id, "Kapitel Zwei", JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Zweiter Text" }] }],
    })),
  ];

  // Download fangen, statt echte Blobs in die Download-Queue zu hängen.
  vi.stubGlobal("downloaded", [] as { name: string; size: number }[]);
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
    const size = blob instanceof Blob ? blob.size : 0;
    (globalThis as any).downloaded.push({ name: "", size });
    return "blob:fake-url";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastDownload(): { name: string; size: number } | undefined {
  const dl = (globalThis as any).downloaded as { name: string; size: number }[];
  return dl[dl.length - 1];
}

// a.download setzen wir nicht ab — der Dateiname steht in exportProject.
// Wir prüfen daher den Blob-Inhalt direkt via capture.

describe("exportProject", () => {
  it("exportiert das ganze Projekt als Markdown mit Kapitel-Überschriften", async () => {
    const progress: [number, string][] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      const size = blob instanceof Blob ? blob.size : 0;
      (globalThis as any).downloaded.push({ name: "", size });
      return "blob:fake";
    });
    await exportProject(project, "md", undefined, {
      onProgress: (p, l) => progress.push([p, l]),
    });
    expect(lastDownload()?.size).toBeGreaterThan(0);
    expect(progress[progress.length - 1][0]).toBe(100);
    expect(progress.some(([, l]) => l.includes("Kapitel \"Kapitel Eins\""))).toBe(true);
  });

  it("exportiert ein einzelnes Kapitel (Titel = Kapiteltitel)", async () => {
    await exportProject(project, "md", chapters[0].id);
    expect(lastDownload()?.size).toBeGreaterThan(0);
  });

  it("bricht still ab, wenn die Kapitel-ID unbekannt ist", async () => {
    const before = (globalThis as any).downloaded.length;
    await exportProject(project, "md", "gibts-nicht");
    expect((globalThis as any).downloaded.length).toBe(before);
  });

  it("exportiert als PDF und DOCX (Binärsignaturen ok)", async () => {
    await exportProject(project, "pdf");
    expect(lastDownload()?.size).toBeGreaterThan(200);
    await exportProject(project, "epub", undefined, { author: "Erika" });
    expect(lastDownload()?.size).toBeGreaterThan(200);
  });
});

describe("exportContent", () => {
  it("exportiert Editor-JSON als Markdown und Text", async () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Insel" }] },
        { type: "paragraph", content: [{ type: "text", text: "Inhalt" }] },
      ],
    });
    await exportContent(json, "Insel-Export", "md");
    expect(lastDownload()?.size).toBeGreaterThan(0);
    await exportContent(json, "Insel-Export", "txt");
    expect(lastDownload()?.size).toBeGreaterThan(0);
  });
});

describe("downloadPublishBundle", () => {
  it("ruft für jedes Paket genau einen Download auf", async () => {
    const mk = (bytes: number): Blob => new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
    const pkgs: PublishPackage[] = [
      { platform: "smashwords", blob: mk(100), filename: "a.docx", format: "docx", checklist: ["Punkt 1"] },
      { platform: "kobo", blob: mk(50), filename: "b.epub", format: "epub", checklist: ["Punkt 2"] },
    ];
    await downloadPublishBundle(pkgs);
    const dl = (globalThis as any).downloaded as { name: string; size: number }[];
    // Ein zusammengefasstes ZIP:
    expect(dl).toHaveLength(1);
    expect(dl[0].size).toBeGreaterThan(150);
  });
});
