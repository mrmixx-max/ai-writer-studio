// Batch-TTS: Tests für Chunking (rein) und Batch-Ablauf (fetch gemockt).
// Kein echtes Audio/Netz — openai-tts-Provider wird über gemockten fetch bedient.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  chunkChapterText,
  batchSynthesizeBook,
  cancelBatchSynthesis,
  type BatchTTSProgress,
} from "@/services/tts/batch";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockSpeakOk() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: any) => {
      calls.push(JSON.parse(init.body).input as string);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    }),
  );
  return calls;
}

describe("chunkChapterText", () => {
  it("leerer Text ergibt keine Chunks", () => {
    expect(chunkChapterText("", 100)).toEqual([]);
    expect(chunkChapterText("   \n  ", 100)).toEqual([]);
  });

  it("kurzer Text bleibt ein Chunk", () => {
    expect(chunkChapterText("Hallo Welt.", 100)).toEqual(["Hallo Welt."]);
  });

  it("langer Text wird an Satzgrenzen geteilt, kein Chunk über Limit", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Satz Nummer ${i} mit etwas Inhalt.`).join(" ");
    const chunks = chunkChapterText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    // Kein Textverlust: verbunden enthalten alle Sätze
    expect(chunks.join(" ")).toContain("Satz Nummer 19");
  });

  it("überlanger Einzelsatz wird an Wortgrenzen hart geteilt", () => {
    const text = "Wort ".repeat(60).trim();
    const chunks = chunkChapterText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
  });

  it("normalisiert Whitespace", () => {
    expect(chunkChapterText("Hallo   \n  Welt.", 100)).toEqual(["Hallo Welt."]);
  });
});

describe("batchSynthesizeBook", () => {
  it("synthetisiert Kapitel mit Fortschritt und Ergebnis-Callback", async () => {
    const calls = mockSpeakOk();
    const progress: BatchTTSProgress[] = [];
    const results: string[] = [];
    const out = await batchSynthesizeBook(
      "openai-tts",
      { openaiApiKey: "k" },
      [
        { id: "c1", title: "Kapitel 1", content: "Erster Satz. Zweiter Satz." },
        { id: "c2", title: "Kapitel 2", content: "Noch ein Kapitel." },
      ],
      {},
      (p) => progress.push(p),
      (r) => results.push(r.chapterId),
    );
    expect(out.cancelled).toBe(false);
    expect(out.chunks.length).toBeGreaterThanOrEqual(2);
    expect(calls.length).toBe(out.chunks.length);
    expect(results).toContain("c1");
    expect(results).toContain("c2");
    expect(progress[progress.length - 1]?.phase).toBe("done");
    expect(progress[0]).toMatchObject({ chapterIndex: 0, totalChapters: 2, phase: "chunking" });
  });

  it("leere Kapitelliste endet sofort mit done", async () => {
    mockSpeakOk();
    const progress: BatchTTSProgress[] = [];
    const out = await batchSynthesizeBook("openai-tts", { openaiApiKey: "k" }, [], {}, (p) => progress.push(p), () => {});
    expect(out).toEqual({ cancelled: false, chunks: [] });
    expect(progress[progress.length - 1]?.phase).toBe("done");
  });

  it("Abbruch via cancelBatchSynthesis meldet cancelled", async () => {
    mockSpeakOk();
    const progress: BatchTTSProgress[] = [];
    const chapters = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      title: `Kapitel ${i}`,
      content: `Inhalt von Kapitel ${i}.`,
    }));
    const out = await batchSynthesizeBook(
      "openai-tts",
      { openaiApiKey: "k" },
      chapters,
      {},
      (p) => progress.push(p),
      () => cancelBatchSynthesis(),
    );
    expect(out.cancelled).toBe(true);
    expect(progress[progress.length - 1]?.phase).toBe("cancelled");
  });

  it("cancelBatchSynthesis ohne laufenden Batch wirft nicht", () => {
    expect(() => cancelBatchSynthesis()).not.toThrow();
  });
});
