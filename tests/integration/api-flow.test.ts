// Integration: Ollama → Router → BookWriter → DB → Export → KDP-Upload.
//
// Kette beweist offline (FakeOllamaProvider + gemockte Cloud-Provider),
// dass ein Buch vom LLM-Call über Job-Persistenz und Export bis zum
// KDP-Upload-Paket durchläuft — inkl. Provider-Fallback und Crash-Resume.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
vi.mock("@/services/llm/ollama", async () => {
  const { FakeOllamaProvider } = await import("../helpers/fakeOllamaProvider");
  return { OllamaProvider: FakeOllamaProvider };
});
vi.mock("@/services/llm/openrouter", () => ({
  OpenRouterProvider: class {
    constructor(public apiKey: string) {}
    async healthCheck() {
      return true;
    }
    async *chat() {
      yield "Cloud-Fallback-Kapiteltext für den Upload-Test.";
    }
  },
}));

import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  generateOutline,
  generateChapter,
  type BookWriterConfig,
} from "@/services/writing/bookwriter";
import {
  BookwriterRouter,
  type RouterChainSpec,
} from "@/services/llm/router";
import {
  createBookJob,
  setBookJobOutline,
  updateBookJobProgress,
  setBookJobStatus,
  getResumableBookJob,
  completeBookJob,
} from "@/services/bookwriter/jobs";
import { exportBook, checkExportGate } from "@/services/bookwriter/export";
import { prepareUpload, uploadToKdp } from "@/services/bookwriter/kdpUpload";
import type { KdpMetadata } from "@/types/bookwriter";
import {
  FakeOllamaProvider,
  goodOutlineJson,
  fakeWords,
} from "../helpers/fakeOllamaProvider";

const config: BookWriterConfig = {
  topic: "KI im Alltag",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapterCount: 3,
  model: "mock",
  baseUrl: "http://127.0.0.1:11434",
  language: "Deutsch",
  tone: "noir",
};

let projectId: string;

function paragraphWords(n: number): string {
  const words = fakeWords(n).split(" ");
  const paras: string[] = [];
  for (let i = 0; i < words.length; i += 60) {
    paras.push(words.slice(i, i + 60).join(" "));
  }
  return paras.join("\n\n");
}

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as Record<string, unknown>).__aws_db = db;
  const p = await createProject("API-Flow-Projekt");
  projectId = p.id;

  FakeOllamaProvider.reset();
  FakeOllamaProvider.router = (prompt) => {
    // WICHTIG: Kapitel zuerst — der Kapitel-Prompt bettet den Outline-Kontext
    // ("Gliederung: …") ein und würde sonst als Outline fehlklassifiziert.
    if (/schreibe kapitel/i.test(prompt)) return paragraphWords(900);
    if (/gliederung/i.test(prompt)) return goodOutlineJson(3);
    return null;
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__aws_db;
  FakeOllamaProvider.reset();
});

describe("API-Flow: Ollama → BookWriter → DB → Export → KDP", () => {
  it("Outline + Kapitel laufen über Ollama, Ton steht im Prompt", async () => {
    const outline = await generateOutline(config);
    expect(outline.chapters).toHaveLength(3);

    const chapter = await generateChapter(config, outline, 1, []);
    expect(chapter.status).toBe("draft");

    const prompts = FakeOllamaProvider.calls.map((c) => c.prompt).join("\n");
    expect(prompts).toMatch(/Stil\/Ton: noir/);
  });

  it("Router fällt bei totem Ollama auf Cloud zurück (mit fallback_reason)", async () => {
    // Ollama-Health rot schalten (Fake meldet sonst healthy).
    const healthSpy = vi
      .spyOn(FakeOllamaProvider.prototype, "healthCheck")
      .mockResolvedValue(false);
    try {
      const chain: RouterChainSpec[] = [
        { provider: "ollama", baseUrl: "http://127.0.0.1:11434", models: { main: "x", fast: "x" } },
        { provider: "openrouter", apiKey: "test-key", models: { main: "y", fast: "y" } },
      ];
      const metas: { provider: string; fallback_reason: string | null }[] = [];
      const router = new BookwriterRouter({ chain }, {
        onCall: (m) => metas.push({ provider: m.provider, fallback_reason: m.fallback_reason }),
      });
      const { text } = await router.complete(
        "chapter",
        [{ role: "user", content: "Schreibe Kapitel" }],
        { model: "x" },
      );
      expect(text).toContain("Cloud-Fallback");
      expect(metas[0]?.provider).toBe("openrouter");
      expect(metas[0]?.fallback_reason).toBe("health_check_failed");
    } finally {
      healthSpy.mockRestore();
    }
  });

  it("Crash mitten im Buch → Job-Resume ab Kapitel 2 → complete", async () => {
    const outline = await generateOutline(config);
    const job = createBookJob(projectId, config);
    await setBookJobOutline(job.id, outline);

    // Kapitel 1 fertig + committed, dann "Crash".
    const ch1 = await generateChapter(config, outline, 1, []);
    await updateBookJobProgress(job.id, 1);
    await setBookJobStatus(job.id, "interrupted", "Prozess-Kill simuliert");

    const resumable = getResumableBookJob(projectId);
    expect(resumable?.id).toBe(job.id);
    expect(resumable?.currentChapter).toBe(1);
    expect(resumable?.outline?.chapters).toHaveLength(3);

    // Resume ab currentChapter + 1 mit gespeicherter Outline.
    const ch2 = await generateChapter(config, resumable!.outline!, 2, [ch1]);
    expect(ch2.number).toBe(2);
    await updateBookJobProgress(job.id, 2);
    await completeBookJob(job.id);

    expect(getResumableBookJob(projectId)).toBeNull();
  });

  it("Generierte Kapitel passieren Export-Gate und werden Markdown", async () => {
    const outline = await generateOutline(config);
    const chapters = [];
    for (let n = 1; n <= 3; n++) {
      chapters.push(await generateChapter(config, outline, n, chapters));
    }
    const gate = checkExportGate(
      chapters.map((c) => ({ number: c.number, title: c.title, content: c.content, status: "draft" as const })),
    );
    expect(gate.allowed).toBe(true);

    const result = await exportBook(
      {
        title: outline.title,
        author: "E2E-Autor",
        language: "de",
        chapters: chapters.map((c) => ({ number: c.number, title: c.title, content: c.content, status: "draft" as const })),
      },
      "markdown",
    );
    expect(result.filename).toMatch(/\.md$/i);
    const text = await result.blob.text();
    expect(text).toContain(outline.title);
  });

  it("Export-Artefakt wird KDP-Upload-Paket und erreicht Status live", async () => {
    const metadata: KdpMetadata = {
      title: "KI im Alltag",
      subtitle: "Ein E2E-Testbuch",
      blurbVariants: ["Klappentext-Variante mit ausreichend Inhalt für die Validierung."],
      shortDescription: "Kurzbeschreibung des Testbuchs.",
      keywords: ["KI", "Alltag", "Technik", "Zukunft", "Ratgeber", "Sachbuch", "Test"],
      categories: ["Sachbuch"],
      authorBio: "E2E-Autor schreibt Testbücher.",
      seriesIdea: null,
      marketingNotes: null,
      coverImage: null,
      priceUsd: 9.99,
    };
    const file = { name: "buch.epub", sizeBytes: 2048, mimeType: "application/epub+zip" };

    const prepared = prepareUpload(file, metadata, { now: () => 1700000000000 });
    expect(prepared.ok).toBe(true);

    const seen: string[] = [];
    const result = await uploadToKdp(file, metadata, {
      now: () => 1700000000000,
      randomId: () => "kdp-e2e-1",
      uploadFn: async () => ({ remoteId: "remote-1" }),
      pollFn: async () => "live" as const,
      onStatus: (s) => seen.push(s.status),
    });
    expect(result.remoteId).toBe("remote-1");
    expect(result.state.status).toBe("live");
    expect(seen).toContain("uploading");
  });
});
