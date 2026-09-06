// TTS-Provider Details: fetch-gemockte Tests für isAvailable/speak/listVoices.
// Kein echtes Netz — globaler fetch wird pro Test via vi.stubGlobal ersetzt.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createTTSProvider } from "@/services/tts/tts";

function mockFetchOnce(impl: (url: unknown, init?: unknown) => unknown) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openai-tts provider (gemockt)", () => {
  it("isAvailable: true bei ok-Antwort", async () => {
    mockFetchOnce(async () => ({ ok: true }));
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    expect(await p.isAvailable()).toBe(true);
  });

  it("isAvailable: false bei nicht-ok-Antwort", async () => {
    mockFetchOnce(async () => ({ ok: false }));
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    expect(await p.isAvailable()).toBe(false);
  });

  it("isAvailable: false bei Netzwerkfehler", async () => {
    mockFetchOnce(async () => {
      throw new Error("offline");
    });
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    expect(await p.isAvailable()).toBe(false);
  });

  it("speak: sendet gekürzten Input und liefert Buffer", async () => {
    const buf = new ArrayBuffer(8);
    let seenBody = "";
    mockFetchOnce(async (_url: unknown, init: any) => {
      seenBody = init.body;
      return { ok: true, arrayBuffer: async () => buf };
    });
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    const out = await p.speak({ text: "x".repeat(5000), voice: "nova", speed: 1.2 });
    expect(out).toBe(buf);
    const parsed = JSON.parse(seenBody);
    expect(parsed.input.length).toBeLessThanOrEqual(4096);
    expect(parsed.voice).toBe("nova");
    expect(parsed.speed).toBe(1.2);
  });

  it("speak: wirft bei Fehlerstatus", async () => {
    mockFetchOnce(async () => ({ ok: false, status: 401 }));
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    await expect(p.speak({ text: "hi" })).rejects.toThrow("401");
  });

  it("listVoices: kennt die sechs OpenAI-Stimmen", async () => {
    const p = createTTSProvider("openai-tts", { openaiApiKey: "k" });
    expect(await p.listVoices()).toEqual(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
  });
});

describe("edge-tts provider (gemockt)", () => {
  it("isAvailable: spiegelt ok-Status", async () => {
    mockFetchOnce(async () => ({ ok: true }));
    expect(await createTTSProvider("edge-tts", {}).isAvailable()).toBe(true);
    mockFetchOnce(async () => ({ ok: false }));
    expect(await createTTSProvider("edge-tts", {}).isAvailable()).toBe(false);
  });

  it("speak: wirft WebSocket-Hinweis (kein stilles Versagen)", async () => {
    const p = createTTSProvider("edge-tts", {});
    await expect(p.speak({ text: "hi" })).rejects.toThrow("WebSocket");
  });
});

describe("piper provider (gemockt)", () => {
  it("speak ohne URL wirft", async () => {
    await expect(createTTSProvider("piper", {}).speak({ text: "hi" })).rejects.toThrow("Piper URL fehlt");
  });

  it("listVoices ohne URL ist leer", async () => {
    expect(await createTTSProvider("piper", {}).listVoices()).toEqual([]);
  });

  it("listVoices: gibt Server-Stimmen zurück", async () => {
    mockFetchOnce(async () => ({
      ok: true,
      json: async () => ({ voices: ["de_DE-thorsten-medium", "de_DE-eva-medium"] }),
    }));
    const voices = await createTTSProvider("piper", { piperUrl: "http://localhost:5000" }).listVoices();
    expect(voices).toContain("de_DE-thorsten-medium");
  });

  it("listVoices: Fallback-Stimme bei Netzwerkfehler", async () => {
    mockFetchOnce(async () => {
      throw new Error("offline");
    });
    const voices = await createTTSProvider("piper", { piperUrl: "http://localhost:5000" }).listVoices();
    expect(voices).toEqual(["de_DE-thorsten-medium"]);
  });
});
