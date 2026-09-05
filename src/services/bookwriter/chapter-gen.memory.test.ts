// Tests: Sprint 3 Integration — Memory-Kontext in der Kapitelgenerierung.
//
// Akzeptanzkriterium (Injektion): generateChapter injiziert den
// ContextManager-Kontextblock in den Prompt — bei leerer Base bleibt der
// Prompt unverändert (keine Breaking Changes).
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
// LLM-Provider mocken (gleiche Technik wie chapter-gen.test.ts) und den
// Prompt abfangen.
const captured: string[] = [];
vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    chat: async function* () {
      yield "Mock-Antwort.";
    },
  }),
  buildMessages: (u: string, _s: unknown, h: unknown[]) => {
    captured.push(u);
    return [...(h ?? []), { role: "user", content: u }];
  },
}));
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { generateChapter } from "./chapter-gen";
import { upsertFacts } from "./contextManager";
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

const chapter: OutlineChapter = {
  title: "1. Der Fund",
  goal: "Die Leiche wird entdeckt.",
  conflict: "Der Detektiv wird gerufen.",
  outcome: "Er findet einen seltsamen Hinweis.",
  estimatedWords: 2000,
  pov: "dritte Person",
  research: [],
  subchapters: ["Die Szene"],
};

let projectId: string;

beforeEach(async () => {
  captured.length = 0;
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  db.exec("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',1,1)");
  projectId = "p1";
});

describe("Memory-Injektion in generateChapter", () => {
  it("Fakten aus der Base erscheinen im Kapitel-Prompt", async () => {
    await upsertFacts(projectId, [
      { kind: "character", key: "Anna Weber", value: "Detektivin, 34 Jahre", confidence: 1 },
      { kind: "timeline", key: "Handlungszeitraum", value: "Herbst 1987", confidence: 1 },
    ]);

    await generateChapter(briefing, chapter, [], () => {}, undefined, projectId);

    expect(captured.length).toBe(1);
    expect(captured[0]).toContain("Stabiler Kontext");
    expect(captured[0]).toContain("Anna Weber: Detektivin, 34 Jahre");
    expect(captured[0]).toContain("Handlungszeitraum: Herbst 1987");
  });

  it("leere Memory-Base → Prompt ohne Kontextblock (unverändert)", async () => {
    await generateChapter(briefing, chapter, [], () => {}, undefined, projectId);
    expect(captured.length).toBe(1);
    expect(captured[0]).not.toContain("Stabiler Kontext");
  });

  it("ohne projectId: kein Kontext-Zugriff, Prompt ohne Block", async () => {
    await generateChapter(briefing, chapter, [], () => {}, undefined, undefined);
    expect(captured.length).toBe(1);
    expect(captured[0]).not.toContain("Stabiler Kontext");
  });
});
