// @vitest-environment jsdom
// Tests für den ModelRegistry-Service: Parallel-Erkennung, Cache/TTL,
// Offline-/Timeout-Verhalten, deutsche Meldungen.
import { describe, it, expect, vi, beforeEach } from "vitest";

const providers: Record<string, { listModels: ReturnType<typeof vi.fn> }> = {};

vi.mock("./index", () => ({
  createProvider: vi.fn((s: { provider: string }) => {
    const p = providers[s.provider];
    if (!p) throw new Error(`Kein Stub für ${s.provider}`);
    return p;
  }),
}));

vi.mock("@/services/security/privacy", () => ({
  isCloudProvider: vi.fn((p: string) => ["openai", "openrouter", "gpt2api", "nous"].includes(p)),
  isPrivacyMode: vi.fn(() => false),
}));

import { discoverModels, clearModelCache } from "./modelRegistry";
import { createProvider } from "./index";
import { DEFAULT_SETTINGS } from "@/types/config";

function stub(provider: string, models: string[] | "throw" | "slow") {
  providers[provider] = {
    listModels:
      models === "throw"
        ? vi.fn(async () => { throw new Error("connection refused"); })
        : models === "slow"
          ? vi.fn(() => new Promise<string[]>((resolve) => setTimeout(() => resolve(["x"]), 10_000)))
          : vi.fn(async () => models),
  };
}

const SETTINGS = { ...DEFAULT_SETTINGS, openaiApiKey: "sk-test" };

describe("modelRegistry", () => {
  beforeEach(() => {
    clearModelCache();
    vi.clearAllMocks();
  });

  it("erkennt alle Anbieter parallel und liefert erreichbare Modelle sortiert", async () => {
    stub("ollama", ["mistral", "llama3.2"]);
    stub("lmstudio", ["qwen2.5-7b"]);
    stub("openai", ["gpt-4o-mini"]);
    stub("openrouter", ["openai/gpt-4o-mini:free"]);
    stub("gpt2api", []);
    stub("nous", ["Hermes-4-405B"]);

    const res = await discoverModels(SETTINGS);
    expect(res).toHaveLength(6);
    const ollama = res.find((r) => r.provider === "ollama")!;
    expect(ollama.reachable).toBe(true);
    expect(ollama.models).toEqual(["llama3.2", "mistral"]);
    expect(ollama.label).toBe("Ollama");
    expect(ollama.latencyMs).toBeTypeOf("number");
    const gpt2api = res.find((r) => r.provider === "gpt2api")!;
    expect(gpt2api.reachable).toBe(true);
    expect(gpt2api.models).toEqual([]);
  });

  it("liefert unreachable mit deutscher Meldung statt zu werfen", async () => {
    stub("ollama", "throw");
    stub("lmstudio", ["m"]);
    stub("openai", ["m"]);
    stub("openrouter", ["m"]);
    stub("gpt2api", ["m"]);
    stub("nous", ["m"]);
    const res = await discoverModels(SETTINGS);
    const ollama = res.find((r) => r.provider === "ollama")!;
    expect(ollama.reachable).toBe(false);
    expect(ollama.models).toEqual([]);
    expect(ollama.message).toContain("Ollama ist nicht erreichbar");
  });

  it("cacht Ergebnisse innerhalb der TTL (kein zweiter Probe-Aufruf)", async () => {
    stub("ollama", ["a"]);
    stub("lmstudio", []);
    stub("openai", []);
    stub("openrouter", []);
    stub("gpt2api", []);
    stub("nous", []);
    await discoverModels(SETTINGS);
    await discoverModels(SETTINGS);
    const lm = providers["lmstudio"].listModels;
    expect(lm).toHaveBeenCalledTimes(1);
    // force umgeht den Cache
    await discoverModels(SETTINGS, { force: true });
    expect(lm).toHaveBeenCalledTimes(2);
  });

  it("Timeout wird als nicht erreichbar gemeldet (kein Hängen)", async () => {
    stub("ollama", "slow");
    stub("lmstudio", ["m"]);
    stub("openai", ["m"]);
    stub("openrouter", ["m"]);
    stub("gpt2api", ["m"]);
    stub("nous", ["m"]);
    const res = await discoverModels(SETTINGS);
    const ollama = res.find((r) => r.provider === "ollama")!;
    expect(ollama.reachable).toBe(false);
    expect(ollama.message).toContain("Timeout");
  }, 10_000);

  it("überspringt Cloud-Anbieter ohne API-Schlüssel mit deutscher Meldung", async () => {
    stub("ollama", ["m"]);
    stub("lmstudio", ["m"]);
    stub("openrouter", ["m"]);
    stub("gpt2api", ["m"]);
    stub("nous", ["m"]);
    const res = await discoverModels({ ...SETTINGS, openaiApiKey: "  " });
    const openai = res.find((r) => r.provider === "openai")!;
    expect(openai.reachable).toBe(false);
    expect(openai.message).toContain("Kein API-Schlüssel");
    expect(createProvider).not.toHaveBeenCalledWith(expect.objectContaining({ provider: "openai" }));
  });
});
