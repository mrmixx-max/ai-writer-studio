// ModelStatusBar: schlanke Statuszeile unter dem Editor.
// Provider-Status-Indikator (grün/gelb/rot Punkt + Modellname), Update alle
// 30 s via modelRegistry. Offline (lokal): Edit-Feld + Starten-CTA statt roter Warnung.

import { useState } from "react";
import { ModelPicker } from "./ModelPicker";
import { useActiveModel, useModelStatus } from "./useActiveModel";
import { labelFor } from "@/services/llm/modelRegistry";

const LEVEL_LABEL: Record<string, string> = {
  ok: "erreichbar",
  degraded: "aktiv offline — Ersatz verfügbar",
  down: "kein Anbieter erreichbar",
};

/** true für lokale Provider, bei denen Offline-Edit + Starten-CTA Sinn macht. */
function isLocal(provider: string): boolean {
  return provider === "ollama" || provider === "lmstudio";
}

export function ModelStatusBar({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const { settings, selectModel } = useActiveModel();
  const status = useModelStatus(settings, intervalMs);
  const [editModel, setEditModel] = useState("");
  const [showInput, setShowInput] = useState(false);

  // Lokaler Provider offline → Edit-Feld + Starten-CTA statt roter Warnung
  if (status.activeOffline && isLocal(settings.provider)) {
    return (
      <div
        className="model-statusbar model-status-degraded model-offline"
        role="status"
        aria-label="Provider offline"
        title="Lokaler Anbieter nicht erreichbar"
      >
        <span className="model-status-dot model-status-dot-degraded" aria-hidden="true" />
        <span className="model-status-label">{labelFor(settings.provider)} offline</span>
        {showInput ? (
          <input
            className="model-status-edit"
            autoFocus
            value={editModel}
            placeholder="Modellname eingeben…"
            onChange={(e) => setEditModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editModel.trim()) {
                selectModel(settings.provider, editModel.trim());
                setShowInput(false);
                setEditModel("");
              } else if (e.key === "Escape") {
                setShowInput(false);
                setEditModel("");
              }
            }}
            onBlur={() => { setShowInput(false); setEditModel(""); }}
          />
        ) : (
          <button
            className="model-status-edit-trigger"
            onClick={() => setShowInput(true)}
            title="Modellnamen eingeben"
          >
            {settings.model} ✎
          </button>
        )}
        <button
          className="model-status-cta"
          onClick={() => {
            // Öffnet den System-Dialog zum Starten von Ollama/LM Studio
            // (TAURI: shell open oder Hinweis)
            if (settings.provider === "ollama") {
              alert("Ollama starten:\n\nollama serve\n\nDann Aktualisieren klicken.");
            } else {
              alert("LM Studio starten und Server aktivieren.\n\nDann Aktualisieren klicken.");
            }
          }}
          title={`${labelFor(settings.provider)} starten`}
        >
          Starten
        </button>
        <button
          className="model-status-refresh"
          onClick={status.refresh}
          title="Erneut prüfen"
          aria-label="Provider erneut prüfen"
        >
          ⟳
        </button>
      </div>
    );
  }

  // Erreichbar oder Cloud-Offline: normaler Picker (kompakt)
  return (
    <div
      className={`model-statusbar model-status-${status.level}${status.activeOffline ? " model-offline" : ""}`}
      role="status"
      aria-label="Provider-Status"
      title={LEVEL_LABEL[status.level]}
    >
      <span className={`model-status-dot model-status-dot-${status.level}`} aria-hidden="true" />
      <ModelPicker settings={settings} onSelect={selectModel} variant="badge" />
    </div>
  );
}
