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
