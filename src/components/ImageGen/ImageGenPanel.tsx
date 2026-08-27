// Bildgenerierung: Panel für Cover, Illustrationen, Marketing-Bilder.
//
// Unterstützt drei Provider:
// - OpenAI DALL-E 3 (Cloud, ~$0.04/Bild)
// - OpenRouter Flux (Cloud, günstiger)
// - Lokales Stable Diffusion WebUI (gratis, braucht GPU)

import { useState, useCallback } from "react";
import { loadSettings, saveSettings } from "@/services/settings";
import {
  createImageProvider,
  ALL_IMAGE_PROVIDERS,
  IMAGE_PROVIDER_LABELS,
  type ImageProviderId,
  type GeneratedImage,
} from "@/services/llm/image";

export function ImageGenerationPanel() {
  const [settings, setSettings] = useState(loadSettings);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateSetting = useCallback(
    (key: string, value: unknown) => {
      const next = { ...settings, [key]: value } as typeof settings;
      setSettings(next);
      saveSettings(next);
    },
    [settings],
  );

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Bitte einen Prompt eingeben.");
      return;
    }
    if (settings.imageProvider === "none") {
      setError("Bitte einen Bild-Provider in den Einstellungen wählen.");
      return;
    }

    setBusy(true);
    setError(null);
    setImages([]);

    try {
      const provider = createImageProvider(settings.imageProvider as ImageProviderId, {
        openaiApiKey: settings.openaiApiKey,
        openrouterApiKey: settings.openrouterApiKey,
        sdWebuiUrl: settings.sdWebuiUrl,
        sdWebuiUsername: settings.sdWebuiUsername,
        sdWebuiPassword: settings.sdWebuiPassword,
      });

      const result = await provider.generate({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        width,
        height,
        count: 1,
      });

      setImages(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [prompt, negativePrompt, width, height, settings]);

  const providerConfigured = settings.imageProvider !== "none";

  return (
    <div className="image-gen">
      <h2 className="image-gen-title">Bildgenerierung</h2>

      <div className="image-gen-section">
        <label className="image-gen-label">Provider</label>
        <select
          className="image-gen-select"
          value={settings.imageProvider}
          onChange={(e) => updateSetting("imageProvider", e.target.value)}
        >
          <option value="none">— Deaktiviert —</option>
          {ALL_IMAGE_PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {IMAGE_PROVIDER_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      {settings.imageProvider === "sd-webui" && (
        <div className="image-gen-section">
          <label className="image-gen-label">SD WebUI URL</label>
          <input
            className="image-gen-input"
            type="text"
            value={settings.sdWebuiUrl}
            onChange={(e) => updateSetting("sdWebuiUrl", e.target.value)}
            placeholder="http://localhost:7860"
          />
          <div className="image-gen-row">
            <input
              className="image-gen-input"
              type="text"
              value={settings.sdWebuiUsername}
              onChange={(e) => updateSetting("sdWebuiUsername", e.target.value)}
              placeholder="Benutzername (optional)"
            />
            <input
              className="image-gen-input"
              type="password"
              value={settings.sdWebuiPassword}
              onChange={(e) => updateSetting("sdWebuiPassword", e.target.value)}
              placeholder="Passwort (optional)"
            />
          </div>
        </div>
      )}

      <div className="image-gen-section">
        <label className="image-gen-label">Prompt</label>
        <textarea
          className="image-gen-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ein epischer Sonnenuntergang über einer mittelalterlichen Burg..."
          rows={3}
        />
      </div>

      <div className="image-gen-section">
        <label className="image-gen-label">Negativer Prompt (optional)</label>
        <input
          className="image-gen-input"
          type="text"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="text, watermark, low quality, blurry"
        />
      </div>

      <div className="image-gen-section">
        <label className="image-gen-label">Größe</label>
        <div className="image-gen-row">
          <select
            className="image-gen-select"
            value={`${width}x${height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              setWidth(w);
              setHeight(h);
            }}
          >
            <option value="1024x1024">1024 × 1024 (Quadrat)</option>
            <option value="1792x1024">1792 × 1024 (Querformat)</option>
            <option value="1024x1792">1024 × 1792 (Hochformat)</option>
            <option value="512x512">512 × 512 (schnell)</option>
          </select>
        </div>
      </div>

      <button
        className="image-gen-button"
        onClick={generate}
        disabled={busy || !providerConfigured}
      >
        {busy ? "Generiert..." : "Bild generieren"}
      </button>

      {error && <div className="image-gen-error">{error}</div>}

      {images.length > 0 && (
        <div className="image-gen-results">
          {images.map((img, i) => (
            <div key={i} className="image-gen-result">
              <img src={img.dataUrl} alt={img.prompt} className="image-gen-img" />
              <div className="image-gen-meta">{img.prompt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
