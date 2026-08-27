// Tests: Projektwissen-Ablauf gegen echte DB, ohne Modell.
//
// Geprüft wird die Kette, die der Tab auslöst: Quellen einlesen, indexieren,
// suchen, fragen. Kein Rendering — nur das, was hinter den Knöpfen passiert.

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createSampleProject } from "@/services/setup/sampleProject";
import { syncProjectSources } from "@/services/knowledge/sync";
import { indexProject, indexSingleSource } from "@/services/knowledge/indexer";
import { listSources, sourceStats } from "@/services/knowledge/sources";
import { searchKnowledge, formatContextBlock } from "@/services/knowledge/retrieval";
import { askProject, buildQuestion } from "@/services/knowledge/ask";
import { DEFAULT_SETTINGS } from "@/types/config";
import type { AppSettings } from "@/types/config";

// Garantiert geschlossener Port: erzwingt den Offline-Pfad.
const OFFLINE: AppSettings = {
  ...DEFAULT_SETTINGS,
  ollamaBaseUrl: "http://127.0.0.1:9",
  lmstudioBaseUrl: "http://127.0.0.1:9",
  openaiApiKey: "",
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  projectId = await createSampleProject();
});

describe("Quellen einlesen", () => {
  it("erfasst Kapitel, Figuren und Notizen des Beispielprojekts", async () => {
    const r = await syncProjectSources(projectId);
    expect(r.created).toBeGreaterThan(0);

    const sources = listSources(projectId);
    const types = new Set(sources.map((s) => s.sourceType));
    expect(types).toContain("chapter");
    expect(types).toContain("character");
    expect(types).toContain("note");
    // 3 Kapitel + 2 Figuren + 2 Notizen
    expect(sources.length).toBe(7);
  });

  it("ist idempotent: zweiter Lauf legt nichts neu an", async () => {
    await syncProjectSources(projectId);
    const second = await syncProjectSources(projectId);
    expect(second.created).toBe(0);
    expect(listSources(projectId).length).toBe(7);
  });

  it("setzt neue Quellen auf pending, nicht auf indexed", async () => {
    await syncProjectSources(projectId);
    const stats = sourceStats(projectId);
    expect(stats.indexed).toBe(0);
    expect(stats.total).toBe(7);
  });
});

describe("Indexieren ohne Modell", () => {
  it("laeuft durch und meldet die Einschraenkung", async () => {
    await syncProjectSources(projectId);
    const r = await indexProject(projectId, OFFLINE);

    expect(r.sourcesProcessed).toBe(7);
    expect(r.chunksCreated).toBeGreaterThan(0);
    // Ohne Embedding-Modell MUSS die Einschraenkung gemeldet werden.
    expect(r.degraded).toBe(true);
    expect(r.notice).toBeTruthy();
    expect(r.strategy).toBe("lexical");
  });

  it("setzt den Status auf indexed und zaehlt Abschnitte", async () => {
    await syncProjectSources(projectId);
    await indexProject(projectId, OFFLINE);

    const stats = sourceStats(projectId);
    expect(stats.indexed).toBe(7);
    expect(stats.pending).toBe(0);
    expect(stats.chunkCount).toBeGreaterThan(0);
  });

  it("indexiert beim zweiten Lauf nichts erneut", async () => {
    await syncProjectSources(projectId);
    await indexProject(projectId, OFFLINE);
    const second = await indexProject(projectId, OFFLINE);
    expect(second.sourcesProcessed).toBe(0);
  });

  it("erzwingt mit force eine vollstaendige Neuindexierung", async () => {
    await syncProjectSources(projectId);
    const first = await indexProject(projectId, OFFLINE);
    const forced = await indexProject(projectId, OFFLINE, { force: true });

    expect(forced.sourcesProcessed).toBe(7);
    // Keine Dubletten: gleiche Anzahl Abschnitte wie beim ersten Lauf.
    expect(sourceStats(projectId).chunkCount).toBe(first.chunksCreated);
  });

  it("meldet Fortschritt fuer die Anzeige", async () => {
    await syncProjectSources(projectId);
    const seen: Array<{ done: number; total: number }> = [];
    await indexProject(projectId, OFFLINE, {
      onProgress: (done, total) => seen.push({ done, total }),
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].done).toBe(seen[seen.length - 1].total);
  });

  it("indexiert eine einzelne Quelle", async () => {
    await syncProjectSources(projectId);
    const one = listSources(projectId)[0];
    const r = await indexSingleSource(projectId, one.id, OFFLINE);

    expect(r.chunksCreated).toBeGreaterThan(0);
    expect(sourceStats(projectId).indexed).toBe(1);
  });
});

describe("Suche", () => {
  beforeEach(async () => {
    await syncProjectSources(projectId);
    await indexProject(projectId, OFFLINE);
  });

  it("findet eine Figur ueber den Wortlaut", async () => {
    const r = await searchKnowledge(projectId, "Marta", OFFLINE, { mode: "exact" });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.some((h) => h.text.includes("Marta"))).toBe(true);
  });

  it("faellt bei Bedeutungssuche ohne Modell lexikalisch zurueck und sagt es", async () => {
    const r = await searchKnowledge(projectId, "Archiv", OFFLINE, { mode: "semantic" });
    expect(r.degraded).toBe(true);
    expect(r.notice).toBeTruthy();
    expect(r.strategyUsed).toBe("lexical");
  });

  it("liefert Treffer mit Quellenangabe und Wertung", async () => {
    const r = await searchKnowledge(projectId, "Brief", OFFLINE);
    expect(r.hits.length).toBeGreaterThan(0);
    for (const h of r.hits) {
      expect(h.sourceTitle).toBeTruthy();
      expect(h.sourceType).toBeTruthy();
      expect(h.score).toBeGreaterThan(0);
    }
  });

  it("formatiert einen Kontextblock mit Quellennummern", async () => {
    const r = await searchKnowledge(projectId, "Kessler", OFFLINE);
    const block = formatContextBlock(r);
    expect(block).toContain("Quelle 1");
    expect(block.length).toBeGreaterThan(20);
  });

  it("gibt bei sinnlosem Begriff keine Treffer, ohne zu werfen", async () => {
    const r = await searchKnowledge(projectId, "zzzqqqxyz", OFFLINE, { mode: "exact" });
    expect(r.hits).toHaveLength(0);
  });
});

describe("Frage an das Projekt", () => {
  beforeEach(async () => {
    await syncProjectSources(projectId);
    await indexProject(projectId, OFFLINE);
  });

  it("liefert ohne Modell die Fundstellen statt eines Fehlers", async () => {
    const r = await askProject(projectId, "Was weiss das Projekt über Marta?", OFFLINE);

    expect(r.llmUnavailable).toBe(true);
    expect(r.notice).toBeTruthy();
    // Der Autor muss trotzdem etwas in der Hand haben.
    expect(r.answer.length).toBeGreaterThan(20);
    expect(r.retrieval.hits.length).toBeGreaterThan(0);
  });

  it("nennt Quellen zu jeder Antwort", async () => {
    const r = await askProject(projectId, "Wer ist Kessler?", OFFLINE);
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("baut die vordefinierten Fragen korrekt", () => {
    const about = buildQuestion("about", "Marta");
    expect(about.question).toContain("Marta");
    expect(about.query).toBe("Marta");

    const conflicts = buildQuestion("conflicts", "");
    expect(conflicts.question).toContain("Konflikte");
    expect(conflicts.query.length).toBeGreaterThan(0);
  });
});
