// HauntedArchitectureEngineModal (WP 116.1 UI, Meilenstein 56.0 / v6.8.0)
// Spukhaus-Topografie & Haus-als-Organismus — gothic horror UI surface.
import { useState, useMemo } from "react";
import {
  HAUNTED_ROOM_ZONES,
  getHauntedZone,
  detectArchitecturalAnomalies,
  generateDecayProse,
  createSampleHauntedZone,
  createSampleAnomalies,
  type HauntedZoneId,
} from "@/services/worldbuilding/hauntedArchitectureEngine";

export interface HauntedArchitectureEngineModalProps {
  className?: string;
}

export function HauntedArchitectureEngineModal({ className }: HauntedArchitectureEngineModalProps) {
  const [seed, setSeed] = useState(42);
  const [zoneId, setZoneId] = useState<HauntedZoneId>(() => createSampleHauntedZone().id);

  const zone = useMemo(() => getHauntedZone(zoneId), [zoneId]);
  const anomaly = useMemo(() => detectArchitecturalAnomalies(zoneId, seed), [zoneId, seed]);
  const decay = useMemo(() => generateDecayProse(zoneId, seed), [zoneId, seed]);
  const sample = useMemo(() => createSampleAnomalies(), []);

  const severityColor = (s: string) =>
    s === "extreme" ? "var(--error)" : s === "high" ? "var(--warn)" : s === "medium" ? "var(--accent)" : "var(--success)";

  return (
    <div
      className={className}
      data-testid="haunted-architecture-modal"
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
        🏚️ Spukhaus-Topografie &amp; Haus-als-Organismus
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {HAUNTED_ROOM_ZONES.length} gotische Raumzonen · Anomalie-Schwere: {anomaly.severity} · Referenz: {sample.anomalies.length} Muster-Anomalien
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 200, flex: "1 1 200px" }}>
          Raumzone
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value as HauntedZoneId)}
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
            {HAUNTED_ROOM_ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
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

      {zone && (
        <details style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🩸 {zone.name} — Gefahrenstufe {zone.dangerLevel}/10
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
              <div>{zone.description}</div>
              <div style={{ marginTop: 6, fontStyle: "italic", color: "var(--muted)" }}>{zone.atmosphere}</div>
              <div style={{ marginTop: 6 }}>
                <strong>Gefahrenstufe:</strong>{" "}
                <span style={{ color: severityColor(zone.dangerLevel >= 9 ? "extreme" : zone.dangerLevel >= 7 ? "high" : "medium") }}>
                  {zone.dangerLevel} / 10
                </span>
              </div>
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>MERKMALE</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
                {zone.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📐 GEOMETRIE-ANOMALIE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: 8, border: `1px solid ${severityColor(anomaly.severity)}`, borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: severityColor(anomaly.severity), fontWeight: 700 }}>Schwere: {anomaly.severity}</span>
              <span style={{ color: "var(--muted)" }}>{anomaly.anomalies.length} Anomalien</span>
            </div>
            <div style={{ marginTop: 4 }}>{anomaly.description}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {anomaly.anomalies.map((a, i) => (
              <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 10, lineHeight: 1.6 }}>
                {a}
              </div>
            ))}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🕯️ VERFALLS-PROSA
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ fontStyle: "italic" }}>{decay}</div>
        </div>
      </details>
    </div>
  );
}

export default HauntedArchitectureEngineModal;
