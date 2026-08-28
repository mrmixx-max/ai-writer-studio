// ModelStatusBar: schlanke Statuszeile unter dem Editor.
// Provider-Status-Indikator (grün/gelb/rot Punkt + Modellname), Update alle
// 30 s via modelRegistry. Offline: grau + "(offline)" — konsistent mit
// ModelPicker und KI-Panel (gleiche display-Logik aus useModelStatus).

import { useActiveModel, useModelStatus } from "./useActiveModel";

const LEVEL_LABEL: Record<string, string> = {
  ok: "erreichbar",
  degraded: "aktiv offline — Ersatz verfügbar",
  down: "kein Anbieter erreichbar",
};

export function ModelStatusBar({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const { settings } = useActiveModel();
  const status = useModelStatus(settings, intervalMs);

  return (
    <div
      className={`model-statusbar model-status-${status.level}${status.activeOffline ? " model-offline" : ""}`}
      role="status"
      aria-label="Provider-Status"
      title={LEVEL_LABEL[status.level]}
    >
      <span className={`model-status-dot model-status-dot-${status.level}`} aria-hidden="true" />
      <span className="model-status-label">{status.display}</span>
    </div>
  );
}
