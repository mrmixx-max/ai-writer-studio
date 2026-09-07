// Bildgenerierung-UI (Sprint 14, Agent 4): standalone Panel für Kapitelbilder.
//
// Struktur angelehnt an `src/components/ImageGen/ImageGenPanel.tsx`
// (Sections mit Label + Feld, Generate-Button mit Loading-State,
// Fehler-Box, Ergebnis-Vorschau) — aber bewusst entkoppelt:
// kein Settings-Store, kein Provider-Import. Die eigentliche
// Bilderzeugung kommt über die injizierbare `generateImage`-Prop,
// das Einfügen ins Kapitel über `onInsertIntoChapter`.
// So ist das Panel ohne Backend test- und wiederverwendbar.
//
// Wiederverwendet die Styles aus `../ImageGen/image-gen.css`
// (Klassen `image-gen-*`), damit das Panel optisch konsistent bleibt.

import { useState, useCallback } from "react";
import "../ImageGen/image-gen.css";

export type ImageGenModel = "ollama-vision" | "sd-webui";

export interface GeneratedChapterImage {
  dataUrl: string;
  prompt: string;
  model: ImageGenModel;
}

export interface ImageGenPanelProps {
  /** Erzeugt ein Bild aus Prompt + Modell. Falls nicht injiziert, wird
   *  ein eingebauter Fallback verwendet (SD WebUI via App-Settings;
   *  Ollama Vision meldet, dass es Konfiguration braucht). */
  generateImage?: (prompt: string, model: ImageGenModel) => Promise<GeneratedChapterImage>;
  /** Wird beim Klick auf "Ins Kapitel einfügen" mit dem Bild aufgerufen. */
  onInsertIntoChapter?: (image: GeneratedChapterImage) => void;
  initialModel?: ImageGenModel;
  initialPrompt?: string;
}

export const IMAGE_GEN_MODELS: ImageGenModel[] = ["ollama-vision", "sd-webui"];

export const IMAGE_GEN_MODEL_LABELS: Record<ImageGenModel, string> = {
  "ollama-vision": "Ollama Vision (lokal)",
  "sd-webui": "SD WebUI (lokal, GPU)",
};

/** Eingebauter Fallback, wenn kein `generateImage` injiziert wurde.
 *  Lazy-Imports, damit das Panel ohne Settings-/Provider-Module
 *  (z. B. in Tests) leichtgewichtig bleibt. */
async function defaultGenerateImage(
  prompt: string,
  model: ImageGenModel,
): Promise<GeneratedChapterImage> {
  if (model === "ollama-vision") {
    throw new Error(
      "Ollama Vision ist nicht konfiguriert — bitte SD WebUI wählen oder eine generateImage-Funktion injizieren.",
    );
  }
  const { loadSettings } = await import("@/services/settings");
  const { createImageProvider } = await import("@/services/llm/image");
  const settings = loadSettings();
  const provider = createImageProvider("sd-webui", {
    sdWebuiUrl: settings.sdWebuiUrl,
    sdWebuiUsername: settings.sdWebuiUsername,
    sdWebuiPassword: settings.sdWebuiPassword,
  });
  const result = await provider.generate({ prompt, count: 1 });
  const first = result[0];
  if (!first) throw new Error("SD WebUI hat kein Bild geliefert.");
  return { dataUrl: first.dataUrl, prompt: first.prompt, model };
}

export function ImageGenPanel({
  generateImage = defaultGenerateImage,
  onInsertIntoChapter,
  initialModel = "ollama-vision",
  initialPrompt = "",
}: ImageGenPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [model, setModel] = useState<ImageGenModel>(initialModel);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<GeneratedChapterImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(false);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Bitte einen Prompt eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    setImage(null);
    setInserted(false);
    try {
      const result = await generateImage(prompt.trim(), model);
      setImage(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [prompt, model, generateImage]);

  const insert = useCallback(() => {
    if (!image) return;
    onInsertIntoChapter?.(image);
    setInserted(true);
  }, [image, onInsertIntoChapter]);

  return (
    <div className="image-gen" data-testid="image-gen-panel">
      <h2 className="image-gen-title">Bild für Kapitel generieren</h2>

      <div className="image-gen-section">
        <label className="image-gen-label" htmlFor="image-gen-prompt">
          Prompt
        </label>
        <textarea
          id="image-gen-prompt"
          data-testid="image-gen-prompt"
          className="image-gen-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="z. B. nebliger Waldpfad im Morgengrauen, düstere Stimmung …"
          rows={3}
          disabled={busy}
        />
      </div>

      <div className="image-gen-section">
        <label className="image-gen-label" htmlFor="image-gen-model">
          Modell
        </label>
        <select
          id="image-gen-model"
          data-testid="image-gen-model"
          className="image-gen-select"
          value={model}
          onChange={(e) => setModel(e.target.value as ImageGenModel)}
          disabled={busy}
        >
          {IMAGE_GEN_MODELS.map((m) => (
            <option key={m} value={m}>
              {IMAGE_GEN_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        data-testid="image-gen-generate"
        className="image-gen-button"
        onClick={generate}
        disabled={busy}
      >
        {busy ? "Generiert …" : "Bild generieren"}
      </button>

      {error && (
        <div className="image-gen-error" data-testid="image-gen-error" role="alert">
          {error}
        </div>
      )}

      {image && (
        <div className="image-gen-results" data-testid="image-gen-preview">
          <div className="image-gen-result">
            <img src={image.dataUrl} alt={image.prompt} className="image-gen-img" />
            <div className="image-gen-meta">{image.prompt}</div>
            <button
              type="button"
              data-testid="image-gen-insert"
              className="image-gen-button"
              onClick={insert}
              disabled={busy}
            >
              {inserted ? "Ins Kapitel eingefügt ✓" : "Ins Kapitel einfügen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
