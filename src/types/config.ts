// App-weite Einstellungen (persistiert in SQLite + .env-Defaults)
import type { ProviderId } from "./llm";

export interface AppSettings {
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  theme: "light" | "dark";
  ollamaBaseUrl: string;
  lmstudioBaseUrl: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  gpt2apiBaseUrl: string;
  gpt2apiApiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama",
  model: "llama3.2",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt:
    "Du bist ein hilfreicher Schreibassistent für Autoren. Antworte auf Deutsch, präzise und im Ton des Textes.",
  theme: "dark",
  ollamaBaseUrl: "http://localhost:11434",
  lmstudioBaseUrl: "http://localhost:1234/v1",
  openaiApiKey: "",
  openrouterApiKey: "",
  gpt2apiBaseUrl: "http://localhost:8080/v1",
  gpt2apiApiKey: "",
};
