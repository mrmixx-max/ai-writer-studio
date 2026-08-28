// TTS-Provider: Tests für Factory und Fehlerbehandlung.
import { describe, it, expect } from "vitest";
import {
  createTTSProvider,
  ALL_TTS_PROVIDERS,
  TTS_PROVIDER_LABELS,
} from "@/services/tts/tts";

describe("text-to-speech", () => {
  it("erstellt Provider anhand der ID", () => {
    const provider = createTTSProvider("openai-tts", { openaiApiKey: "sk-test" });
    expect(provider.id).toBe("openai-tts");
    expect(provider.label).toBe("OpenAI TTS");
  });

  it("hat alle Provider-IDs mit Labels", () => {
    expect(ALL_TTS_PROVIDERS.length).toBe(3);
    for (const id of ALL_TTS_PROVIDERS) {
      expect(TTS_PROVIDER_LABELS[id]).toBeTruthy();
    }
  });

  it("wirft Fehler bei fehlendem API-Key", async () => {
    const provider = createTTSProvider("openai-tts", {});
    await expect(provider.speak({ text: "test" })).rejects.toThrow("OpenAI API-Key fehlt");
  });

  it("Piper ist nicht erreichbar ohne URL", async () => {
    const provider = createTTSProvider("piper", {});
    expect(await provider.isAvailable()).toBe(false);
  });

  it("Edge TTS hat deutsche Stimmen", async () => {
    const provider = createTTSProvider("edge-tts", {});
    const voices = await provider.listVoices();
    expect(voices.some((v) => v.startsWith("de-"))).toBe(true);
  });
});
