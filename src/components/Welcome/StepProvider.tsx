// Schritt 2: Anbieterwahl mit echten Erreichbarkeitstests.

import { useState } from "react";
import type { ProviderProbe } from "@/services/setup/probe";
import { probeOllama, probeLmStudio, probeOpenAi } from "@/services/setup/probe";
import type { ProviderId } from "@/types/llm";

interface Props {
  provider: ProviderId;
  onProviderChange: (p: ProviderId) => void;
  openaiKey: string;
  onOpenaiKeyChange: (k: string) => void;
  probes: Record<string, ProviderProbe | undefined>;
  onProbe: (key: string, probe: ProviderProbe) => void;
}

/** Ordnet einer Prüfung die passende Statusklasse zu. */
function statusClass(p: ProviderProbe | undefined): string {
  if (!p) return "";
  if (!p.reachable) return "error";
  if (p.models.length === 0) return "warn";
  return "ok";
}

export function StepProvider({
  provider,
  onProviderChange,
  openaiKey,
  onOpenaiKeyChange,
  probes,
  onProbe,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function runProbe(key: "ollama" | "lmstudio" | "openai") {
    setBusy(key);
    try {
      const result =
        key === "ollama"
          ? await probeOllama()
          : key === "lmstudio"
            ? await probeLmStudio()
            : await probeOpenAi(openaiKey);
      onProbe(key, result);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="welcome-step-label">Schritt 2 von 4</div>
      <h2 className="welcome-step-title">KI-Anbieter wählen</h2>
      <p className="welcome-step-intro">
        Wähle, womit die KI-Funktionen arbeiten sollen. Lokale Anbieter sind
        empfohlen: Deine Texte verlassen den Rechner dann nicht. Du kannst die
        Wahl jederzeit ändern.
      </p>

      <div className="provider-list">
        {/* --- Ollama --- */}
        <button
          type="button"
          className={`provider-card${provider === "ollama" ? " selected" : ""}`}
          onClick={() => onProviderChange("ollama")}
        >
          <span className="provider-radio" />
          <span>
            <span className="provider-name">
              Ollama
              <span className="provider-tag">lokal · empfohlen</span>
            </span>
            <span className="provider-desc">
              Läuft auf deinem Rechner, keine Internetverbindung nötig.
              Modelle über „ollama pull“.
            </span>
            {probes.ollama && (
              <span className={`provider-status ${statusClass(probes.ollama)}`}>
                {probes.ollama.message}
              </span>
            )}
          </span>
          <span className="provider-check">
            <button
              type="button"
              className="wbtn"
              disabled={busy === "ollama"}
              onClick={(e) => {
                e.stopPropagation();
                void runProbe("ollama");
              }}
            >
              {busy === "ollama" ? "prüfe…" : "Testen"}
            </button>
            {probes.ollama?.latencyMs != null && (
              <span className="provider-latency">{probes.ollama.latencyMs} ms</span>
            )}
          </span>
        </button>

        {/* --- LM Studio --- */}
        <button
          type="button"
          className={`provider-card${provider === "lmstudio" ? " selected" : ""}`}
          onClick={() => onProviderChange("lmstudio")}
        >
          <span className="provider-radio" />
          <span>
            <span className="provider-name">
              LM Studio
              <span className="provider-tag">lokal</span>
            </span>
            <span className="provider-desc">
              Grafische Modellverwaltung mit lokalem Server auf Port 1234.
            </span>
            {probes.lmstudio && (
              <span className={`provider-status ${statusClass(probes.lmstudio)}`}>
                {probes.lmstudio.message}
              </span>
            )}
          </span>
          <span className="provider-check">
            <button
              type="button"
              className="wbtn"
              disabled={busy === "lmstudio"}
              onClick={(e) => {
                e.stopPropagation();
                void runProbe("lmstudio");
              }}
            >
              {busy === "lmstudio" ? "prüfe…" : "Testen"}
            </button>
            {probes.lmstudio?.latencyMs != null && (
              <span className="provider-latency">{probes.lmstudio.latencyMs} ms</span>
            )}
          </span>
        </button>

        {/* --- OpenAI --- */}
        <button
          type="button"
          className={`provider-card${provider === "openai" ? " selected" : ""}`}
          onClick={() => onProviderChange("openai")}
        >
          <span className="provider-radio" />
          <span>
            <span className="provider-name">
              OpenAI
              <span className="provider-tag">Cloud</span>
            </span>
            <span className="provider-desc">
              Benötigt einen API-Schlüssel. Textausschnitte werden dabei an
              OpenAI übertragen.
            </span>
            {probes.openai && (
              <span className={`provider-status ${statusClass(probes.openai)}`}>
                {probes.openai.message}
              </span>
            )}
          </span>
        </button>
      </div>

      {provider === "openai" && (
        <div className="welcome-field" style={{ marginTop: 20 }}>
          <label htmlFor="oa-key">OpenAI API-Schlüssel</label>
          <input
            id="oa-key"
            type="password"
            value={openaiKey}
            placeholder="sk-…"
            onChange={(e) => onOpenaiKeyChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="welcome-hint">
            Der Schlüssel wird ausschließlich lokal gespeichert.{" "}
            <button
              type="button"
              className="wbtn wbtn-quiet"
              disabled={!openaiKey.trim() || busy === "openai"}
              onClick={() => void runProbe("openai")}
            >
              {busy === "openai" ? "prüfe…" : "Schlüssel prüfen"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
