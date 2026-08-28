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
import { StepTemplates } from "./StepTemplates";
import { StepFinish } from "./StepFinish";
import type { ProviderProbe } from "@/services/setup/probe";
import { probeLocalProviders, probeOpenRouter, probeNous } from "@/services/setup/probe";
import { createSampleProject } from "@/services/setup/sampleProject";
import { createProject } from "@/services/project";
import { applyTemplates } from "@/services/templates";
import type { TemplateSelection } from "@/services/templates";
import { markSetupCompleted } from "@/services/setup/state";
import { loadSettings, saveSettings } from "@/services/settings";
import { seedDefaultPrompts } from "@/services/prompt/seed";
import type { ProviderId } from "@/types/llm";
import "./welcome.css";

interface Props {
  /** Wird nach Abschluss oder Überspringen aufgerufen. */
  onDone: (createdProjectId: string | null) => void;
}

const TOTAL_STEPS = 5;

/** true, wenn überhaupt eine Vorlage ausgewählt ist. */
function hasTemplateSelection(s: TemplateSelection): boolean {
  return Boolean(s.book || s.plot || s.characters?.length);
}

export function WelcomeWizard({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [model, setModel] = useState("llama3.2");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [nousKey, setNousKey] = useState("");
  const [probes, setProbes] = useState<Record<string, ProviderProbe | undefined>>({});
  const [sample, setSample] = useState(true);
  const [demoPrompts, setDemoPrompts] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [templates, setTemplates] = useState<TemplateSelection>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Beim Betreten von Schritt 2 ALLE Anbieter automatisch prüfen — lokale
   * parallel, OpenRouter (öffentliche Modellliste) ebenfalls. Jeder Anbieter
   * liefert seinen Lifescheck-Status und die verfügbaren Modelle mit.
   */
  async function enterProviderStep() {
    setStep(1);
    const [local, openrouter] = await Promise.all([
      probeLocalProviders(),
      probeOpenRouter(),
    ]);
    // Nous Research nur mit vorhandenem Schlüssel automatisch prüfen —
    // die Prüfung überträgt den Schlüssel an einen externen Dienst.
    const current = loadSettings();
    const nous = current.nousApiKey ? await probeNous(current.nousApiKey) : undefined;
    const map: Record<string, ProviderProbe> = {};
    for (const r of [...local, openrouter]) map[r.provider] = r;
    if (nous) map[nous.provider] = nous;
    setProbes((prev) => ({ ...prev, ...map }));

    // Vorauswahl an der Realität ausrichten: Erster Anbieter mit Modellen.
    // Lokale zuerst (Datenschutz), dann OpenRouter.
    const withModels = [
      map.ollama,
      map.lmstudio,
      map.gpt2api,
      map.openrouter,
      map.nous,
    ].find((p) => p?.reachable && p.models.length > 0);
    if (withModels) {
      setProvider(withModels.provider as ProviderId);
      setModel(withModels.models[0]);
    }
  }

  function recordProbe(key: string, probe: ProviderProbe) {
    setProbes((prev) => ({ ...prev, [key]: probe }));
    if (probe.reachable && probe.models.length > 0 && key === provider) {
      setModel(probe.models[0]);
    }
  }

  /** Beim Anbieterwechsel: falls Modelle für den neuen Anbieter bekannt, übernehmen. */
  function changeProvider(p: ProviderId) {
    setProvider(p);
    const probe = probes[p];
    if (probe?.reachable && probe.models.length > 0 && !probe.models.includes(model)) {
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
        openrouterApiKey: provider === "openrouter" ? openrouterKey.trim() : current.openrouterApiKey,
        nousApiKey: provider === "nous" ? nousKey.trim() : current.nousApiKey,
      });

      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);

      if (demoPrompts) {
        await seedDefaultPrompts();
      }

      if (sample) {
        projectId = await createSampleProject();
      }

      // Vorlagen: Anwenden auf das Beispielprojekt (falls angelegt),
      // sonst ein eigenes Projekt aufmachen. Fehler werden gemeldet,
      // brechen die Einrichtung aber nicht ab.
      if (hasTemplateSelection(templates)) {
        if (projectId) {
          await applyTemplates(projectId, templates);
        } else {
          const tplProject = await createProject("Neues Projekt");
          await applyTemplates(tplProject.id, templates);
          projectId = tplProject.id;
        }
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
                onProviderChange={changeProvider}
                openaiKey={openaiKey}
                onOpenaiKeyChange={setOpenaiKey}
                openrouterKey={openrouterKey}
                onOpenrouterKeyChange={setOpenrouterKey}
                nousKey={nousKey}
                onNousKeyChange={setNousKey}
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
                allProbes={probes}
              />
            )}
            {step === 3 && (
              <StepTemplates
                selection={templates}
                onChange={setTemplates}
              />
            )}
            {step === 4 && (
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
