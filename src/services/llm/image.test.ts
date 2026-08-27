// Bildgenerierung: Tests für ImageProvider-Factory.
import { describe, it, expect } from "vitest";
import {
  createImageProvider,
  ALL_IMAGE_PROVIDERS,
  IMAGE_PROVIDER_LABELS,
  type ImageProviderConfig,
} from "@/services/llm/image";

describe("image generation", () => {
  it("erstellt Provider anhand der ID", () => {
    const config: ImageProviderConfig = {
      openaiApiKey: "sk-test",
    };
    const provider = createImageProvider("openai-dalle", config);
    expect(provider.id).toBe("openai-dalle");
    expect(provider.label).toBe("OpenAI DALL-E 3");
  });

  it("hat alle Provider-IDs mit Labels", () => {
    expect(ALL_IMAGE_PROVIDERS.length).toBe(3);
    for (const id of ALL_IMAGE_PROVIDERS) {
      expect(IMAGE_PROVIDER_LABELS[id]).toBeTruthy();
    }
  });

  it("DALL-E Provider ist nicht erreichbar ohne Key", async () => {
    const provider = createImageProvider("openai-dalle", {});
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it("SD WebUI Provider ist nicht erreichbar ohne URL", async () => {
    const provider = createImageProvider("sd-webui", {});
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it("wirft Fehler bei fehlendem API-Key", async () => {
    const provider = createImageProvider("openai-dalle", {});
    await expect(
      provider.generate({ prompt: "test" }),
    ).rejects.toThrow("OpenAI API-Key fehlt");
  });

  it("wirft Fehler bei fehlender SD URL", async () => {
    const provider = createImageProvider("sd-webui", {});
    await expect(
      provider.generate({ prompt: "test" }),
    ).rejects.toThrow("SD WebUI URL fehlt");
  });
});
