// EspionageTradecraftEngineModal (WP 118.1 UI, Meilenstein 57.0 / v6.9.0)
// Spionage-Tradecraft & Tot-Briefkasten-Topografie — kalter-Krieg-Spionage UI surface.
import { useState, useMemo } from "react";
import {
  TRADECRAFT_OPERATIONS,
  generateTradecraftProse,
  generateDeadDropTopography,
  createSampleTradecraftOperation,
  createSampleDeadDrop,
  type TradecraftOperationId,
} from "@/services/worldbuilding/espionageTradecraftEngine";

export interface EspionageTradecraftEngineModalProps {
  className?: string;
}

export function EspionageTradecraftEngineModal({ className }: EspionageTradecraftEngineModalProps) {
  const [seed, setSeed] = useState(42);
  const [operationId, setOperationId] = useState<TradecraftOperationId>(
    () => createSampleTradecraftOperation().id,
  );

  const operation = useMemo(
    () => TRADECRAFT_OPERATIONS.find((op) => op.id === operationId) ?? TRADECRAFT_OPERATIONS[0],
    [operationId],
  );
  const prose = useMemo(() => generateTradecraftProse(operationId, seed), [operationId, seed]);
  const topography = useMemo(() => generateDeadDropTopography(seed), [seed]);
  const sampleDrop = useMemo(() => createSampleDeadDrop(), []);

  const riskColor = (r: number) =>
    r >= 8 ? "var(--error)" : r >= 6 ? "var(--warn)" : r >= 4 ? "var(--accent)" : "var(--success)";

  return (
    <div
      className={className}
      data-testid="espionage-tradecraft-modal"
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
        🕵️ Spionage-Tradecraft &amp; Tot-Briefkasten-Topografie
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {TRADECRAFT_OPERATIONS.length} Tradecraft-Operationen · Risiko: {operation.riskLevel}/10 · Referenz-Totbriefkasten:{" "}
        {sampleDrop.location}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 200, flex: "1 1 200px" }}>
          Operation
          <select
            value={operationId}
            onChange={(e) => setOperationId(e.target.value as TradecraftOperationId)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "4px 8px",
              fontSize: 11,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            {TRADECRAFT_OPERATIONS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
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
            }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 {operation.name} — Risiko {operation.riskLevel}/10
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            <div>{operation.description}</div>
            <div style={{ marginTop: 6 }}>
              <strong>Risikostufe:</strong>{" "}
              <span style={{ color: riskColor(operation.riskLevel) }}>{operation.riskLevel} / 10</span>
            </div>
          </div>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>SCHRITTE</div>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {operation.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🕯️ SPIONAGE-PROSA
        </summary>
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--panel)",
            fontSize: 11,
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontStyle: "italic" }}>{prose}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📬 DEAD-DROP-TOPOGRAFIE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              padding: 8,
              border: `1px solid ${riskColor(topography.riskLevel)}`,
              borderRadius: 4,
              background: "var(--panel)",
              fontSize: 11,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: riskColor(topography.riskLevel), fontWeight: 700 }}>
                Risiko: {topography.riskLevel}/10
              </span>
              <span style={{ color: "var(--muted)" }}>{topography.location}</span>
            </div>
          </div>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            <div>
              <strong>Ort:</strong> {topography.location}
            </div>
            <div>
              <strong>Methode:</strong> {topography.method}
            </div>
            <div>
              <strong>Tarnung:</strong> {topography.concealment}
            </div>
            <div>
              <strong>Abholsignal:</strong> {topography.retrievalSignal}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export default EspionageTradecraftEngineModal;
