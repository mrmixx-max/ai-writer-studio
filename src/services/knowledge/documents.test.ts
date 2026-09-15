// Tests: Dokumente als Wissensquellen (RAG-Upload: md/txt/docx → Index).
import { describe, expect, it, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject } from "@/services/project";
import { listSources } from "@/services/knowledge/sources";
import { listChunks } from "@/services/knowledge/chunks";
import {
  isSupportedDocument,
  readDocumentFile,
  addDocumentSource,
} from "./documents";
import { DEFAULT_SETTINGS } from "@/types/config";

/** Settings ohne erreichbares Modell — lexikalischer Index-Pfad. */
const OFFLINE_SETTINGS = {
  ...DEFAULT_SETTINGS,
  provider: "ollama" as const,
  ollamaBaseUrl: "http://127.0.0.1:9",
};

function clearTables() {
  const db = (globalThis as unknown as Record<string, { run: (s: string) => void } | undefined>).__aws_db;
  for (const t of ["knowledge_chunks", "knowledge_sources", "knowledge_index_jobs", "chapters", "projects"]) {
    db?.run(`DELETE FROM ${t}`);
  }
}

function mkFile(name: string, text: string) {
  return {
    name,
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

describe("isSupportedDocument", () => {
  it("akzeptiert md/txt/docx, lehnt Rest ab", () => {
    expect(isSupportedDocument("buch.md")).toBe(true);
    expect(isSupportedDocument("notizen.TXT")).toBe(true);
    expect(isSupportedDocument("vertrag.docx")).toBe(true);
    expect(isSupportedDocument("bild.png")).toBe(false);
    expect(isSupportedDocument("scan.pdf")).toBe(false);
  });
});

describe("readDocumentFile", () => {
  it("liest Markdown direkt", async () => {
    const r = await readDocumentFile(mkFile("buch.md", "# Titel\n\nText hier."));
    expect(r.name).toBe("buch.md");
    expect(r.text).toContain("Text hier.");
  });

  it("wirft bei leerer Datei und unbekanntem Format", async () => {
    await expect(readDocumentFile(mkFile("leer.md", "  \n "))).rejects.toThrow(/leer/i);
    await expect(readDocumentFile(mkFile("bild.png", "xx"))).rejects.toThrow(
      /nicht unterstützt/i,
    );
  });
});

describe("addDocumentSource", () => {
  beforeEach(async () => {
    await initDb();
    clearTables();
  });

  it("nimmt Text auf und indexiert ihn (Chunks vorhanden)", async () => {
    const { id: projectId } = await createProject("RAG-Projekt");
    const text = Array.from(
      { length: 3 },
      (_, i) => `Absatz ${i + 1} über Wahlkampf und programmatische Forderungen der Partei.`,
    ).join("\n\n");
    const src = await addDocumentSource(projectId, "programm.md", text, OFFLINE_SETTINGS);
    expect(src.title).toBe("programm.md");
    expect(src.sourceType).toBe("reference");

    const sources = listSources(projectId);
    expect(sources.some((s) => s.id === src.id)).toBe(true);
    const chunks = listChunks(projectId);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
