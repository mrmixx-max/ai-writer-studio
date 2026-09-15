// Tests: Dokumenten-RAG in runKIAction (Bücher/Dokumente als Faktenbasis).
import { describe, expect, it, vi, beforeEach } from "vitest";

const chatCalls: { messages: { role: string; content: string }[] }[] = [];

vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    healthCheck: async () => true,
    chat: async function* (messages: { role: string; content: string }[]) {
      chatCalls.push({ messages });
      yield "Antwort";
    },
  }),
}));

vi.mock("@/services/llm/multi", () => ({
  createSlotProvider: () => {
    throw new Error("kein Slot in Tests");
  },
  findSlot: () => undefined,
}));

vi.mock("@/services/knowledge/retrieval", () => ({
  searchKnowledge: async () => ({
    hits: [
      {
        chunkId: "c1",
        sourceId: "s1",
        sourceTitle: "Parteiprogramm",
        sourceType: "reference",
        headingPath: "",
        text: "Wir fordern bezahlbaren Wohnraum für alle.",
        score: 0.9,
        via: "lexical",
      },
    ],
    strategyUsed: "lexical",
    degraded: false,
  }),
  formatContextBlock: (result: { hits: { text: string }[] }) =>
    result.hits.map((h) => h.text).join("\n"),
  formatSourceList: () => ["1. Parteiprogramm (90 %)"],
}));

vi.mock("@/services/settings", () => ({
  loadSettings: () => ({ model: "test", maxTokens: 512 }),
}));

import { runKIAction } from "./index";

beforeEach(() => {
  chatCalls.length = 0;
  vi.clearAllMocks();
});

describe("runKIAction mit Dokumenten-RAG", () => {
  it("hängt Wissens-Chunks an und meldet Quellen", async () => {
    const res = await runKIAction(
      { model: "test", maxTokens: 512 } as never,
      {
        action: "chat",
        selection: "",
        context: "",
        chatMessage: "Was fordern wir zum Wohnen?",
        projectId: "p1",
      },
      () => {},
    );
    expect(res.offline).toBe(false);
    expect(res.text).toBe("Antwort");
    const prompt = chatCalls[0].messages.at(-1)!.content;
    expect(prompt).toContain("bezahlbaren Wohnraum");
    expect(prompt).toContain("DOKUMENTE AUS DEINEN BÜCHERN/DATEIEN");
    expect(res.ragSources).toEqual(["1. Parteiprogramm (90 %)"]);
  });

  it("ohne projectId kein RAG, keine Quellen", async () => {
    const res = await runKIAction(
      { model: "test", maxTokens: 512 } as never,
      { action: "chat", selection: "", context: "", chatMessage: "Hallo" },
      () => {},
    );
    const prompt = chatCalls[0].messages.at(-1)!.content;
    expect(prompt).not.toContain("DOKUMENTE AUS DEINEN");
    expect(res.ragSources ?? []).toEqual([]);
  });

  it("rag.enabled=false schaltet RAG ab", async () => {
    await runKIAction(
      { model: "test", maxTokens: 512 } as never,
      {
        action: "chat",
        selection: "",
        context: "",
        chatMessage: "Hallo",
        projectId: "p1",
        rag: { enabled: false },
      },
      () => {},
    );
    const prompt = chatCalls[0].messages.at(-1)!.content;
    expect(prompt).not.toContain("DOKUMENTE AUS DEINEN");
  });
});
