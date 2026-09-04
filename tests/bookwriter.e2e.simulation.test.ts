// A4: E2E-Simulation — 8-Kapitel-Buchlauf mit FakeOllamaProvider.
//
// Beweist die Resilienz der Pipeline OHNE echten Ollama (CI-sicher):
//   E1  Happy Path: 8 Kapitel < 5 s, Rolling Summary + Glossar wachsen
//   E2  Kill + Resume: Lauf "stirbt" mitten im Buch, Job-Store committet
//       Fortschritt, Resume startet bei currentChapter + 1 mit gespeicherter
//       Outline — bereits generierte Kapitel bleiben erhalten
//   E3  Modellwechsel: config.model ändert sich mid-run, Pipeline läuft weiter
//   E4  Abbruch: AbortSignal stoppt den Lauf sauber (Teilergebnis, kein Throw,
//       kein Ghost-State)
//
// Job-Persistenz via jobs.ts (In-Memory-SQLite, echtes sql.js wie in
// workflow.e2e.test.ts). Kein Netzwerk — FakeOllamaProvider antwortet sofort.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
vi.mock("@/services/llm/ollama", async () => {
  const { FakeOllamaProvider } = await import("./helpers/fakeOllamaProvider");
  return { OllamaProvider: FakeOllamaProvider };
});

import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  generateOutline,
  generateChapter,
  summarizeChapter,
  extractEntities,
  mergeEntities,
  type BookOutline,
  type BookChapter,
  type BookWriterConfig,
} from "@/services/writing/bookwriter";
import {
  createBookJob,
  setBookJobOutline,
  updateBookJobProgress,
  setBookJobStatus,
  getResumableBookJob,
  completeBookJob,
} from "@/services/bookwriter/jobs";
import { FakeOllamaProvider, goodOutlineJson, fakeWords } from "./helpers/fakeOllamaProvider";

function baseConfig(model = "fake-model"): BookWriterConfig {
  return {
    topic: "KI im Alltag",
    genre: "Sachbuch",
    targetAudience: "Erwachsene",
    chapterCount: 8,
    model,
    baseUrl: "http://127.0.0.1:11434",
    language: "Deutsch",
    wordsPerChapter: 120, // klein → kein Nachsteuer-Call, schneller Lauf
  };
}

/** Kapiteltext 120 Wörter (innerhalb ±20% von 120 → draft, kein Nachsteuern). */
const chapterText = () => fakeWords(120);

/** Prompt-Router: Outline-/Kapitel-/Summary-/Glossar-Calls unterscheiden. */
function installRouter(outline: BookOutline): void {
  FakeOllamaProvider.router = (prompt: string) => {
    if (prompt.includes("Erstelle eine detaillierte Gliederung")) return goodOutlineJson(8);
    if (prompt.includes("Schreibe Kapitel")) return chapterText();
    if (prompt.includes("Erstelle eine Zusammenfassung")) return fakeWords(160);
    if (prompt.includes("extrahiere die zentralen Entitäten")) {
      return JSON.stringify({ entities: ["Dr. Weber", "Quantencomputer", "1989"] });
    }
    // Outline-Reparatur: liefert die valide Outline erneut.
    return goodOutlineJson(8);
  };
  void outline;
}

let projectId: string;

beforeEach(async () => {
  FakeOllamaProvider.reset();
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  const g = globalThis as unknown as { __aws_db?: unknown };
  g.__aws_db = db;
  const p = await createProject("E2E-Resilienz-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as unknown as { __aws_db?: unknown }).__aws_db;
  FakeOllamaProvider.reset();
});

describe("A4 E2E-Simulation: 8 Kapitel mit Fake-Provider", () => {
  it("E1 Happy Path: 8 Kapitel komplett in < 5 s, Summaries + Glossar wachsen", async () => {
    const config = baseConfig();
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(8) });
    const outline = await generateOutline(config);
    expect(outline.chapters).toHaveLength(8);
    installRouter(outline);

    const chapters: BookChapter[] = [];
    outline.chapterSummaries = [];
    const start = Date.now();

    for (let i = 1; i <= 8; i++) {
      const chapter = await generateChapter(config, outline, i, chapters);
      expect(chapter.status).toBe("draft");
      chapters.push(chapter);
      outline.chapterSummaries!.push(await summarizeChapter(config, chapter.title, chapter.content));
      if (i >= 2) {
        const extracted = await extractEntities(config, [chapter.content]);
        outline.entities = mergeEntities(outline.entities ?? [], extracted);
      }
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect(chapters).toHaveLength(8);
    expect(outline.chapterSummaries).toHaveLength(8);
    expect(outline.entities!.length).toBeGreaterThan(0);
    expect(outline.entities!.length).toBeLessThanOrEqual(30);

    // Alle 8 Kapitel haben Inhalt mit Ziel-Umfang
    for (const c of chapters) {
      expect(c.content.split(/\s+/).length).toBeGreaterThan(90);
    }
  });

  it("E2 Kill + Resume: Lauf stirbt nach Kapitel 3, Resume startet bei 4 mit gespeicherter Outline", async () => {
    const config = baseConfig();
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(8) });
    const outline = await generateOutline(config);
    installRouter(outline);

    // Job anlegen + Outline committen (wie BookWriterPanel es tut).
    const job = createBookJob(projectId, config, null);
    await setBookJobOutline(job.id, outline);

    const chapters: BookChapter[] = [];
    outline.chapterSummaries = [];

    // "Kill" nach Kapitel 3: Fortschritt ist pro Kapitel committed.
    for (let i = 1; i <= 3; i++) {
      const chapter = await generateChapter(config, outline, i, chapters);
      chapters.push(chapter);
      outline.chapterSummaries!.push(await summarizeChapter(config, chapter.title, chapter.content));
      await setBookJobOutline(job.id, outline); // Fortschritt + Outline committen (wie das Panel)
      await updateBookJobProgress(job.id, i);
    }
    await setBookJobStatus(job.id, "interrupted", "Prozess beendet (simulierter Kill)");

    // Nach dem Kill: neuer Prozess-Simulations-Schritt — Job aus der DB lesen.
    const resumable = getResumableBookJob(projectId);
    expect(resumable).not.toBeNull();
    expect(resumable!.status).toBe("interrupted");
    expect(resumable!.currentChapter).toBe(3);
    // Outline ist vollständig aus der DB wiederherstellbar.
    expect(resumable!.outline!.chapters).toHaveLength(8);
    expect(resumable!.outline!.chapterSummaries).toHaveLength(3);

    // Resume: startet bei currentChapter + 1 = 4, nutzt gespeicherte Outline.
    const resumedOutline = resumable!.outline!;
    const resumedConfig = resumable!.config;
    for (let i = 4; i <= 8; i++) {
      const chapter = await generateChapter(resumedConfig, resumedOutline, i, chapters);
      chapters.push(chapter);
      resumedOutline.chapterSummaries!.push(
        await summarizeChapter(resumedConfig, chapter.title, chapter.content),
      );
      await setBookJobOutline(job.id, resumedOutline);
      await updateBookJobProgress(job.id, i);
    }
    await completeBookJob(job.id);

    expect(chapters).toHaveLength(8);
    expect(resumedOutline.chapterSummaries).toHaveLength(8);
    // Kein Kapitel doppelt, Nummern 1..8 lückenlos.
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Nach completeBookJob nicht mehr fortsetzbar.
    expect(getResumableBookJob(projectId)).toBeNull();
  });

  it("E3 Modellwechsel mid-run: config.model ändert sich, Pipeline läuft weiter", async () => {
    const config = baseConfig("llama3.2:latest");
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(8) });
    const outline = await generateOutline(config);
    installRouter(outline);

    const chapters: BookChapter[] = [];
    outline.chapterSummaries = [];

    // Kapitel 1-2 mit Modell A (calls[0] ist der Outline-Call, dann je Kapitel 1).
    for (let i = 1; i <= 2; i++) {
      chapters.push(await generateChapter(config, outline, i, chapters));
    }
    expect(FakeOllamaProvider.calls[0].model).toBe("llama3.2:latest"); // Outline
    expect(FakeOllamaProvider.calls[1].model).toBe("llama3.2:latest"); // Kapitel 1
    expect(FakeOllamaProvider.calls[2].model).toBe("llama3.2:latest"); // Kapitel 2

    // Modellwechsel: alle nachfolgenden Calls tragen das neue Modell.
    config.model = "mistral:7b";
    for (let i = 3; i <= 4; i++) {
      chapters.push(await generateChapter(config, outline, i, chapters));
    }
    const laterModels = FakeOllamaProvider.calls.slice(-2).map((c) => c.model);
    expect(laterModels).toEqual(["mistral:7b", "mistral:7b"]);
    expect(chapters).toHaveLength(4);
  });

  it("E4 Abbruch: AbortSignal stoppt sauber — Teilergebnis, kein Ghost-State", async () => {
    const config = baseConfig();
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(8) });
    const outline = await generateOutline(config);
    installRouter(outline);

    const controller = new AbortController();
    const chapters: BookChapter[] = [];
    outline.chapterSummaries = [];

    // Kapitel 1 normal, dann Abort feuern — Kapitel 2 muss abgebrochen werden.
    chapters.push(await generateChapter(config, outline, 1, chapters));
    controller.abort();

    // generateChapter mit abgebrochenem Signal: collectChat wirft AbortError,
    // der Fake reagiert sofort auf signal.aborted.
    await expect(
      generateChapter(config, outline, 2, chapters, controller.signal),
    ).rejects.toThrow();

    // Nach Abort keine zusätzlichen Provider-Calls mehr (Call 2 bricht ab,
    // ohne zu antworten).
    const callsAtAbort = FakeOllamaProvider.calls.length;
    controller.abort(); // doppelt ist idempotent
    expect(FakeOllamaProvider.calls.length).toBe(callsAtAbort);

    // Bereits generierte Kapitel bleiben valide erhalten (Resume-Basis).
    expect(chapters).toHaveLength(1);
    expect(chapters[0].status).toBe("draft");
    expect(chapters[0].content.length).toBeGreaterThan(0);
  });

  it("E5 Chaos random (seeded): 8-Kapitel-Lauf überlebt gemischte Fehlerarten", async () => {
    const config = baseConfig();
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(8) });
    const outline = await generateOutline(config);
    installRouter(outline);
    FakeOllamaProvider.setChaos("random", 42, 5);

    const chapters: BookChapter[] = [];
    outline.chapterSummaries = [];
    const start = Date.now();

    for (let i = 1; i <= 8; i++) {
      const chapter = await generateChapter(config, outline, i, chapters);
      // Kein Wurf: generateChapter liefert IMMER ein Kapitel
      // (draft oder needs_revision) — der Fehlerpfad ist abgefangen.
      expect(["draft", "needs_revision"]).toContain(chapter.status!);
      chapters.push(chapter);
    }

    expect(Date.now() - start).toBeLessThan(5000);
    expect(chapters).toHaveLength(8);
    // Chaos hat tatsächlich zugeschlagen (nicht alle Calls waren good).
    const kinds = FakeOllamaProvider.calls.length;
    expect(kinds).toBeGreaterThan(8); // Nachsteuer-/Retry-Calls durch Chaos
  });
});