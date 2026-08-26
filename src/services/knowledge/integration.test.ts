// Integrationstests: Indexer + Retrieval gegen echte In-Memory-DB, ohne LLM.
// Prüft insbesondere den Offline-Pfad: ohne Embedding-Modell muss alles funktionieren.

import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject, createChapter } from "@/services/project";
import { upsertSource, listSources, sourceStats, addReferenceText } from "@/services/knowledge/sources";
import { countChunks, countEmbeddedChunks, listChunks } from "@/services/knowledge/chunks";
import { indexProject } from "@/services/knowledge/indexer";
import { searchKnowledge, formatContextBlock } from "@/services/knowledge/retrieval";
import { syncProjectSources } from "@/services/knowledge/sync";
import { DEFAULT_SETTINGS } from "@/types/config";

/** Settings, die garantiert kein Modell erreichen — erzwingt den Offline-Pfad. */
const OFFLINE_SETTINGS = {
  ...DEFAULT_SETTINGS,
  provider: "ollama" as const,
  ollamaBaseUrl: "http://127.0.0.1:9",
};

function tiptap(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  });
}

async function freshProject(name = "Testroman") {
  const db = (globalThis as any).__aws_db;
  for (const t of ["knowledge_chunks", "knowledge_sources", "knowledge_index_jobs", "chapters", "projects"]) {
    db.run(`DELETE FROM ${t}`);
  }
  return createProject(name);
}

describe("Knowledge-Integration (offline)", () => {
  beforeEach(async () => {
    await initDb();
  });

  it("indexiert eine Quelle ohne Embedding-Modell lexikalisch", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id,
      sourceType: "note",
      refId: "n1",
      title: "Figurennotiz",
      content: "# Anna\n\nAnna ist Ärztin in Hamburg. Sie trägt einen blauen Mantel.",
    });

    const res = await indexProject(p.id, OFFLINE_SETTINGS);

    expect(res.sourcesProcessed).toBe(1);
    expect(res.chunksCreated).toBeGreaterThan(0);
    expect(res.strategy).toBe("lexical");
    expect(res.degraded).toBe(true);
    expect(res.notice).toBeTruthy();
    expect(res.failures).toHaveLength(0);
  });

  it("setzt den Quellenstatus nach dem Indexieren auf indexed", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Ein Satz mit Inhalt.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    const stats = sourceStats(p.id);
    expect(stats.indexed).toBe(1);
    expect(stats.stale).toBe(0);
    expect(stats.chunkCount).toBeGreaterThan(0);
  });

  it("schreibt Postings, aber keine Embeddings, wenn kein Modell erreichbar ist", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Anna ging durch den Regen nach Hamburg.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    expect(countChunks(p.id)).toBeGreaterThan(0);
    expect(countEmbeddedChunks(p.id)).toBe(0);
    const chunks = listChunks(p.id);
    expect(chunks[0].termFreq).toBeTruthy();
    expect(chunks[0].embedding).toBeNull();
  });

  it("markiert eine geänderte Quelle als stale", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Erste Version des Textes.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);
    expect(sourceStats(p.id).indexed).toBe(1);

    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Zweite, geänderte Version des Textes.",
    });
    expect(sourceStats(p.id).stale).toBe(1);
  });

  it("erzeugt bei Reindexierung keine Duplikate", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Text. ".repeat(200),
    });
    await indexProject(p.id, OFFLINE_SETTINGS);
    const first = countChunks(p.id);
    await indexProject(p.id, OFFLINE_SETTINGS, { force: true });
    expect(countChunks(p.id)).toBe(first);
  });

  it("findet indexierte Inhalte über die lexikalische Suche", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "character", refId: "c1",
      title: "Figur: Anna", content: "# Figur: Anna\n\nAnna ist Ärztin und trägt einen blauen Mantel.",
    });
    await upsertSource({
      projectId: p.id, sourceType: "location", refId: "l1",
      title: "Ort: Hafen", content: "# Ort: Hafen\n\nDer Hafen liegt im Norden und riecht nach Diesel.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    const res = await searchKnowledge(p.id, "Mantel", OFFLINE_SETTINGS);
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0].sourceTitle).toBe("Figur: Anna");
    expect(res.strategyUsed).toBe("lexical");
    expect(res.degraded).toBe(true);
    expect(res.notice).toBeTruthy(); // ehrliche Meldung, kein stilles Degradieren
  });

  it("liefert bei leerem Index eine klare Meldung statt Treffer", async () => {
    const p = await freshProject();
    const res = await searchKnowledge(p.id, "irgendwas", OFFLINE_SETTINGS);
    expect(res.hits).toHaveLength(0);
    expect(res.notice).toContain("leer");
  });

  it("findet im Modus exact nur wörtliche Übereinstimmungen", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "N", content: "Sie trug einen blauen Mantel durch die Stadt.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    const hit = await searchKnowledge(p.id, "blauen Mantel", OFFLINE_SETTINGS, { mode: "exact" });
    expect(hit.hits.length).toBe(1);

    const miss = await searchKnowledge(p.id, "grünen Mantel", OFFLINE_SETTINGS, { mode: "exact" });
    expect(miss.hits).toHaveLength(0);
    expect(miss.notice).toContain("keine exakte");
  });

  it("filtert nach Quellentypen", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "character", refId: "c1",
      title: "Figur: Anna", content: "Anna trägt einen Mantel.",
    });
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "Notiz", content: "Der Mantel ist ein Motiv.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    const res = await searchKnowledge(p.id, "Mantel", OFFLINE_SETTINGS, { sourceTypes: ["character"] });
    expect(res.hits.every((h) => h.sourceType === "character")).toBe(true);
  });

  it("formatiert Treffer mit Quellenangabe für den Prompt", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1",
      title: "Notiz A", content: "# Kapitelidee\n\nAnna verliert den Mantel im Hafen.",
    });
    await indexProject(p.id, OFFLINE_SETTINGS);

    const res = await searchKnowledge(p.id, "Mantel Hafen", OFFLINE_SETTINGS);
    const block = formatContextBlock(res);
    expect(block).toContain("[Quelle 1:");
    expect(block).toContain("Notiz A");
  });

  it("respektiert das Zeichenlimit des Kontextblocks", async () => {
    const p = await freshProject();
    for (let i = 0; i < 5; i++) {
      await upsertSource({
        projectId: p.id, sourceType: "note", refId: `n${i}`,
        title: `Notiz ${i}`, content: `Mantel Thema ${i}. ` + "Füllsatz zum Mantel. ".repeat(80),
      });
    }
    await indexProject(p.id, OFFLINE_SETTINGS);
    const res = await searchKnowledge(p.id, "Mantel", OFFLINE_SETTINGS, { limit: 8 });
    const block = formatContextBlock(res, 500);
    expect(block.length).toBeLessThanOrEqual(700); // 500 + ein Blockrest
  });

  it("übernimmt Kapitel per Sync als Wissensquellen", async () => {
    const p = await freshProject();
    await createChapter(p.id, "Kapitel 1", tiptap(["Anna betrat den Hafen.", "Es regnete."]));
    await createChapter(p.id, "Kapitel 2", tiptap(["Bernd wartete."]));

    const result = await syncProjectSources(p.id);
    expect(result.created).toBe(2);

    const sources = listSources(p.id);
    expect(sources.filter((s) => s.sourceType === "chapter")).toHaveLength(2);
  });

  it("löscht beim Sync keine manuell angelegten Referenztexte", async () => {
    const p = await freshProject();
    await addReferenceText(p.id, "Recherche", "Historische Notizen zum Hafen.");
    await syncProjectSources(p.id);
    const sources = listSources(p.id);
    expect(sources.some((s) => s.sourceType === "reference")).toBe(true);
  });

  it("indexiert nur die angeforderte Quelle", async () => {
    const p = await freshProject();
    const a = await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1", title: "A", content: "Text A.",
    });
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n2", title: "B", content: "Text B.",
    });

    const res = await indexProject(p.id, OFFLINE_SETTINGS, { sourceId: a.id });
    expect(res.sourcesProcessed).toBe(1);

    const stats = sourceStats(p.id);
    expect(stats.indexed).toBe(1);
    expect(stats.pending).toBe(1);
  });

  it("behandelt eine leere Quelle als indexiert, nicht als Fehler", async () => {
    const p = await freshProject();
    await upsertSource({
      projectId: p.id, sourceType: "note", refId: "n1", title: "Leer", content: "",
    });
    const res = await indexProject(p.id, OFFLINE_SETTINGS);
    expect(res.failures).toHaveLength(0);
    expect(sourceStats(p.id).indexed).toBe(1);
    expect(countChunks(p.id)).toBe(0);
  });
});
