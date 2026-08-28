// Schritt 3: Standardmodell wählen.

import type { ProviderProbe } from "@/services/setup/probe";
import type { ProviderId } from "@/types/llm";

interface Props {
  provider: ProviderId;
  model: string;
  onModelChange: (m: string) => void;
  probe: ProviderProbe | undefined;
  /** Probes ALLER Anbieter — die Modellliste kombiniert Ollama + LM Studio. */
  allProbes?: Record<string, ProviderProbe | undefined>;
}

/** Vorschläge, wenn keine Modellliste vorliegt. */
const FALLBACK: Record<string, string[]> = {
  ollama: ["llama3.2", "mistral", "qwen2.5", "gemma2"],
  lmstudio: ["local-model"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  openrouter: ["z-ai/glm-4.5-air:free", "deepseek/deepseek-chat-v3.1:free", "openai/gpt-4o-mini"],
  nous: ["Hermes-4.5-405B", "Hermes-4-405B", "Hermes-4-70B", "Hermes-3-Llama-3.1-405B"],
};

export function StepModel({ provider, model, onModelChange, probe, allProbes }: Props) {
  // Kombinierte Modellliste ALLER erreichbaren Anbieter (Ollama, LM Studio,
  // OpenRouter), ohne Duplikate, je Modell mit Herkunftslabel für die Anzeige.
  const localEntries: Array<{ id: string; source: string }> = [];
  for (const p of Object.values(allProbes ?? {})) {
    if (p?.reachable) {
      for (const m of p.models) {
        if (!localEntries.some((e) => e.id === m)) {
          localEntries.push({ id: m, source: p.label });
        }
      }
    }
  }
  const detected = localEntries.length > 0 ? localEntries : (probe?.models ?? []).map((m) => ({ id: m, source: probe?.label ?? "" }));
  const hasDetected = detected.length > 0;
  // Kein Anbieter erreichbar: stattdessen Freitext-Eingabe — der Nutzer
  // kennt sein Modell (oder den Standardnamen llama3.2) selbst. Kein
  // Schein-Auswahlmenü mit nur einem Eintrag.
  const offline = !hasDetected && probe != null && !probe.reachable;
  const currentOk = detected.some((e) => e.id === model);

  return (
    <>
      <div className="welcome-step-label">Schritt 3 von 4</div>
      <h2 className="welcome-step-title">Standardmodell festlegen</h2>
      <p className="welcome-step-intro">
        {hasDetected
          ? "Diese Modelle wurden gefunden. Du kannst später je Aufgabe ein anderes wählen."
          : offline
            ? "Kein KI-Anbieter ist gerade erreichbar. Trage den Modellnamen ein, den du verwenden möchtest — zum Beispiel llama3.2, sobald du Ollama startest („ollama serve“)."
            : "Es wurde keine Modellliste gefunden. Trage den Namen ein, den du verwenden möchtest — er muss beim Anbieter vorhanden sein."}
      </p>

      <div className="welcome-field">
        <label htmlFor="model-select">Modell</label>
        {hasDetected ? (
          <select
            id="model-select"
            value={currentOk ? model : detected[0].id}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {detected.map((e) => (
              <option key={e.id} value={e.id}>
                {e.source ? `${e.id}  ·  ${e.source}` : e.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="model-select"
            type="text"
            value={model}
            placeholder={FALLBACK[provider]?.[0] ?? "modellname"}
            onChange={(e) => onModelChange(e.target.value)}
            spellCheck={false}
          />
        )}
        {!hasDetected && !offline && (
          <div className="welcome-hint">
            Gängige Namen für {provider}: {(FALLBACK[provider] ?? []).join(", ")}
          </div>
        )}
      </div>

      {provider === "ollama" && (
        <p className="provider-status" style={{ marginTop: 24 }}>
          Für das Projektwissen wird zusätzlich ein Einbettungsmodell empfohlen:
          <br />
          <code className="selectable">ollama pull nomic-embed-text</code>
          <br />
          Ohne dieses Modell arbeitet die Projektsuche rein textbasiert — sie
          funktioniert, findet aber nur wörtliche Übereinstimmungen.
        </p>
      )}
    </>
  );
}
