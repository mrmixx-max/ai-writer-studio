// Schritt 3: Standardmodell wählen.

import type { ProviderProbe } from "@/services/setup/probe";
import type { ProviderId } from "@/types/llm";

interface Props {
  provider: ProviderId;
  model: string;
  onModelChange: (m: string) => void;
  probe: ProviderProbe | undefined;
}

/** Vorschläge, wenn keine Modellliste vorliegt. */
const FALLBACK: Record<string, string[]> = {
  ollama: ["llama3.2", "mistral", "qwen2.5", "gemma2"],
  lmstudio: ["local-model"],
  openai: ["gpt-4o-mini", "gpt-4o"],
};

export function StepModel({ provider, model, onModelChange, probe }: Props) {
  const detected = probe?.models ?? [];
  const hasDetected = detected.length > 0;

  return (
    <>
      <div className="welcome-step-label">Schritt 3 von 4</div>
      <h2 className="welcome-step-title">Standardmodell festlegen</h2>
      <p className="welcome-step-intro">
        {hasDetected
          ? "Diese Modelle wurden gefunden. Du kannst später je Aufgabe ein anderes wählen."
          : "Es wurde keine Modellliste gefunden. Trage den Namen ein, den du verwenden möchtest — er muss beim Anbieter vorhanden sein."}
      </p>

      <div className="welcome-field">
        <label htmlFor="model-select">Modell</label>
        {hasDetected ? (
          <select
            id="model-select"
            value={detected.includes(model) ? model : detected[0]}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {detected.map((m) => (
              <option key={m} value={m}>
                {m}
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
        {!hasDetected && (
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
