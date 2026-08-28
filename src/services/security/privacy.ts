// Privatsphaere-Modus: zentrale Schaltstelle, um Telemetrie und Cloud-Calls
// zu unterbinden. Wenn aktiv:
//   - checkForUpdates() / installUpdate() werden blockiert (kein Update-Feed).
//   - Cloud-LLM-Provider (OpenAI, OpenRouter, gpt2api) werden blockiert —
//     nur lokale Provider (Ollama, LM Studio) sind erlaubt.
//   - Diagnose-/Telemetrie-Exports melden "disabled".
//
// Der Zustand lebt im Speicher; die Persistenz (privacyMode in AppSettings)
// bernimmt der Settings-Service beim App-Start via setPrivacyMode().

export type PrivacyReason = "privacy-mode" | "ok";

export interface PrivacyDecision {
  allowed: boolean;
  reason: PrivacyReason;
}

let privacyMode = false;

/** true, wenn der Privatsphaere-Modus aktiv ist. */
export function isPrivacyMode(): boolean {
  return privacyMode;
}

/** Setzt den Privatsphaere-Modus (beim App-Start aus Settings oder in der UI). */
export function setPrivacyMode(enabled: boolean): void {
  privacyMode = enabled;
}

/**
 * Entscheidet, ob ein Cloud-Netzwerkaufruf zugelassen ist.
 * Aufrufer: updater, LLM-Factory, Diagnostik.
 */
export function assertCloudAllowed(what: string): PrivacyDecision {
  if (privacyMode) {
    return {
      allowed: false,
      reason: "privacy-mode",
    };
  }
  void what; // Kontext nur fuer Logging im Aufrufer
  return { allowed: true, reason: "ok" };
}

/** Convenience fuer Aufrufer: wirft bei Blockierung eine erkennbare Meldung. */
export function requireCloudAllowed(what: string): void {
  const d = assertCloudAllowed(what);
  if (!d.allowed) {
    throw new Error(
      `Privatsphaere-Modus aktiv: "${what}" wurde blockiert. Kein Cloud-Aufruf, keine Telemetrie.`,
    );
  }
}

/** Liste der Provider, die als Cloud gelten (im Privatsphaere-Modus gesperrt). */
export const CLOUD_PROVIDERS: readonly string[] = ["openai", "openrouter", "gpt2api", "nous"];

export function isCloudProvider(provider: string): boolean {
  return CLOUD_PROVIDERS.includes(provider);
}
