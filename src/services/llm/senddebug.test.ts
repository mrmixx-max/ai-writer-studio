// Sprint 19c (Send-Debug): Regressionstests für
// 1) healthCheck-Timeout (3s statt minutenlangem Hängen → Senden-Button tot)
// 2) localhost → 127.0.0.1 Normalisierung (IPv6-::1-Falle).
import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeLocalBaseUrl } from "./baseUrl";
import { OllamaProvider } from "./ollama";
import { LMStudioProvider } from "./lmstudio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("normalizeLocalBaseUrl", () => {
  it("ersetzt localhost durch 127.0.0.1 (Port + Pfad bleiben)", () => {
    expect(normalizeLocalBaseUrl("http://localhost:11434")).toBe("http://127.0.0.1:11434");
    expect(normalizeLocalBaseUrl("http://localhost:1234/v1")).toBe("http://127.0.0.1:1234/v1");
  });

  it("lässt 127.0.0.1, Remote- und Cloud-Hosts unverändert", () => {
    expect(normalizeLocalBaseUrl("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
    expect(normalizeLocalBaseUrl("http://192.168.1.10:11434")).toBe("http://192.168.1.10:11434");
    expect(normalizeLocalBaseUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1");
  });

  it("gibt ungültige URLs unverändert zurück (kein Throw)", () => {
    expect(normalizeLocalBaseUrl("keine-url")).toBe("keine-url");
    expect(normalizeLocalBaseUrl("")).toBe("");
  });
});

describe("healthCheck mit 3s-Timeout (Sprint 19c)", () => {
  function neverResolvingFetch() {
    return vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
  }

  it("Ollama healthCheck: nie antwortender Server → false nach 3s (nicht minutenlang)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", neverResolvingFetch());
    const provider = new OllamaProvider("http://127.0.0.1:11434");
    const pending = provider.healthCheck();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe(false);
  });

  it("OllamaProvider ruft 127.0.0.1 auf, auch wenn localhost konfiguriert ist", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    const provider = new OllamaProvider("http://localhost:11434");
    await provider.healthCheck();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.anything(),
    );
    expect(provider.describe()).toContain("127.0.0.1");
  });

  it("LMStudio healthCheck: nie antwortender Server → false nach 3s + localhost normalisiert", async () => {
    vi.useFakeTimers();
    const mockFetch = neverResolvingFetch();
    vi.stubGlobal("fetch", mockFetch);
    const provider = new LMStudioProvider("http://localhost:1234/v1");
    const pending = provider.healthCheck();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1/models",
      expect.anything(),
    );
  });
});
