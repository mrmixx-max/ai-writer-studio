import { describe, it, expect, vi } from "vitest";
import { checkOllamaCors } from "./ollamaCors";

describe("Ollama CORS-Check", () => {
  it("akzeptiert 200 von localhost:11434 als CORS-OK", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const result = await checkOllamaCors("http://127.0.0.1:11434", "tauri://localhost");

    expect(result.ok).toBe(true);
    expect(result.origin).toBe("tauri://localhost");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.objectContaining({
        method: "GET",
        headers: { Origin: "tauri://localhost" },
      }),
    );

    vi.unstubAllGlobals();
  });

  it("erkennt 403 als CORS-Blockade mit sprechender Meldung", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", mockFetch);

    const result = await checkOllamaCors("http://127.0.0.1:11434", "tauri://localhost");

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("CORS");
    expect(result.errorMessage).toContain("OLLAMA_ORIGINS");

    vi.unstubAllGlobals();
  });

  it("erkenn Nicht-Erreichbarkeit als Fehler", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await checkOllamaCors("http://127.0.0.1:11434");

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("nicht erreichbar");

    vi.unstubAllGlobals();
  });
});
