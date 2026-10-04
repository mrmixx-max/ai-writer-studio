// MasterPublishingCockpit (WP 43.2): Master Release Cockpit & 1-Klick-Publisher.
//
// Führt den Master-Preflight über das gesamte Buch aus und schnürt auf
// Knopfdruck das verkaufsfertige Verlags-Bundle.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useState } from "react";
import {
  runMasterPreflight,
  buildPublishingBundle,
  describeBundle,
  type PublishingProject,
  type PreflightResult,
  type PublishingBundle,
} from "@/services/publishing/masterPublishingService";

export interface MasterPublishingCockpitProps {
  project: PublishingProject;
  className?: string;
  /** Wird beim Fertigstellen des Bundles gerufen (z. B. für Download). */
  onBundleReady?: (bundle: PublishingBundle) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  P0: "var(--error)",
  P1: "var(--warn)",
  P2: "var(--muted)",
};

export function MasterPublishingCockpit({
  project,
  className,
  onBundleReady,
}: MasterPublishingCockpitProps) {
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [bundle, setBundle] = useState<PublishingBundle | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePreflight = useCallback(() => {
    setBusy(true);
    try {
      setPreflight(runMasterPreflight(project));
      setBundle(null);
    } finally {
      setBusy(false);
    }
  }, [project]);

  const handleBuildBundle = useCallback(() => {
    if (!preflight) return;
    setBusy(true);
    try {
      const b = buildPublishingBundle(project, preflight);
      setBundle(b);
      onBundleReady?.(b);
    } finally {
      setBusy(false);
    }
  }, [project, preflight, onBundleReady]);

  return (
    <div
      className={className}
      data-testid="master-publishing-cockpit"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🚀 Master Release Cockpit
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {project.title} · {project.chapters.length} Kapitel · Preflight über alle Kern-Werkzeuge
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          data-testid="cockpit-preflight"
          onClick={handlePreflight}
          disabled={busy}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          🔍 Master-Preflight starten
        </button>
        <button
          data-testid="cockpit-build"
          onClick={handleBuildBundle}
          disabled={busy || !preflight}
          style={{
            background: preflight ? "transparent" : "transparent",
            color: preflight ? "var(--success)" : "var(--muted)",
            border: `1px solid ${preflight ? "var(--success)" : "var(--border)"}`,
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 12,
            cursor: busy || !preflight ? "not-allowed" : "pointer",
          }}
        >
          📦 Verlags-Bundle schnüren
        </button>
      </div>

      {preflight && (
        <div data-testid="cockpit-preflight-result" style={{ marginBottom: 16 }}>
          <div
            data-testid="cockpit-verdict"
            style={{
              display: "inline-block",
              border: `1px solid ${preflight.passed ? "var(--success)" : "var(--error)"}`,
              color: preflight.passed ? "var(--success)" : "var(--error)",
              borderRadius: 4,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {preflight.passed ? "✓ FREIGEGEBEN" : "✗ BLOCKIERT"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
            {preflight.checksRun} Prüfungen · Reife {preflight.readinessScore} % ·{" "}
            {preflight.blockers.length} Blocker · {preflight.warnings.length} Warnungen
          </div>

          {preflight.blockers.length > 0 && (
            <div data-testid="cockpit-blockers" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>BLOCKER</div>
              {preflight.blockers.map((b, i) => (
                <div
                  key={`b-${i}`}
                  data-testid={`cockpit-blocker-${i}`}
                  style={{
                    borderLeft: `3px solid ${SEVERITY_COLOR[b.severity]}`,
                    paddingLeft: 8,
                    fontSize: 11,
                    marginBottom: 4,
                    color: "var(--fg)",
                  }}
                >
                  <strong style={{ color: SEVERITY_COLOR[b.severity] }}>[{b.severity}]</strong>{" "}
                  {b.check}: {b.message}
                </div>
              ))}
            </div>
          )}

          {preflight.warnings.length > 0 && (
            <div data-testid="cockpit-warnings">
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>WARNUNGEN</div>
              {preflight.warnings.slice(0, 10).map((w, i) => (
                <div
                  key={`w-${i}`}
                  data-testid={`cockpit-warning-${i}`}
                  style={{
                    borderLeft: `3px solid ${SEVERITY_COLOR[w.severity]}`,
                    paddingLeft: 8,
                    fontSize: 11,
                    marginBottom: 4,
                    color: "var(--muted)",
                  }}
                >
                  <strong style={{ color: SEVERITY_COLOR[w.severity] }}>[{w.severity}]</strong>{" "}
                  {w.check}: {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bundle && (
        <div data-testid="cockpit-bundle">
          <div style={{ fontSize: 13, color: "var(--success)", marginBottom: 8 }}>
            📦 Bundle fertig — {bundle.files.length} Dateien,{" "}
            {(bundle.totalSizeBytes / 1024).toFixed(1)} kB
          </div>
          <ul data-testid="cockpit-bundle-files" style={{ margin: 0, paddingLeft: 18 }}>
            {describeBundle(bundle).map((line, i) => (
              <li key={i} style={{ fontSize: 11, color: "var(--fg)", marginBottom: 3 }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!preflight && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Starte den Preflight, um Blocker und Warnungen zu sehen.
        </div>
      )}
    </div>
  );
}
