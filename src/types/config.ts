// App-weite Einstellungen (persistiert in SQLite + .env-Defaults)
import type { ProviderId } from "./llm";

export interface AppSettings {
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  theme: "light" | "dark";
  language?: "de" | "en" | "fr" | "es";
  highContrast?: boolean;
  kiModelSlots?: import("@/services/llm/multi").KIModelSlot[]; // Multi-Modell-Slots
  ollamaBaseUrl: string;
  lmstudioBaseUrl: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  gpt2apiBaseUrl: string;
  gpt2apiApiKey: string;
  nousApiKey: string;
  nousBaseUrl: string;
  // Bildgenerierung
  imageProvider: "openai-dalle" | "openrouter-flux" | "sd-webui" | "none";
  sdWebuiUrl: string;
  sdWebuiUsername: string;
  sdWebuiPassword: string;
  coverGenerator: "active" | "none";
  blurbGenerator: "active" | "none";
  scientificWriting: "active" | "none";
  // --- Sicherheit & Privatsphaere ---
  /** Privatsphaere-Modus: blockiert Telemetrie und Cloud-Aufrufe. */
  privacyMode: boolean;
  /** Verschlsselt sensible Kapitelinhalte AES-256-GCM vor dem DB-Schreiben. */
  manuscriptEncryption: boolean;
  /** App-Start-Schutz: PIN/Passwort verlangt (Auth-Record liegt separat in settings-Tabelle). */
  requirePassphrase: boolean;
  /** Auto-Lock nach Inaktivitaet. */
  autoLock: "off" | "5m" | "15m" | "30m" | "1h";
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama",
  model: "llama3.2",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt:
    "Du bist ein hilfreicher Schreibassistent für Autoren. Antworte auf Deutsch, präzise und im Ton des Textes.",
  theme: "dark",
  language: "de",
  highContrast: false,
  kiModelSlots: [{ id: "main", label: "Hauptmodell", provider: "ollama", model: "llama3.2" }],
  ollamaBaseUrl: "http://localhost:11434",
  lmstudioBaseUrl: "http://localhost:1234/v1",
  openaiApiKey: "",
  openrouterApiKey: "",
  gpt2apiBaseUrl: "http://localhost:8080/v1",
  gpt2apiApiKey: "",
  nousApiKey: "",
  nousBaseUrl: "https://inference-api.nousresearch.com/v1",
  imageProvider: "none",
  sdWebuiUrl: "http://localhost:7860",
  sdWebuiUsername: "",
  sdWebuiPassword: "",
  coverGenerator: "none",
  blurbGenerator: "none",
  scientificWriting: "none",
  privacyMode: false,
  manuscriptEncryption: false,
  requirePassphrase: false,
  autoLock: "off",
};
