// Text-to-Speech: Provider-Interface und Factory.
//
// Provider: openai-tts, edge-tts, piper (lokal)

export type TTSProviderId = "openai-tts" | "edge-tts" | "piper";

export interface TTSOptions {
  text: string;
  voice?: string;
  speed?: number; // 0.5–2.0
}

export interface TTSProvider {
  readonly id: TTSProviderId;
  readonly label: string;
  isAvailable(): Promise<boolean>;
  speak(options: TTSOptions): Promise<ArrayBuffer>;
  listVoices(): Promise<string[]>;
}

export interface TTSConfig {
  openaiApiKey?: string;
  piperUrl?: string;
}

export function createTTSProvider(id: TTSProviderId, config: TTSConfig): TTSProvider {
  switch (id) {
    case "openai-tts":
      return new OpenAITTSProvider(config);
    case "edge-tts":
      return new EdgeTTSProvider();
    case "piper":
      return new PiperTTSProvider(config);
  }
}

export const ALL_TTS_PROVIDERS: TTSProviderId[] = ["openai-tts", "edge-tts", "piper"];

export const TTS_PROVIDER_LABELS: Record<TTSProviderId, string> = {
  "openai-tts": "OpenAI TTS",
  "edge-tts": "Edge TTS (gratis)",
  piper: "Piper (lokal)",
};

// --- OpenAI TTS ---

class OpenAITTSProvider implements TTSProvider {
  readonly id = "openai-tts" as const;
  readonly label = "OpenAI TTS";

  constructor(private config: TTSConfig) {}

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

  async speak(options: TTSOptions): Promise<ArrayBuffer> {
    if (!this.config.openaiApiKey) throw new Error("OpenAI API-Key fehlt");

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: options.text.slice(0, 4096),
        voice: options.voice ?? "alloy",
        speed: options.speed ?? 1.0,
        response_format: "mp3",
      }),
    });

    if (!res.ok) throw new Error(`OpenAI TTS Fehler: ${res.status}`);
    return res.arrayBuffer();
  }

  async listVoices(): Promise<string[]> {
    return ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
  }
}

// --- Edge TTS (gratis, Microsoft) ---

class EdgeTTSProvider implements TTSProvider {
  readonly id = "edge-tts" as const;
  readonly label = "Edge TTS (gratis)";

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/listtrustedids", {
        method: "HEAD",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async speak(_options: TTSOptions): Promise<ArrayBuffer> {
    // Edge TTS verwendet WebSocket — vereinfachte Implementierung
    // In Produktion: @marco-tts/edge-tts oder direkte WebSocket-Verbindung
    throw new Error("Edge TTS benötigt WebSocket-Integration");
  }

  async listVoices(): Promise<string[]> {
    return [
      "de-DE-KatjaNeural",
      "de-DE-ConradNeural",
      "de-AT-JonasNeural",
      "de-CH-JanNeural",
    ];
  }
}

// --- Piper (lokal) ---

class PiperTTSProvider implements TTSProvider {
  readonly id = "piper" as const;
  readonly label = "Piper (lokal)";

  constructor(private config: TTSConfig) {}

  async isAvailable(): Promise<boolean> {
    if (!this.config.piperUrl) return false;
    try {
      const res = await fetch(`${this.config.piperUrl}/health`, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async speak(options: TTSOptions): Promise<ArrayBuffer> {
    if (!this.config.piperUrl) throw new Error("Piper URL fehlt");

    const res = await fetch(`${this.config.piperUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: options.text.slice(0, 2000),
        voice: options.voice ?? "de_DE-thorsten-medium",
        speed: options.speed ?? 1.0,
      }),
    });

    if (!res.ok) throw new Error(`Piper Fehler: ${res.status}`);
    return res.arrayBuffer();
  }

  async listVoices(): Promise<string[]> {
    if (!this.config.piperUrl) return [];
    try {
      const res = await fetch(`${this.config.piperUrl}/voices`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.voices ?? [];
    } catch {
      return ["de_DE-thorsten-medium"];
    }
  }
}
