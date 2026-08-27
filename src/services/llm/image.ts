// Bildgenerierung: Provider-Interface und Factory.
//
// Optionale Anbindung an:
// - OpenAI DALL-E 3 (Cloud)
// - OpenRouter Flux/Stable Diffusion (Cloud)
// - Lokales AUTOMATIC1111 Stable Diffusion WebUI
//
// Die Generierung blockiert keinen anderen Workflow. Bilder werden
// lokal gespeichert und als base64-String zurückgegeben.

export type ImageProviderId = "openai-dalle" | "openrouter-flux" | "sd-webui";

export interface ImagePrompt {
  prompt: string;
  /** Negativer Prompt (Elemente die NICHT im Bild sein sollen). */
  negativePrompt?: string;
  /** Breite in Pixeln (Standard: 1024). */
  width?: number;
  /** Höhe in Pixeln (Standard: 1024). */
  height?: number;
  /** Anzahl der zu generierenden Bilder. */
  count?: number;
}

export interface GeneratedImage {
  /** Base64-kodiertes PNG (data-URL-fähig). */
  dataUrl: string;
  /** Original-Prompt für Reproduzierbarkeit. */
  prompt: string;
  /** Timestamp. */
  createdAt: number;
}

export interface ImageProvider {
  readonly id: ImageProviderId;
  readonly label: string;
  /** true wenn der Provider konfiguriert und erreichbar ist. */
  isAvailable(): Promise<boolean>;
  /** Generiert Bilder. Wirft bei Fehlern. */
  generate(prompt: ImagePrompt): Promise<GeneratedImage[]>;
}

/** Erzeugt einen Provider anhand der ID und Config. */
export function createImageProvider(
  id: ImageProviderId,
  config: ImageProviderConfig,
): ImageProvider {
  switch (id) {
    case "openai-dalle":
      return new DalleImageProvider(config);
    case "openrouter-flux":
      return new OpenRouterImageProvider(config);
    case "sd-webui":
      return new SDWebUIProvider(config);
  }
}

export interface ImageProviderConfig {
  openaiApiKey?: string;
  openrouterApiKey?: string;
  sdWebuiUrl?: string;
  sdWebuiUsername?: string;
  sdWebuiPassword?: string;
}

// --- OpenAI DALL-E 3 ---

class DalleImageProvider implements ImageProvider {
  readonly id = "openai-dalle" as const;
  readonly label = "OpenAI DALL-E 3";

  constructor(private config: ImageProviderConfig) {}

  async isAvailable(): Promise<boolean> {
    if (!this.config.openaiApiKey) return false;
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${this.config.openaiApiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(prompt: ImagePrompt): Promise<GeneratedImage[]> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) throw new Error("OpenAI API-Key fehlt.");

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.prompt,
        n: prompt.count ?? 1,
        size: `${prompt.width ?? 1024}x${prompt.height ?? 1024}`,
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI DALL-E Fehler: ${res.status} ${err}`);
    }

    const data = await res.json();
    const now = Date.now();

    return (data.data as Array<{ b64_json: string }>).map((img, i) => ({
      dataUrl: `data:image/png;base64,${img.b64_json}`,
      prompt: prompt.prompt,
      createdAt: now + i,
    }));
  }
}

// --- OpenRouter Flux ---

class OpenRouterImageProvider implements ImageProvider {
  readonly id = "openrouter-flux" as const;
  readonly label = "OpenRouter Flux";

  constructor(private config: ImageProviderConfig) {}

  async isAvailable(): Promise<boolean> {
    if (!this.config.openrouterApiKey) return false;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${this.config.openrouterApiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(prompt: ImagePrompt): Promise<GeneratedImage[]> {
    const apiKey = this.config.openrouterApiKey;
    if (!apiKey) throw new Error("OpenRouter API-Key fehlt.");

    const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: prompt.prompt,
        n: prompt.count ?? 1,
        size: `${prompt.width ?? 1024}x${prompt.height ?? 1024}`,
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter Flux Fehler: ${res.status} ${err}`);
    }

    const data = await res.json();
    const now = Date.now();

    return (data.data as Array<{ b64_json: string }>).map((img, i) => ({
      dataUrl: `data:image/png;base64,${img.b64_json}`,
      prompt: prompt.prompt,
      createdAt: now + i,
    }));
  }
}

// --- Lokales Stable Diffusion WebUI ---

class SDWebUIProvider implements ImageProvider {
  readonly id = "sd-webui" as const;
  readonly label = "Stable Diffusion (lokal)";

  constructor(private config: ImageProviderConfig) {}

  async isAvailable(): Promise<boolean> {
    if (!this.config.sdWebuiUrl) return false;
    try {
      const res = await fetch(`${this.config.sdWebuiUrl}/sdapi/v1/options`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(prompt: ImagePrompt): Promise<GeneratedImage[]> {
    const url = this.config.sdWebuiUrl;
    if (!url) throw new Error("SD WebUI URL fehlt.");

    const body: Record<string, unknown> = {
      prompt: prompt.prompt,
      negative_prompt: prompt.prompt ?? "",
      width: prompt.width ?? 512,
      height: prompt.height ?? 512,
      batch_size: prompt.count ?? 1,
      steps: 20,
      cfg_scale: 7,
      sampler_name: "DPM++ 2M Karras",
    };

    // Auth falls konfiguriert
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.sdWebuiUsername && this.config.sdWebuiPassword) {
      const token = btoa(`${this.config.sdWebuiUsername}:${this.config.sdWebuiPassword}`);
      headers["Authorization"] = `Basic ${token}`;
    }

    const res = await fetch(`${url}/sdapi/v1/txt2img`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SD WebUI Fehler: ${res.status} ${err}`);
    }

    const data = await res.json();
    const now = Date.now();

    return (data.images as string[]).map((b64, i) => ({
      dataUrl: `data:image/png;base64,${b64}`,
      prompt: prompt.prompt,
      createdAt: now + i,
    }));
  }
}

/** Liste aller verfügbaren Provider-IDs. */
export const ALL_IMAGE_PROVIDERS: ImageProviderId[] = [
  "openai-dalle",
  "openrouter-flux",
  "sd-webui",
];

export const IMAGE_PROVIDER_LABELS: Record<ImageProviderId, string> = {
  "openai-dalle": "OpenAI DALL-E 3",
  "openrouter-flux": "OpenRouter Flux",
  "sd-webui": "Stable Diffusion (lokal)",
};
