// @vitest-environment happy-dom
// BulkOrchestrator-Integrationstest: echter Adapter über den Bookwriter-
// Workflow (Sprint 5, Agent 2).
//
// Beweist die Kette: CSV-Text → parseBulkJobsCsv → BulkOrchestrator.runAll →
// pro Buch ein vollständiger Bookwriter-Lauf (Mock-LLM) → Cooldown &
// failed_jobs.json-Verhalten mit echten Workflows, nicht nur Fakes.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — diese Tests brauchen
// das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { parseBulkJobsCsv } from "./csvQueue";
import {
  BulkOrchestrator,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILED_JOBS_FILENAME,
  createBookJobRunner,
  bulkJobToBriefing,
} from "./bulkRunner";
import type { FailedJobsFile } from "./bulkOrchestrator";

// Mock des LLM-Moduls (wie workflow.e2e.test.ts — kompakte Antworten).
vi.mock("@/services/llm", () => ({
  completeOnce: vi.fn(async (_s: unknown, userContent: string) => {
    if (userContent.includes("10 Titel")) return "Bulk Titel\nAlt 1\nAlt 2";
    if (userContent.includes("Untertitel")) return "Ein Untertitel";
    if (userContent.includes("Positionierungen")) return "Position A\nPosition B";
    if (userContent.includes("Gliederung") || userContent.includes("JSON-Array")) {
      return JSON.stringify([
        {
          title: "1. Anfang",
          goal: "Welt etablieren.",
          conflict: "Ein Konflikt entsteht.",
          outcome: "Eine Entscheidung fällt.",
          estimatedWords: 300,
          pov: "dritte Person",
          research: [],
          subchapters: ["Szene 1"],
        },
      ]);
    }
    if (userContent.includes("Schreibe ein Kapitel")) {
      return "Der Morgen graute über den Hügeln. Ein kalter Wind strich durch die Äste. " +
        "Niemand war hier seit Jahren. Doch heute stand eine Gestalt am Fuß des Hügels.";
    }
    if (userContent.includes("Fasse das folgende Kapitel")) {
      return "Ein Protagonist bricht auf. Die Etappe endet mit einer Begegnung.";
    }
    if (userContent.includes("Keywords")) return "Keyword A\nKeyword B";
    if (userContent.includes("Klappentext")) {
      return "Eine Geschichte, die alles verändert. Wer dem Wald vertraut, sieht ihn nie wieder so.";
    }
    return "Mock-Antwort";
  }),
}));

const CSV = [
  "Titel,Genre,Target-Wörterzahl,Spezial-Prompt,Sprache",
  "Bulk Buch A,sachbuch,600,Praxisnah,de",
  "Bulk Buch B,roman,600,,en",
].join("\n");

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

describe("bulkRunner — Integration über den echten Workflow", () => {
  it("bulkJobToBriefing mappt CSV-Spalten auf ein gültiges BookBriefing", () => {
    const { jobs } = parseBulkJobsCsv(CSV);
    const b = bulkJobToBriefing(jobs[0]);
    expect(b.idea).toContain("Bulk Buch A");
    expect(b.genre).toBe("sachbuch");
    expect(b.language).toBe("de");
    expect(b.wordsPerChapter).toBeGreaterThan(0);
  });

  it("führt zwei komplette Buch-Läufe über CSV + Orchestrator aus", async () => {
    const { jobs } = parseBulkJobsCsv(CSV);
    expect(jobs).toHaveLength(2);

    const runner = createBookJobRunner();
    const writes: Array<{ filename: string; data: FailedJobsFile }> = [];
    const orch = new BulkOrchestrator(runner, {
      cooldownMs: 0,
      writeFileFn: async (f, d): Promise<void> => { writes.push({ filename: f, data: d }); }
    });

    const result = await orch.runAll(jobs);

    expect(result.completed).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(writes).toEqual([]);
    expect(result.cooldownsTaken).toBe(0); // cooldownMs=0 → kein Warten, aber Lücke zwischen 2 Büchern vorhanden
  }, 30_000);

  it("Resume-on-Crash: Lauf 2 crasht → failed_jobs.json, Lauf 3 läuft weiter", async () => {
    const csv = CSV + "\nBulk Buch C,krimi,600,,de";
    const { jobs } = parseBulkJobsCsv(csv);

    const runner = createBookJobRunner({
      failOnTitle: "Bulk Buch B",
      failure: new Error("fataler Modellfehler"),
    });
    const writes: Array<{ filename: string; data: FailedJobsFile }> = [];
    const orch = new BulkOrchestrator(runner, {
      cooldownMs: 0,
      writeFileFn: async (f, d): Promise<void> => { writes.push({ filename: f, data: d }); }
    });

    const result = await orch.runAll(jobs);

    expect(result.completed.map((j) => j.title)).toEqual(["Bulk Buch A", "Bulk Buch C"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      jobTitle: "Bulk Buch B",
      error: "fataler Modellfehler",
      fatal: true,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].filename).toBe(DEFAULT_FAILED_JOBS_FILENAME);
    expect(writes[0].data.failed[0].jobTitle).toBe("Bulk Buch B");
  }, 30_000);

  it("Default-Cooldown-Konstante ist unangetastet 60s", () => {
    expect(DEFAULT_COOLDOWN_MS).toBe(60_000);
  });
});
