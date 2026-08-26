// Erststart-Assistent. Führt durch Anbieterwahl, Modell und Startinhalte.
//
// Grundsätze:
//   - Überspringbar. Die App funktioniert ohne jede Einrichtung.
//   - Kein Schritt blockiert. Fehlgeschlagene Prüfungen sind Information,
//     keine Sperre.
//   - Nichts wird stillschweigend übertragen: Der OpenAI-Schlüssel wird nur
//     geprüft, wenn der Nutzer den Knopf drückt.

import { useState } from "react";
import { StepWelcome } from "./StepWelcome";
import { StepProvider } from "./StepProvider";
import { StepModel } from "./StepModel";
import { StepFinish } from "./StepFinish";
import type { ProviderProbe } from "@/services/setup/probe";
import { probeLocalProviders } from "@/services/setup/probe";
import { createSampleProject } from "@/services/setup/sampleProject";
import { markSetupCompleted } from "@/services/setup/state";
import { loadSettings, saveSettings } from "@/services/settings";
import { seedDefaultPrompts } from "@/services/prompt/seed";
import type { ProviderId } from "@/types/llm";
import "./welcome.css";

interface Props {
  /** Wird nach Abschluss oder Überspringen aufgerufen. */
  onDone: (createdProjectId: string | null) => void;
}

const TOTAL_STEPS = 4;

export function WelcomeWizard({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [model, setModel] = useState("llama3.2");
  const [openaiKey, setOpenaiKey] = useState("");
  const [probes, setProbes] = useState<Record<string, ProviderProbe | undefined>>({});
  const [sample, setSample] = useState(true);
  const [demoPrompts, setDemoPrompts] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Beim Betreten von Schritt 2 die lokalen Anbieter automatisch prüfen. */
  async function enterProviderStep() {
    setStep(1);
    const results = await probeLocalProviders();
    const map: Record<string, ProviderProbe> = {};
    for (const r of results) map[r.provider] = r;
    setProbes((prev) => ({ ...prev, ...map }));

    // Vorauswahl an der Realität ausrichten: Läuft nur LM Studio, dieses wählen.
    const ollamaOk = map.ollama?.reachable && map.ollama.models.length > 0;
    const lmOk = map.lmstudio?.reachable && map.lmstudio.models.length > 0;
    if (!ollamaOk && lmOk) setProvider("lmstudio");

    // Erstes gefundenes Modell übernehmen.
    const first = (ollamaOk ? map.ollama : lmOk ? map.lmstudio : undefined)?.models[0];
    if (first) setModel(first);
  }

  function recordProbe(key: string, probe: ProviderProbe) {
    setProbes((prev) => ({ ...prev, [key]: probe }));
    if (probe.reachable && probe.models.length > 0 && key === provider) {
      setModel(probe.models[0]);
    }
  }

  /** Einstellungen schreiben, optionale Inhalte anlegen, abschließen. */
  async function finish() {
    setSaving(true);
    setError(null);
    let projectId: string | null = null;

    try {
      // loadSettings ist synchron (liest aus der bereits geladenen DB).
      const current = loadSettings();
      await saveSettings({
        ...current,
        provider,
        model: model.trim() || current.model,
        theme,
        openaiApiKey: provider === "openai" ? openaiKey.trim() : current.openaiApiKey,
      });

      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);

      if (demoPrompts) {
        await seedDefaultPrompts();
      }
      if (sample) {
        projectId = await createSampleProject();
      }

      markSetupCompleted();
      onDone(projectId);
    } catch (e) {
      // Einrichtung darf nie in einer Sackgasse enden: Fehler zeigen,
      // Weiterkommen trotzdem erlauben.
      setError(
        `Die Einrichtung konnte nicht vollständig gespeichert werden: ${
          (e as Error)?.message ?? String(e)
        }. Du kannst alles in den Einstellungen nachtragen.`,
      );
      setSaving(false);
    }
  }

  function skip() {
    markSetupCompleted();
    onDone(null);
  }

  const activeProbe = probes[provider];

  return (
    <div className="welcome-overlay">
      <div className="welcome-sheet">
        {step === 0 ? (
          <div className="welcome-head">
            <StepWelcome />
          </div>
        ) : (
          <div className="welcome-body">
            {step === 1 && (
              <StepProvider
                provider={provider}
                onProviderChange={setProvider}
                openaiKey={openaiKey}
                onOpenaiKeyChange={setOpenaiKey}
                probes={probes}
                onProbe={recordProbe}
              />
            )}
            {step === 2 && (
              <StepModel
                provider={provider}
                model={model}
                onModelChange={setModel}
                probe={activeProbe}
              />
            )}
            {step === 3 && (
              <StepFinish
                sample={sample}
                onSampleChange={setSample}
                demoPrompts={demoPrompts}
                onDemoPromptsChange={setDemoPrompts}
                theme={theme}
                onThemeChange={setTheme}
              />
            )}
            {error && (
              <p className="provider-status error" style={{ marginTop: 20 }}>
                {error}
              </p>
            )}
          </div>
        )}

        <div className="welcome-foot">
          <div className="welcome-dots" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`welcome-dot${
                  i === step ? " active" : i < step ? " done" : ""
                }`}
              />
            ))}
          </div>

          <div className="welcome-actions">
            <button className="wbtn wbtn-quiet" onClick={skip} disabled={saving}>
              Überspringen
            </button>
            {step > 0 && (
              <button
                className="wbtn"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              >
                Zurück
              </button>
            )}
            {step === 0 && (
              <button className="wbtn wbtn-primary" onClick={() => void enterProviderStep()}>
                Einrichten
              </button>
            )}
            {step > 0 && step < TOTAL_STEPS - 1 && (
              <button className="wbtn wbtn-primary" onClick={() => setStep((s) => s + 1)}>
                Weiter
              </button>
            )}
            {step === TOTAL_STEPS - 1 && (
              <button
                className="wbtn wbtn-primary"
                onClick={() => void finish()}
                disabled={saving}
              >
                {saving ? "richte ein…" : "Fertig"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
