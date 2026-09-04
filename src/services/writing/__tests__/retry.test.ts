// Tests: A2/A3 — Retry-Strategie, Fehlerklassifikation, Abort-Semantik.
//
// Fake-Provider-Muster: vi.mock("@/services/llm/ollama") ersetzt den
// OllamaProvider, damit generateOutline/generateChapter ohne Netzwerk laufen.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fake-Provider: konfigurierbare Versuchs-Sequenz + Prompt-Erfassung.
let fakeResponses: Array<() => string> = [];
let fakeErrors: Array<Error | null> = [];
let chatCalls = 0;
let chatPrompts: string[] = []; // Message-Inhalte aller chat()-Aufrufe
// Fehler, den der Fake nach Erschöpfung der Skripte wirft (Default: Erfolg).
let terminalError: Error | null = null;

vi.mock("@/services/llm/ollama", () => {
  return {
    OllamaProvider: class {
      constructor(_baseUrl: string) {}
      async *chat(messages: { role: string; content: string }[]) {
        chatCalls++;
        chatPrompts.push(messages.map((m) => m.content).join("\n"));
        const idx = chatCalls - 1;
        if (idx < fakeErrors.length && fakeErrors[idx]) throw fakeErrors[idx];
        if (idx < fakeResponses.length) {
          yield fakeResponses[idx]();
          return;
        }
        if (terminalError) throw terminalError;
        yield "{}";
      }
      async healthCheck() { return true; }
      async listModels() { return []; }
      describe() { return "Fake"; }
    },
  };
});

import { withRetry, isAbortError, classifyError, createTimeoutController } from "../retry";
import {
  generateOutline,
  type BookWriterConfig,
} from "../bookwriter";
import { generateChapterChunked, type BookContext } from "../chapterEngine";
import type { Chapter } from "@/types/project";

const config: BookWriterConfig = {
  topic: "Test",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapterCount: 1,
  model: "fake",
  baseUrl: "http://127.0.0.1:11434",
  language: "Deutsch",
};

const validOutlineJson = JSON.stringify({
  title: "Testbuch",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapters: [
    {
      number: 1,
      title: "Kapitel Eins",
      // >= 20 Wörter für das B4-Qualitätsgate
      summary:
        "Dieses Kapitel behandelt die Grundlagen des Themas ausführlich und verständlich für Einsteiger mit vielen praktischen Beispielen und konkreten Umsetzungsschritten für den Alltag.",
    },
  ],
});

beforeEach(() => {
  chatCalls = 0;
  fakeResponses = [];
  fakeErrors = [];
  chatPrompts = [];
  terminalError = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("A2: withRetry", () => {
  it("Fake-Provider scheitert 2×, 3. Versuch erfolgreich", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("ECONNREFUSED: connection refused");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("kein Retry bei AbortError", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw new DOMException("Aborted", "AbortError");
      }),
    ).rejects.toThrow("Aborted");
    expect(attempts).toBe(1);
  });

  it("kein Retry bei 4xx vom Provider", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw new Error("Ollama chat fehlgeschlagen (HTTP 404).");
      }),
    ).rejects.toThrow("HTTP 404");
    expect(attempts).toBe(1);
  });

  it("3 Fehlversuche → Fehler fliegt nach dem 3. Versuch", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw new Error("fetch failed");
      }),
    ).rejects.toThrow("fetch failed");
    expect(attempts).toBe(3);
  });
});

describe("A2: generateOutline mit Fake-Provider", () => {
  it("2× kaputtes JSON, 3. Versuch valides JSON → Erfolg", async () => {
    fakeResponses = [
      () => "Kein JSON hier.",
      () => "```json\n{kaputt\n```",
      () => validOutlineJson,
    ];
    const outline = await generateOutline(config);
    expect(outline.title).toBe("Testbuch");
    expect(outline.chapters).toHaveLength(1);
    expect(chatCalls).toBe(3);
  });

  it("wiederholter JSON-Fehler → 2. Versuch mit schärferem Prompt", async () => {
    fakeResponses = [
      () => "Blabla ohne JSON.",
      () => validOutlineJson,
    ];
    const outline = await generateOutline(config);
    expect(outline.title).toBe("Testbuch");
    expect(chatCalls).toBe(2);
    // 2. Versuch MUSS den schärferen JSON-Prompt tragen (A2).
    expect(chatPrompts[0]).not.toContain("Antworte NUR mit validem JSON");
    expect(chatPrompts[1]).toContain("Antworte NUR mit validem JSON, kein Text davor oder danach");
  });

  it("3× kaputtes JSON → sprechender Fehler", async () => {
    fakeResponses = [
      () => "Erster Versuch ohne JSON.",
      () => "Zweiter Versuch ohne JSON.",
      () => "Dritter Versuch ohne JSON.",
    ];
    await expect(generateOutline(config)).rejects.toThrow(/Kein gültiges JSON/);
    expect(chatCalls).toBe(3);
  });

  it("Abort während generateOutline → kein Retry, AbortError fliegt durch", async () => {
    fakeResponses = [() => validOutlineJson];
    fakeErrors = [new DOMException("Aborted", "AbortError")];
    const ctrl = new AbortController();
    await expect(generateOutline(config, ctrl.signal)).rejects.toThrow("Aborted");
    expect(chatCalls).toBe(1);
  });

  it("Kapitel 1 fehlt summary → sprechender Fehler", async () => {
    fakeResponses = [
      () =>
        JSON.stringify({
          title: "T",
          genre: "G",
          targetAudience: "Z",
          chapters: [{ number: 1, title: "A" }],
        }),
    ];
    await expect(generateOutline(config)).rejects.toThrow("Kapitel 1 fehlt summary");
  });
});

describe("A2: generateChapterChunked mit Fake-Provider", () => {
  const book: BookContext = {
    title: "Testbuch",
    genre: "Sachbuch",
    targetAudience: "Erwachsene",
    language: "Deutsch",
  };

  function makeChapter(): Chapter {
    return {
      id: "ch_1",
      projectId: "p1",
      title: "Test",
      content: "",
      orderIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "planned",
      targetWordCount: 50,
      minimumWordCount: 10,
      maximumWordCount: 500,
      currentWordCount: 0,
    };
  }

  it("2× Netzwerkfehler, 3. Versuch erfolgreich", async () => {
    fakeErrors = [
      new Error("ECONNREFUSED"),
      new Error("ECONNRESET"),
    ];
    fakeResponses = [() => "Ein kurzer Absatz mit ein paar Wörtern."];
    const result = await generateChapterChunked(makeChapter(), book, {
      model: "fake",
      baseUrl: "x",
      chunkTargetWords: 20,
    });
    expect(result.completed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("Abort während Chunk 3 → Status planned, kein Ghost-State", async () => {
    const ctrl = new AbortController();
    fakeResponses = [
      () => "Erster Chunk Text.",
      () => "Zweiter Chunk Text.",
      () => "Dritter Chunk Text.",
    ];
    // Nach dem 2. Chunk abbrechen → 3. generateChunk-Aufruf läuft in Abort.
    const origChat = chatCalls;
    void origChat;
    let chunkCount = 0;
    const result = await generateChapterChunked(
      makeChapter(),
      book,
      { model: "fake", baseUrl: "x", chunkTargetWords: 5 },
      () => {
        chunkCount++;
        if (chunkCount === 2) ctrl.abort();
      },
      ctrl.signal,
    );
    expect(result.completed).toBe(false);
    expect(result.error).toBe("Abgebrochen");
    expect(result.chapter.status).toBe("planned"); // kein "generating"
  });
});

describe("A2/A3: classifyError", () => {
  it("klassifiziert 4xx als http4xx", () => {
    expect(classifyError(new Error("fehlgeschlagen (HTTP 400)."))).toBe("http4xx");
  });
  it("klassifiziert ECONNREFUSED als network", () => {
    expect(classifyError(new Error("ECONNREFUSED"))).toBe("network");
  });
  it("klassifiziert AbortError als abort", () => {
    expect(classifyError(new DOMException("Aborted", "AbortError"))).toBe("abort");
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
  });
  it("klassifiziert TimeoutError als timeout", () => {
    expect(classifyError(new DOMException("Timeout", "TimeoutError"))).toBe("timeout");
  });
});

describe("A3: createTimeoutController", () => {
  it("externer Abort bricht das kombinierte Signal sofort ab", () => {
    const external = new AbortController();
    const { timeoutSignal, clear } = createTimeoutController(60_000, external.signal);
    expect(timeoutSignal.aborted).toBe(false);
    external.abort();
    expect(timeoutSignal.aborted).toBe(true);
    clear();
  });

  it("Timeout feuert nach Ablauf", () => {
    vi.useFakeTimers();
    const { timeoutSignal, clear } = createTimeoutController(50);
    vi.advanceTimersByTime(60);
    expect(timeoutSignal.aborted).toBe(true);
    clear();
    vi.useRealTimers();
  });
});
