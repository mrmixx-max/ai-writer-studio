// Tests: Batch-Insert-Optimierung in chunks.ts (replaceChunks).
//
// Prüft, dass replaceChunks alle Chunks einer Quelle in EINER Transaktion
// schreibt: Alte Chunks werden gelöscht, neue atomar eingefügt, Reihenfolge
// und Daten bleiben korrekt — auch bei großen Batches.

import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject } from "@/services/project";
import { upsertSource } from "@/services/knowledge/sources";
import {
  replaceChunks,
  listChunks,
  listChunksBySource,
  countChunks,
} from "@/services/knowledge/chunks";
import type { NewChunk } from "@/services/knowledge/chunks";

function chunk(i: number, text?: string): NewChunk {
  const t = text ?? `Absatz ${i} mit etwas Inhalt für den Index.`;
  return {
    chunkIndex: i,
    text: t,
    headingPath: "Kapitel 1 › Szene 2",
    tokenCount: Math.ceil(t.length / 3.4),
    embedding: null,
    embeddingModel: null,
    termFreq: JSON.stringify({ absatz: 1, inhalt: 1 }),
  };
}

async function freshProject(name = "BatchTest") {
  const db = (globalThis as any).__aws_db;
  for (const t of ["knowledge_chunks", "knowledge_sources", "knowledge_index_jobs", "chapters", "projects"]) {
    db.run(`DELETE FROM ${t}`);
  }
  return createProject(name);
}

/** Legt eine echte Quelle an (FOREIGN KEY auf knowledge_chunks.source_id). */
async function freshSource(projectId: string, refId: string) {
  const src = await upsertSource({
    projectId,
    sourceType: "note",
    refId,
    title: `Quelle ${refId}`,
    content: "Inhalt der Quelle für den Index.",
  });
  return src.id;
}

describe("replaceChunks — transaktioneller Batch-Insert", () => {
  beforeEach(async () => {
    await initDb();
  });

  it("fügt mehrere Chunks in einem Durchlauf ein", async () => {
    const p = await freshProject();
    const srcId = await freshSource(p.id, "n1");
    const n = await replaceChunks(p.id, srcId, "note", [0, 1, 2, 3, 4].map((i) => chunk(i)));
    expect(n).toBe(5);
    expect(countChunks(p.id)).toBe(5);
  });

  it("ersetzt bestehende Chunks einer Quelle atomar (keine Duplikate, keine Lücken)", async () => {
    const p = await freshProject();
    const srcId = await freshSource(p.id, "n1");
    await replaceChunks(p.id, srcId, "note", [0, 1, 2].map((i) => chunk(i)));
    await replaceChunks(p.id, srcId, "note", [0, 1].map((i) => chunk(i)));

    const all = listChunksBySource(srcId);
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.chunkIndex)).toEqual([0, 1]);
  });

  it("löscht nur die Chunks der betroffenen Quelle — andere Quellen bleiben unberührt", async () => {
    const p = await freshProject();
    const a = await freshSource(p.id, "nA");
    const b = await freshSource(p.id, "nB");
    await replaceChunks(p.id, a, "note", [0, 1].map((i) => chunk(i)));
    await replaceChunks(p.id, b, "note", [0].map((i) => chunk(i)));
    await replaceChunks(p.id, a, "note", [0].map((i) => chunk(i)));

    expect(listChunksBySource(a)).toHaveLength(1);
    expect(listChunksBySource(b)).toHaveLength(1);
    expect(countChunks(p.id)).toBe(2);
  });

  it("schreibt alle Felder korrekt (Text, Heading-Pfad, term_freq, created_at)", async () => {
    const p = await freshProject();
    const srcId = await freshSource(p.id, "n1");
    await replaceChunks(p.id, srcId, "chapter", [chunk(0)]);

    const [c] = listChunksBySource(srcId);
    expect(c.projectId).toBe(p.id);
    expect(c.sourceId).toBe(srcId);
    expect(c.sourceType).toBe("chapter");
    expect(c.chunkIndex).toBe(0);
    expect(c.text).toContain("Absatz 0");
    expect(c.headingPath).toBe("Kapitel 1 › Szene 2");
    expect(c.tokenCount).toBeGreaterThan(0);
    expect(JSON.parse(c.termFreq!)).toEqual({ absatz: 1, inhalt: 1 });
    expect(c.createdAt).toBeGreaterThan(0);
    expect(c.embedding).toBeNull();
  });

  it("behandelt einen großen Batch (500 Chunks) performant in einer Transaktion", async () => {
    const p = await freshProject();
    const srcId = await freshSource(p.id, "big");
    const big = Array.from({ length: 500 }, (_, i) => chunk(i, `Chunk Nummer ${i}. ` + "Inhalt. ".repeat(20)));

    const t0 = performance.now();
    const n = await replaceChunks(p.id, srcId, "chapter", big);
    const ms = performance.now() - t0;

    expect(n).toBe(500);
    expect(countChunks(p.id)).toBe(500);
    // Transaktionaler Batch-Insert muss auch bei 500 Chunks im Sub-Sekundenbereich bleiben.
    expect(ms).toBeLessThan(2000);
  });

  it("liefert Chunks projektweit sortiert nach Quelle und Chunk-Index", async () => {
    const p = await freshProject();
    const srcA = await freshSource(p.id, "nA");
    const srcB = await freshSource(p.id, "nB");
    await replaceChunks(p.id, srcB, "note", [1, 0].map((i) => chunk(i)));
    await replaceChunks(p.id, srcA, "note", [0, 1].map((i) => chunk(i)));

    const all = listChunks(p.id);
    // Sortierung: erst nach source_id, dann nach chunk_index
    const actual = all.map((c) => `${c.sourceId}:${c.chunkIndex}`);
    const sorted = [...actual].sort((x, y) => x.localeCompare(y));
    expect(actual).toEqual(sorted);
    expect(actual).toHaveLength(4);
    expect(new Set(actual.map((s) => s.split(":")[0]))).toEqual(new Set([srcA, srcB]));
  });

  it("akzeptiert einen leeren Batch (löscht alte Chunks, fügt nichts ein)", async () => {
    const p = await freshProject();
    const srcId = await freshSource(p.id, "n1");
    await replaceChunks(p.id, srcId, "note", [0, 1].map((i) => chunk(i)));
    const n = await replaceChunks(p.id, srcId, "note", []);
    expect(n).toBe(0);
    expect(countChunks(p.id)).toBe(0);
  });
});
