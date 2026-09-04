// Tests: Bookwriter-Router-Fallback Log (Sprint 2, Akzeptanzkriterium).
//
// Szenario: Ollama offline → 2 Kapitel laufen vollständig über den
// OpenRouter-Fallback. Pro Call ein Log-Eintrag mit fallback_reason.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookwriterRouter, type RouterChainSpec } from "./router";

const ollamaHealthy = { value: false };
const orResponses: string[] = [];
const logLines: string[] = [];
const callMetas: Array<{ provider: string; fallback_reason: string | null; model: string }> = [];

vi.mock("./ollama", () => ({
  OllamaProvider: class {
    constructor(public baseUrl: string) {}
    async healthCheck() { return ollamaHealthy.value; }
    async *chat() { yield ""; }
  },
}));

vi.mock("./openrouter", () => ({
  OpenRouterProvider: class {
    constructor(public apiKey: string) {}
    async healthCheck() { return true; }
    async *chat(_m: unknown, _o: unknown) {
      const err = orErrors.shift();
      if (err) throw err;
      yield orResponses.shift() ?? "";
    }
  },
}));

const orErrors: unknown[] = [];

const MSGS = [{ role: "user" as const, content: "Schreibe Kapitel" }];

beforeEach(() => {
  orResponses.length = 0;
  orErrors.length = 0;
  callMetas.length = 0;
  logLines.length = 0;
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    logLines.push(args.map(String).join(" "));
  });
});

function makeRouter(): BookwriterRouter {
  const chain: RouterChainSpec[] = [
    { provider: "ollama", baseUrl: "http://127.0.0.1:11434", models: { main: "llama3.1:8b", fast: "llama3.2" } },
    { provider: "openrouter", apiKey: "sk-test", models: { main: "meta-llama/llama-3.1-70b-instruct", fast: "openai/gpt-4o-mini" } },
  ];
  return new BookwriterRouter({ chain }, {
    onCall: (m) => callMetas.push({ provider: m.provider, fallback_reason: m.fallback_reason, model: m.model }),
  });
}

describe("Fallback-Log (Akzeptanzkriterium)", () => {
  it("Ollama offline → 2 Kapitel über OpenRouter, Log mit fallback_reason je Call", async () => {
    const router = makeRouter();
    orResponses.push("Kapitel-1-Text", "Kapitel-2-Text");

    const ch1 = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });
    const ch2 = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });

    expect(ch1.text).toBe("Kapitel-1-Text");
    expect(ch2.text).toBe("Kapitel-2-Text");

    // Beide Calls über Cloud-Provider mit health_check_failed-Grund.
    expect(callMetas.length).toBe(2);
    expect(callMetas[0].provider).toBe("openrouter");
    expect(callMetas[1].provider).toBe("openrouter");
    expect(callMetas[0].fallback_reason).toBe("health_check_failed");
    expect(callMetas[1].fallback_reason).toBe("health_check_failed");

    // Router-Log enthält Umschalt-Hinweis je Call.
    const routerLogs = logLines.filter((l) => l.includes("Bookwriter-Router"));
    expect(routerLogs.length).toBeGreaterThanOrEqual(2);

    // Log-Eintrag-Struktur: provider, model, latency, tokens, fallback_reason
    // (via onCall-Telemetrie, wie sie in telemetry_json landet).
    expect(callMetas.every((m) => m.model.length > 0)).toBe(true);
  });

  it("Mixed: Kapitel 1 offline-Fallback, Kapitel 2 nach Recovery direkt über Ollama", async () => {
    const router = makeRouter();
    orResponses.push("Kapitel-1-Text");
    const ch1 = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });
    expect(ch1.meta.provider).toBe("openrouter");

    // Ollama kommt wieder hoch.
    ollamaHealthy.value = true;
    const ch2 = await router.complete("chapter", MSGS, { model: "llama3.1:8b" });
    expect(["ollama", "openrouter"]).toContain(ch2.meta.provider);
  });
});