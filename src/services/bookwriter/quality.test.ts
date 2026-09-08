// Tests: Qualitätsloop — reine Logik ohne LLM.

import { describe, it, expect, beforeEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — diese Tests brauchen
// das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
// Mock LLM-Provider: verhindert echte Netzwerk-Aufrufe, die sonst timeouten.
vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    chat: async function* () {
      yield JSON.stringify({ level: "yellow", score: 50, details: "Mock." });
    },
  }),
  buildMessages: (u: string, _s: unknown, h: unknown[]) => [
    ...(h ?? []),
    { role: "user", content: u },
  ],
}));
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  checkChapterQuality,
  runQualityLoop,
  type ChapterQualityResult,
} from "@/services/bookwriter/quality";
import { loadArtifact } from "@/services/bookwriter/state";
import { createRun } from "@/services/bookwriter/state";
import type { BookBriefing, OutlineChapter } from "@/types/bookwriter";

const briefing: BookBriefing = {
  genre: "roman",
  targetAudience: "Erwachsene",
  tone: "düster",
  chapterCount: 2,
  wordsPerChapter: 2000,
  idea: "Ein Detektiv löst einen Mord.",
  uniqueAngle: "Der Mörder ist der Erzähler.",
  corePromise: "Eine Wendung pro Kapitel.",
  kdpTarget: "ebook",
  language: "de",
  styleReferences: "",
  customOutline: null,
};

const outline: OutlineChapter[] = [
  {
    title: "1. Der Fund",
    goal: "Die Leiche wird entdeckt.",
    conflict: "Der Detektiv wird gerufen.",
    outcome: "Er findet einen seltsamen Hinweis.",
    estimatedWords: 100,
    pov: "dritte Person",
    research: [],
    subchapters: ["Die Szene", "Der Hinweis"],
  },
];

let projectId: string;
let runId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("Testroman");
  projectId = p.id;
  const run = createRun(projectId, "auto");
  runId = run.id;
});

describe("checkChapterQuality", () => {
  it("meldet bei sehr kurzen Kapiteln unter der Zielwortzahl", async () => {
    const content = "Ein kurzer Text.";

    const result = await checkChapterQuality(
      runId,
      briefing,
      outline[0],
      content,
      0,
      [{ title: outline[0].title, content }],
    );

    const lengthIssue = result.issues.find((i) => i.toLowerCase().includes("wortzahl"));
    expect(lengthIssue).toBeTruthy();
  });

  it("findet Füllwörter", async () => {
    const content = "Er war eigentlich irgendwie quasi gewissermaßen letztlich dort.";

    const result = await checkChapterQuality(
      runId,
      briefing,
      outline[0],
      content,
      0,
      [{ title: outline[0].title, content }],
    );

    const fillerIssue = result.issues.find((i) => i.includes("Füllwörter"));
    expect(fillerIssue).toBeTruthy();
  });

  it("speichert Ergebnis als Artefakt", async () => {
    const content = "Ein normaler Inhalt ohne besondere Mängel.";

    await checkChapterQuality(
      runId,
      briefing,
      outline[0],
      content,
      0,
      [{ title: outline[0].title, content }],
    );

    const artifact = loadArtifact<ChapterQualityResult>(runId, "chapter-0");
    expect(artifact).toBeTruthy();
    expect(artifact?.chapterTitle).toBe("1. Der Fund");
  });

  it("erzeugt Qualitätswerte", async () => {
    const content = "Ein normaler Inhalt.";

    const result = await checkChapterQuality(
      runId,
      briefing,
      outline[0],
      content,
      0,
      [{ title: outline[0].title, content }],
    );

    expect(result.scores.length).toBeGreaterThan(0);
    expect(result.overallLevel).toMatch(/green|yellow|red/);
  });
});

describe("runQualityLoop", () => {
  it("läuft über alle Kapitel", async () => {
    const chapters = [
      { title: "1. Der Fund", content: "Inhalt des ersten Kapitels." },
      { title: "2. Die Spur", content: "Inhalt des zweiten Kapitels." },
    ];

    const outline2: OutlineChapter[] = [
      outline[0],
      { ...outline[0], title: "2. Die Spur" },
    ];

    const results = await runQualityLoop(
      runId,
      briefing,
      chapters,
      outline2,
    );

    expect(results).toHaveLength(2);
  });

  it("speichert Gesamtergebnis", async () => {
    const chapters = [{ title: "1. Der Fund", content: "Inhalt." }];
    await runQualityLoop(runId, briefing, chapters, outline);

    const artifact = loadArtifact<ChapterQualityResult[]>(runId, "all");
    expect(artifact).toBeTruthy();
    expect(artifact?.length).toBe(1);
  });
});

// Mannered Prose (Sprint 20, Agent 1): rein regelbasiert, kein LLM.
describe("detectManneredProse", () => {
  it("findet 'earns its keep' mit direkter Alternative", async () => {
    const { detectManneredProse } = await import("@/services/bookwriter/quality");
    const r = detectManneredProse("This point earns its keep.");
    expect(r.flourishes.length).toBeGreaterThan(0);
    expect(r.flourishes.some((h) => h.original.toLowerCase().includes("earns its keep"))).toBe(true);
    expect(r.flourishes[0].suggestion).toBe("still matters");
    expect(r.score).toBeLessThan(100);
  });

  it("findet 'Each and every' (Großschreibung am Satzanfang)", async () => {
    const { detectManneredProse } = await import("@/services/bookwriter/quality");
    const r = detectManneredProse("Each and every parameter matters.");
    expect(r.flourishes.some((h) => h.original.toLowerCase() === "each and every")).toBe(true);
    expect(r.flourishes[0].suggestion.toLowerCase()).toBe("every");
  });

  it("bewertet direkten Text mit 100 (keine Flourishes)", async () => {
    const { detectManneredProse } = await import("@/services/bookwriter/quality");
    const r = detectManneredProse("The parameter is relevant.");
    expect(r.flourishes).toEqual([]);
    expect(r.score).toBe(100);
  });

  it("behandelt Leerstring mit Score 100 ohne Hits", async () => {
    const { detectManneredProse } = await import("@/services/bookwriter/quality");
    const r = detectManneredProse("");
    expect(r.score).toBe(100);
    expect(r.flourishes).toEqual([]);
  });

  it("erkennt 'dial worth turning' ohne Doppelzählung durch das generische worth-Muster", async () => {
    const { detectManneredProse } = await import("@/services/bookwriter/quality");
    const r = detectManneredProse("A dial worth turning is not a parameter worth varying.");
    const dial = r.flourishes.filter((h) => h.original.toLowerCase().includes("dial worth turning"));
    expect(dial).toHaveLength(1);
    expect(dial[0].suggestion).toBe("parameter worth varying");
    // „worth varying" allein wird als generischer Treffer markiert (manuell).
    expect(r.flourishes.some((h) => h.original.toLowerCase() === "worth varying")).toBe(true);
  });

  it("applyManneredFixes ersetzt automatisch Behebbares und lässt Manuelles stehen", async () => {
    const { detectManneredProse, applyManneredFixes } = await import("@/services/bookwriter/quality");
    const text = "This point earns its keep. At the end of the day, it is fine.";
    const r = detectManneredProse(text);
    const fixed = applyManneredFixes(text, r.flourishes);
    expect(fixed).toContain("still matters");
    expect(fixed).not.toContain("earns its keep");
    const again = detectManneredProse(fixed);
    expect(again.flourishes.some((h) => h.original.toLowerCase().includes("earns its keep"))).toBe(false);
  });

  it("analyzeTextQuality enthält die 9. Metrik directness", async () => {
    const { analyzeTextQuality } = await import("@/services/bookwriter/quality");
    const clean = analyzeTextQuality("The parameter is relevant. It stays stable.");
    expect(clean.directness.score).toBe(100);
    expect(clean.directness.level).toBe("good");
    const mannered = analyzeTextQuality("This point earns its keep. At the end of the day, each and every dial is fine.");
    expect(mannered.directness.score).toBeLessThan(100);
    expect(mannered.directness.suggestions.length).toBeGreaterThan(0);
  });
});
