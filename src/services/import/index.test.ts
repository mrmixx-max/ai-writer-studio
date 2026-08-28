// @vitest-environment happy-dom
// Unit-Tests für die Import-Fassade (index.ts): Formaterkennung,
// importFiles() für Markdown/Scrivener/Unbekannt und applyImport().

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — für applyImport brauchen
// wir das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import {
  detectFormat,
  importFiles,
  applyImport,
  type ImportFile,
} from "./index";
import { ImportError } from "./types";
import { listChapters } from "@/services/project";

const SCRIVX = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject>
  <ProjectTitle>Fassaden-Projekt</ProjectTitle>
  <Binder>
    <BinderChildren>
      <BinderItem Type="Text" UUID="uuid-1">
        <Title>Kapitel Eins</Title>
        <IncludeInCompile>true</IncludeInCompile>
      </BinderItem>
    </BinderChildren>
  </Binder>
</ScrivenerProject>`;

describe("detectFormat", () => {
  it("erkennt alle unterstützten Endungen", () => {
    expect(detectFormat("roman.SCRIVX")).toBe("scrivener");
    expect(detectFormat("paket.scriv")).toBe("scrivener");
    expect(detectFormat("doku.docx")).toBe("docx");
    expect(detectFormat("notizen.md")).toBe("markdown");
    expect(detectFormat("notizen.txt")).toBe("markdown");
    expect(detectFormat("bild.png")).toBe("unknown");
  });
});

describe("importFiles", () => {
  it("wirft bei leerer Dateiliste einen ImportError", async () => {
    await expect(importFiles([], {})).rejects.toThrow(ImportError);
  });

  it("importiert mehrere Markdown-Dateien automatisch", async () => {
    const files: ImportFile[] = [
      { name: "a.md", text: "# Erstes\nInhalt" },
      { name: "b.md", text: "Zweiter Inhalt" },
    ];
    const doc = await importFiles(files, { splitOnH1: true });
    expect(doc.chapters.map((c) => c.title)).toEqual(["Erstes", "b"]);
  });

  it("importiert ein einzelnes Markdown-File über importFiles", async () => {
    const doc = await importFiles([{ name: "einzeln.md", text: "Nur Text." }]);
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].content).toContain("Nur Text");
  });

  it("importiert .scrivx als Text über die Fassade", async () => {
    const doc = await importFiles([{ name: "project.scrivx", text: SCRIVX }]);
    expect(doc.title).toBe("Fassaden-Projekt");
    expect(doc.chapters[0].title).toBe("Kapitel Eins");
  });

  it("wirft bei mehreren Nicht-Markdown-Dateien einen ImportError", async () => {
    await expect(
      importFiles([
        { name: "a.png", text: "x" },
        { name: "b.png", text: "y" },
      ]),
    ).rejects.toThrow(/Mehrere Dateien/);
  });

  it("wirft bei unbekanntem Format einen ImportError", async () => {
    await expect(importFiles([{ name: "datei.xyz", text: "x" }])).rejects.toThrow(
      /Nicht unterstütztes Format/,
    );
  });

  it("verlangt Binärdaten für DOCX", async () => {
    await expect(importFiles([{ name: "buch.docx" }])).rejects.toThrow(ImportError);
  });

  it("reicht Markdown-Bytes (ArrayBuffer/Uint8Array) durch", async () => {
    const bytes = new TextEncoder().encode("# Byte-Kapitel\nInhalt");
    const doc = await importFiles([{ name: "bytes.md", data: bytes }]);
    expect(doc.chapters[0].title).toBe("Byte-Kapitel");
  });

  it("meldet Fortschritt über onProgress", async () => {
    const events: [number, string][] = [];
    await importFiles([{ name: "x.md", text: "Text" }], {
      onProgress: (p, label) => events.push([p, label]),
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1][0]).toBe(100);
  });
});

describe("applyImport", () => {
  beforeEach(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON;");
    runMigrations(db);
    (globalThis as any).__aws_db = db;
  });

  afterEach(() => {
    delete (globalThis as any).__aws_db;
  });

  it("legt Projekt und Kapitel in der DB an und liefert die Projekt-ID", async () => {
    const events: [number, string][] = [];
    const projectId = await applyImport(
      {
        title: "Importiertes Buch",
        chapters: [
          { title: "Kapitel A", content: '{"type":"doc","content":[]}', orderIndex: 0 },
          { title: "Kapitel B", content: '{"type":"doc","content":[]}', orderIndex: 1 },
        ],
      },
      (p, label) => events.push([p, label]),
    );
    expect(projectId).toBeTruthy();
    expect(listChapters(projectId).map((c) => c.title)).toEqual(["Kapitel A", "Kapitel B"]);
    expect(events[events.length - 1][0]).toBe(100);
  });
});
