// Hermes Import Service (Sprint 28, extra): Importiert API-Keys aus Hermes.
import { invoke } from "@tauri-apps/api/core";

export interface HermesKeys {
  openrouter_api_key?: string;
  openai_api_key?: string;
  gpt2api_api_key?: string;
  deepseek_api_key?: string;
  nous_api_key?: string;
}

/**
 * Importiert API-Keys aus der Hermes-Config.
 */
export async function importHermesKeys(): Promise<HermesKeys> {
  return await invoke<HermesKeys>("import_hermes_keys");
}
