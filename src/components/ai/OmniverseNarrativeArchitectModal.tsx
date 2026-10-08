// OmniverseNarrativeArchitectModal (WP 100.1 UI)
import { useState, useMemo } from "react";
import {
  analyzeOmniverse,
  synchronizePlotStrands,
  createSampleWorldModel,
} from "@/services/ai/omniverseNarrativeArchitect";

export interface OmniverseNarrativeArchitectModalProps {
  className?: string;
}

export function OmniverseNarrativeArchitectModal({ className }: OmniverseNarrativeArchitectModalProps) {
  const [title, setTitle] = useState("Das Zwölfgestirn");
  const [synced, setSynced] = useState(false);

  const baseModel = useMemo(() => createSampleWorldModel(), []);
  const { model, report: syncReport } = useMemo(() => synchronizePlotStrands(baseModel), [baseModel]);
  const activeModel = synced ? model : baseModel;
  const analysis = useMemo(() => analyzeOmniverse(activeModel), [activeModel]);

  const severityColor = (s: "info" | "warn" | "error") =>
    s === "error" ? "var(--error)" : s === "warn" ? "var(--warn)" : "var(--muted)";

  return (
    <div
      className={className}
      data-testid="omniverse-architect-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌌 360° Omniverse Story-Architekt
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Bericht {analysis.id} · {analysis.nodeCount} Orte · {analysis.characterCount} Figuren · {analysis.passageCount} Textstellen
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Projektname
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <button
          onClick={() => setSynced((v) => !v)}
          style={{ padding: "6px 12px", background: synced ? "var(--accent)" : "var(--panel)", color: synced ? "var(--bg)" : "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          {synced ? "↺ Zurücksetzen" : "⚡ 1-Klick-Synchronisation"}
        </button>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🩺 GANZHEITLICHER ZUSTAND
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <span>Gesundheitsscore</span>
            <span style={{ color: analysis.healthScore >= 70 ? "var(--success)" : "var(--error)", fontWeight: 700 }}>{analysis.healthScore}%</span>
          </div>
          <div style={{ padding: 6, border: `1px solid ${analysis.synchronized ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontWeight: 700 }}>
            {analysis.synchronized ? "✓ ALLE STRÄNGE SYNCHRON" : "✗ INKONSISTENZEN ERKANNT"}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🚨 INKONSISTENZ-FRÜHWARNSYSTEM ({analysis.inconsistencies.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {analysis.inconsistencies.length === 0 && (
            <div style={{ padding: 8, fontSize: 11, color: "var(--muted)" }}>Keine Brüche gefunden.</div>
          )}
          {analysis.inconsistencies.map((i, idx) => (
            <div key={idx} style={{ padding: 8, border: `1px solid ${severityColor(i.severity)}`, borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: severityColor(i.severity), fontWeight: 700 }}>{i.kind}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{i.passageId}</span>
              </div>
              <div style={{ marginTop: 4 }}>{i.message}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔗 SYSTEM-VERKNÜPFUNGEN ({analysis.links.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {analysis.links.map((l, idx) => (
            <div key={idx} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span style={{ color: "var(--accent)" }}>[{l.system}]</span> {l.passageId} → {l.targetId} · {l.detail}
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚡ SYNCHRONISATIONS-BERICHT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div>Vorher: {syncReport.before} · Nachher: {syncReport.after}</div>
          {syncReport.adjustments.map((a, i) => (
            <div key={i} style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>• {a}</div>
          ))}
        </div>
      </details>
    </div>
  );
}
