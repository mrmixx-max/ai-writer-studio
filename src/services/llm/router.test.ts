// Tests: Bookwriter-Modell-Router (Sprint 2, B2 + B3).
//
// Akzeptanzkriterien:
// - Ollama offline → Calls laufen über OpenRouter-Fallback, Log enthält
//   fallback_reason
// - Abort löst KEINEN Fallback aus
// - 4xx löst KEINEN Fallback aus
// - Timeout-Quote > 50 % → Provider wird umgangen
// - summary nutzt Schnell-Modell, chapter Hauptmodell (Modell-Matrix)
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BookwriterRouter,
  MODEL_MATRIX,
  pickModelForTask,
  looksLikeFastModel,
  looksLikeStrongModel,
  defaultChain,
  estimateTokensRouter,
  type RouterChainSpec,
  type RouterCallMeta,
} from "./router";
import { ProviderError } from "@/types/llm";

// OllamaProvider/OpenRouterProvider mocken — healthCheck/chat pro Test konfigurierbar.
type MockSpec = {
  healthy: boolean;
  responses?: string[];
  errors?: unknown[];
};

const ollamaState: MockSpec = { healthy: true };
const openrouterState: MockSpec = { healthy: true };
const ollamaChatCalls: Array<{ messages: unknown[]; options: Record<string, unknown> }> = [];
const openrouterChatCalls: Array<{ messages: unknown[]; options: Record<string, unknown> }> = [];

vi.mock("./ollama", () => ({
  OllamaProvider: class {
    constructor(public baseUrl: string) {}
    async healthCheck() { return ollamaState.healthy; }
    async *chat(messages: unknown[], options: Record<string, unknown>) {
      ollamaChatCalls.push({ messages, options });
      const err = ollamaState.errors?.shift();
      if (err) throw err;
      yield ollamaState.responses?.shift() ?? "";
    }
  },
}));

vi.mock("./openrouter", () => ({
  OpenRouterProvider: class {
    constructor(public apiKey: string) {}
    async healthCheck() { return openrouterState.healthy; }
    async *chat(messages: unknown[], options: Record<string, unknown>) {
      openrouterChatCalls.push({ messages, options });
      const err = openrouterState.errors?.shift();
      if (err) throw err;
      yield openrouterState.responses?.shift() ?? "";
    }
  },
}));

const MSGS = [{ role: "user" as const, content: "Test-Prompt" }];

function makeRouter(ollama: Partial<MockSpec>, openrouter: Partial<MockSpec>, apiKey = "sk-test"): BookwriterRouter {
  Object.assign(ollamaState, { healthy: true, responses: [], errors: [] }, ollama);
  Object.assign(openrouterState, { healthy: true, responses: [], errors: [] }, openrouter);
  const chain: RouterChainSpec[] = [
    { provider: "ollama", baseUrl: "http://127.0.0.1:11434", models: { main: "llama3.1:8b", fast: "llama3.2" } },
    { provider: "openrouter", apiKey, models: { main: "meta-llama/llama-3.1-70b-instruct" } },
  ];
  return new BookwriterRouter({ chain });
}

beforeEach(() => {
  ollamaChatCalls.length = 0;
  openrouterChatCalls.length = 0;
});

describe("B3: Modell-Matrix", () => {
  it("Matrix: outline=strong, chapter=main, summary/entities=fast, repair=main", () => {
    expect(MODEL_MATRIX.outline).toBe("strong");
    expect(MODEL_MATRIX.chapter).toBe("main");
    expect(MODEL_MATRIX.summary).toBe("fast");
    expect(MODEL_MATRIX.entities).toBe("fast");
    expect(MODEL_MATRIX.repair).toBe("main");
  });

  it("summary wählt Schnell-Modell, chapter Hauptmodell", () => {
    const models = { main: "llama3.1:8b", fast: "llama3.2" };
    expect(pickModelForTask("summary", models)).toBe("llama3.2");
    expect(pickModelForTask("entities", models)).toBe("llama3.2");
    expect(pickModelForTask("chapter", models)).toBe("llama3.1:8b");
    expect(pickModelForTask("repair", models)).toBe("llama3.1:8b");
  });

  it("outline nutzt starkes Modell, wenn konfiguriert; sonst konservativ Hauptmodell", () => {
    const models = { main: "llama3.1:8b", strong: "llama3.1:70b" };
    expect(pickModelForTask("outline", models)).toBe("llama3.1:70b");
    // Konservativ: ohne strong-Kandidat → Hauptmodell.
    expect(pickModelForTask("outline", { main: "llama3.1:8b" })).toBe("llama3.1:8b");
  });

  it("Auto-Heuristik: kleine Modelle erkennen, ohne Modell-IDs zu erfinden", () => {
    expect(looksLikeFastModel("llama3.2")).toBe(true);
    expect(looksLikeFastModel("qwen2.5:3b")).toBe(true);
    expect(looksLikeStrongModel("llama3.1:70b")).toBe(true);
    expect(looksLikeFastModel("llama3.1:8b")).toBe(false);
    // Konservativ: unbekanntes Modell → Hauptmodell.
    expect(pickModelForTask("summary", { main: "unbekannt-modell" }, ["unbekannt-modell"])).toBe("unbekannt-modell");
  });
});

describe("B2: Fallback-Routing", () => {
  it("Ollama offline (healthCheck rot) → Call läuft über OpenRouter, fallback_reason gesetzt", async () => {
    const router = makeRouter({ healthy: false }, { healthy: true, responses: ["Cloud-Antwort"] });
    const { text, meta } = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });

    expect(text).toBe("Cloud-Antwort");
    expect(meta.provider).toBe("openrouter");
    expect(meta.fallback_reason).toBe("health_check_failed");
    expect(ollamaChatCalls.length).toBe(0);
    expect(openrouterChatCalls.length).toBe(1);
  });

  it("2 Retry-Endfehler bei Ollama → Fallback auf OpenRouter (retry_exhausted)", async () => {
    const netErr = new ProviderError("Ollama chat fehlgeschlagen. ECONNREFUSED");
    const router = makeRouter(
      { healthy: true, errors: [netErr, netErr] },
      { healthy: true, responses: ["Cloud-Antwort"] },
    );
    const { meta } = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });

    expect(meta.provider).toBe("openrouter");
    expect(meta.fallback_reason).toBe("retry_exhausted");
    expect(ollamaChatCalls.length).toBe(2); // 2 Runden versucht
  });

  it("Abort löst KEINEN Fallback aus", async () => {
    const ctrl = new AbortController();
    const router = makeRouter(
      { healthy: true, errors: [new DOMException("Aborted", "AbortError")] },
      { healthy: true, responses: ["Cloud-Antwort"] },
    );
    await expect(router.complete("chapter", MSGS, { model: "m" }, ctrl.signal)).rejects.toMatchObject({ name: "AbortError" });
    // Kein Cloud-Call — Abort bricht die gesamte Kette ab.
    expect(openrouterChatCalls.length).toBe(0);
  });

  it("4xx löst KEINEN Fallback aus", async () => {
    const router = makeRouter(
      { healthy: true, errors: [new ProviderError("Ollama chat fehlgeschlagen (HTTP 401). Unauthorized")] },
      { healthy: true, responses: ["Cloud-Antwort"] },
    );
    await expect(router.complete("chapter", MSGS, { model: "m" })).rejects.toBeInstanceOf(ProviderError);
    expect(openrouterChatCalls.length).toBe(0);
  });

  it("gesamte Kette offline → ProviderError", async () => {
    const router = makeRouter({ healthy: false }, { healthy: false });
    await expect(router.complete("chapter", MSGS, { model: "m" })).rejects.toBeInstanceOf(ProviderError);
  });

  it("OpenRouter ohne API-Key wird übersprungen (Kette nur Ollama)", async () => {
    const chain = defaultChain({ ollamaBaseUrl: "http://127.0.0.1:11434" });
    expect(chain.length).toBe(1);
    const router = new BookwriterRouter({ chain: [
      { provider: "ollama", baseUrl: "http://127.0.0.1:11434", models: { main: "m" } },
      { provider: "openrouter" }, // kein Key → übersprungen
    ] });
    expect(router.entries.length).toBe(1);
  });

  it("Telemetrie pro Call: provider, model, latency_ms, tokens_est, fallback_reason", async () => {
    void makeRouter({ healthy: true, responses: ["Hallo Welt, das ist ein Test."] }, {});
    const onCall = vi.fn((m: RouterCallMeta) => m);
    const r2 = new BookwriterRouter({
      chain: [
        { provider: "ollama", baseUrl: "http://x", models: { main: "main-m", fast: "fast-m" } },
        { provider: "openrouter", apiKey: "sk" },
      ],
    }, { onCall });
    const { meta } = await r2.complete("summary", MSGS, {});

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(meta.provider).toBe("ollama");
    expect(meta.model).toBe("fast-m"); // fast model aus Spec (summary → Schnell-Modell)
    expect(meta.fallback_reason).toBeNull();
    expect(meta.tokens_est).toBeGreaterThan(0);
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
    expect(estimateTokensRouter("12345678")).toBe(2);
  });
});

describe("B2: Timeout-Quote", () => {
  it("Timeout-Quote > 50 % → Provider wird umgangen", async () => {
    const timeoutErr = new DOMException("Timeout", "TimeoutError");
    const router = makeRouter(
      { healthy: true, errors: [timeoutErr, timeoutErr] },
      { healthy: true, responses: ["Cloud-Antwort"] },
    );
    // 2 Calls, 2 Timeouts → Quote 100 % > 50 %.
    await router.complete("chapter", MSGS, { model: "m" }); // Fallback per retry_exhausted
    ollamaState.errors = [];
    openrouterState.responses = ["Cloud 2"];
    const { meta } = await router.complete("chapter", MSGS, { model: "m" });

    expect(meta.provider).toBe("openrouter");
    expect(meta.fallback_reason).toBe("timeout_quota_exceeded");
  });
});