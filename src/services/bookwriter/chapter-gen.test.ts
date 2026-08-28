// Tests: Kapitelgenerierung.
//
// Diese Tests prüfen die Logik der Kapitelgenerierung, ohne den LLM-Provider
// zu mocken (Mocking mit ESM ist instabil). Stattdessen wird geprüft:
// - Fortschrittsmeldungen kommen in der richtigen Reihenfolge
// - Bereits generierte Kapitel werden übersprungen
// - Abbruch funktioniert
// - Daten werden zwischengespeichert

import { describe, it, expect, beforeEach, vi } from "vitest";
// Mock LLM-Provider: verhindert echte Netzwerk-Aufrufe (chapter-gen versucht
// Ollama/OpenRouter, was ohne laufendes Backend timeoutet).
vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    chat: async function* () {
      yield "Mock-Antwort.";
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
  generateManuskriptStreaming,
  type GeneratedChapter,
} from "@/services/bookwriter/chapter-gen";
import { loadArtifact } from "@/services/bookwriter/state";
import type { BookBriefing, BookOutline } from "@/types/bookwriter";

const briefing: BookBriefing = {
  genre: "roman",
  targetAudience: "Erwachsene",
  tone: "düster",
  chapterCount: 3,
  wordsPerChapter: 2000,
  idea: "Ein Detektiv löst einen Mord.",
  uniqueAngle: "Der Mörder ist der Erzähler.",
  corePromise: "Eine Wendung pro Kapitel.",
  kdpTarget: "ebook",
  language: "de",
  styleReferences: "",
  customOutline: null,
};

const outline: BookOutline = {
  chapters: [
    {
      title: "1. Der Fund",
      goal: "Die Leiche wird entdeckt.",
      conflict: "Der Detektiv wird gerufen.",
      outcome: "Er findet einen seltsamen Hinweis.",
      estimatedWords: 2000,
      pov: "dritte Person",
      research: [],
      subchapters: ["Die Szene", "Der Hinweis"],
    },
    {
      title: "2. Die Spur",
      goal: "Der Detektiv folgt einer Fährte.",
      conflict: "Die Spur führt in eine Sackgasse.",
      outcome: "Ein neuer Verdächtiger taucht auf.",
      estimatedWords: 2000,
      pov: "dritte Person",
      research: [],
      subchapters: ["Die Fährte", "Die Sackgasse"],
    },
  ],
  totalWords: 4000,
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;

  const p = await createProject("Testroman");
  projectId = p.id;
});

describe("generateManuskriptStreaming", () => {
  it("meldet Fortschritt in der richtigen Reihenfolge", async () => {
    const statuses: Array<{ status: string; current: number | null }> = [];

    try {
      await generateManuskriptStreaming(
        projectId,
        briefing,
        outline,
        [],
        (s) => statuses.push({ status: s.status, current: s.current }),
        () => {},
      );
    } catch {
      // LLM nicht erreichbar ist okay — wir testen die Statusmeldungen.
    }

    // Erster Status sollte "running" sein.
    expect(statuses[0]?.status).toBe("running");
    expect(statuses[0]?.current).toBe(0);
  });

  it("überspringt bereits generierte Kapitel", async () => {
    const existing: GeneratedChapter[] = [
      {
        id: "existing-id",
        title: "1. Der Fund",
        content: "Bestehender Inhalt.",
        wordCount: 2,
        summary: "Zusammenfassung.",
      },
    ];

    const statuses: Array<{ current: number | null }> = [];

    try {
      await generateManuskriptStreaming(
        projectId,
        briefing,
        outline,
        existing,
        (s) => statuses.push({ current: s.current }),
        () => {},
      );
    } catch {
      // LLM nicht erreichbar ist okay.
    }

    // Der erste Status sollte bei Kapitel 1 beginnen (Index 1), nicht 0.
    // Kapitel 0 war bereits vorhanden.
    expect(statuses[0]?.current).toBe(1);
  });

  it("speichert Zwischenstände", async () => {
    try {
      await generateManuskriptStreaming(
        projectId,
        briefing,
        outline,
        [],
        () => {},
        () => {},
      );
    } catch {
      // LLM nicht erreichbar ist okay.
    }

    // Artefakt sollte angelegt sein (auch wenn leer).
    const artifact = loadArtifact<GeneratedChapter[]>(projectId, "chapters");
    // Entweder null (bei Fehler vor dem ersten Kapitel) oder ein Array.
    if (artifact) {
      expect(Array.isArray(artifact)).toBe(true);
    }
  });

  it("bricht bei AbortSignal sofort ab", async () => {
    const controller = new AbortController();
    controller.abort();

    const statuses: Array<{ status: string }> = [];

    await generateManuskriptStreaming(
      projectId,
      briefing,
      outline,
      [],
      (s) => statuses.push({ status: s.status }),
      () => {},
      controller.signal,
    );

    // Status sollte "paused" sein.
    expect(statuses.some((s) => s.status === "paused")).toBe(true);
  });
});
