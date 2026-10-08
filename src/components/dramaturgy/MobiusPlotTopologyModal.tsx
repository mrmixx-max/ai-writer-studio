// MobiusPlotTopologyModal (WP 104.1 UI)
import { useState, useMemo } from "react";
import {
  analyzeTopology,
  renderMobiusCanvas,
  createSampleOuroborosTopology,
  createSamplePalindromeTopology,
  TOPOLOGY_MODELS,
  type TopologyModelId,
} from "@/services/dramaturgy/mobiusPlotTopology";

export interface MobiusPlotTopologyModalProps {
  className?: string;
}

export function MobiusPlotTopologyModal({ className }: MobiusPlotTopologyModalProps) {
  const [model, setModel] = useState<TopologyModelId>("ouroboros");
  const [title, setTitle] = useState("Die Schleife des Tagebuchs");

  const topology = useMemo(
    () =>
      model === "palindrome"
        ? createSamplePalindromeTopology()
        : { ...createSampleOuroborosTopology(), model, title },
    [model, title]
  );
  const report = useMemo(() => analyzeTopology(topology), [topology]);
  const canvas = useMemo(() => renderMobiusCanvas(topology), [topology]);

  const severityColor = (s: "info" | "warn" | "error") =>
    s === "error" ? "var(--error)" : s === "warn" ? "var(--warn)" : "var(--muted)";

  return (
    <div
      className={className}
      data-testid="mobius-topology-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌀 Möbius- &amp; Ouroboros-Plot-Topologie
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Topologie {report.id} · {report.nodeCount} Knoten · Modell {report.model.name}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Topologisches Modell
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as TopologyModelId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {TOPOLOGY_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎨 INTERAKTIVER MÖBIUS-CANVAS
        </summary>
        <div
          style={{ marginTop: 8, padding: 12, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", display: "flex", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: canvas.svg }}
        />
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
          {canvas.pathPoints} Kurvenpunkte · Modell {canvas.model}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ♾️ SCHLEIFEN-KAUSALITÄTS-PRÜFER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <span>Kausalkette geschlossen</span>
            <span style={{ color: report.loopClosed ? "var(--success)" : "var(--warn)", fontWeight: 700 }}>
              {report.loopClosed ? "✓ ja" : "○ nein"}
            </span>
          </div>
          <div style={{ padding: 6, border: `1px solid ${report.coherent ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontWeight: 700 }}>
            {report.coherent ? "✓ KEINE PARADOXA — TOPOLOGIE KOHÄRENT" : "✗ PARADOXA ODER BRÜCHE ERKANNT"}
          </div>
          {report.issues.map((issue, i) => (
            <div key={i} style={{ padding: 8, border: `1px solid ${severityColor(issue.severity)}`, borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: severityColor(issue.severity), fontWeight: 700 }}>{issue.kind}</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{issue.nodeId}</span>
              </div>
              <div style={{ marginTop: 4 }}>{issue.message}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📐 MODELL-ANFORDERUNG
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Prinzip:</strong> {report.model.principle}</div>
          <div><strong>Anforderung:</strong> {report.model.requirement}</div>
          <div><strong>Vorbilder:</strong> {report.model.exemplars.join(", ")}</div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔗 PLOT-KNOTEN ({topology.nodes.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {[...topology.nodes].sort((a, b) => a.order - b.order).map((n) => (
            <div key={n.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span style={{ color: "var(--accent)" }}>#{n.order}</span> {n.label}
              <span style={{ fontSize: 10, color: "var(--muted)" }}> · Erzählzeit {n.storyTime} · Ursachen: {n.causes.join(", ") || "keine"}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
