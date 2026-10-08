// QuantumNarrativeConvergenceModal (WP 120.1 UI, Meilenstein 58.0, v7.0.0)
//
// Multi-POV-Konvergenz- & Showdown-Orchestrator. Führt bis zu acht parallele
// Handlungsstränge zu einem synchronen Showdown-Raster zusammen, erzeugt
// flüssige Perspektiv-Übergaben und prüft die Kausalitäts-Kaskade.
//
// Vollständig lokal & deterministisch (kein LLM, kein Netzwerk). Design nur
// über Tokens — keine Hex-Farben.
import { useState, useMemo } from "react";
import {
  SYNC_GRID_SIZE,
  CharacterState,
  createSyncGrid,
  generateHandoffSequence,
  checkCausality,
  createSampleSyncGrid,
  createSampleHandoff,
} from "@/services/ai/quantumNarrativeConvergence";

export interface QuantumNarrativeConvergenceModalProps {
  className?: string;
}

/** Baut eine deterministische Zeitleiste aus dem Raster für die Kausalitätsprüfung. */
function buildTimeline(grid: CharacterState[]): { characterId: string; action: string; timestamp: number }[] {
  return grid.map((c, i) => ({
    characterId: c.id,
    action: c.goal && c.goal.trim().length > 0 ? c.goal : `handelt als ${c.role || "Unbekannt"}`,
    timestamp: i,
  }));
}

export function QuantumNarrativeConvergenceModal({ className }: QuantumNarrativeConvergenceModalProps) {
  const [seed, setSeed] = useState(42);

  const grid = useMemo(() => createSampleSyncGrid(), []);
  const syncResult = useMemo(() => createSyncGrid(grid), [grid]);
  const handoff = useMemo(() => generateHandoffSequence(grid, seed), [grid, seed]);
  const sampleHandoff = useMemo(() => createSampleHandoff(), []);
  const timeline = useMemo(() => buildTimeline(grid), [grid]);
  const causality = useMemo(() => checkCausality(grid, timeline), [grid, timeline]);

  const panelStyle: React.CSSProperties = {
    padding: 8,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
  };

  return (
    <div
      className={className}
      data-testid="quantum-narrative-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌀 Multi-POV-Konvergenz- &amp; Showdown-Orchestrator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {SYNC_GRID_SIZE}-Slot-Synchronraster · {grid.length} Stränge · Seed {seed} · {handoff.transitions.length} Übergänge
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 140 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "4px 8px",
              fontSize: 11,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontFamily: "var(--font-mono)",
            }}
          />
        </label>
        <button
          onClick={() => setSeed((s) => s + 1)}
          style={{
            padding: "6px 12px",
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          🎲 Seed erhöhen
        </button>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧭 SYNCHRONASTER ({SYNC_GRID_SIZE} Slots)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {syncResult.grid.map((c) => (
            <div key={c.id} style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                <span style={{ color: "var(--accent)", fontSize: 10 }}>{c.role}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                Ziel: {c.goal || "—"} · Position ({c.position.x}, {c.position.y}) · Spannung {c.tension.toFixed(2)}
              </div>
            </div>
          ))}
          {syncResult.conflicts.length > 0 && (
            <div style={{ ...panelStyle, borderColor: "var(--error)" }}>
              <div style={{ color: "var(--error)", fontWeight: 700, marginBottom: 4 }}>
                Konflikte ({syncResult.conflicts.length})
              </div>
              {syncResult.conflicts.map((m, i) => (
                <div key={i} style={{ fontSize: 10 }}>• {m}</div>
              ))}
            </div>
          )}
          {syncResult.warnings.length > 0 && (
            <div style={panelStyle}>
              <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>
                Warnungen ({syncResult.warnings.length})
              </div>
              {syncResult.warnings.map((m, i) => (
                <div key={i} style={{ fontSize: 10, color: "var(--muted)" }}>• {m}</div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔗 HANDOFF-WEAVING ({handoff.transitions.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {handoff.sequence.map((beat, i) => (
            <div key={i} style={panelStyle}>
              <span style={{ color: "var(--accent)", fontSize: 10 }}>Beat {i + 1}</span> {beat}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Referenz-Beispiel: {sampleHandoff.transitions.length} Übergänge (Seed-Basis)
          </div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⏳ KAUSALITÄTS-KASKADE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={panelStyle}>
            <div style={{ fontWeight: 700 }}>
              {causality.violations.length === 0 && causality.anomalies.length === 0
                ? "✓ Kausalkette konsistent"
                : "✗ Verstöße erkannt"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {causality.violations.length} Verstöße · {causality.anomalies.length} Anomalien · {causality.warnings.length} Warnungen
            </div>
          </div>
          {causality.violations.map((m, i) => (
            <div key={`v${i}`} style={{ ...panelStyle, borderColor: "var(--error)", fontSize: 10 }}>
              <span style={{ color: "var(--error)", fontWeight: 700 }}>Verstoß</span> {m}
            </div>
          ))}
          {causality.anomalies.map((m, i) => (
            <div key={`a${i}`} style={{ ...panelStyle, fontSize: 10 }}>
              <span style={{ color: "var(--error)", fontWeight: 700 }}>Anomalie</span> {m}
            </div>
          ))}
          {causality.warnings.map((m, i) => (
            <div key={`w${i}`} style={{ ...panelStyle, fontSize: 10, color: "var(--muted)" }}>
              <span style={{ fontWeight: 700 }}>Warnung</span> {m}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
