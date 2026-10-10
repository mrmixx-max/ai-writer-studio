// SubterraneanSpeleologyEngineModal (WP 106.2 UI)
import { useState, useMemo } from "react";
import {
  analyzeCaveSystem,
  CAVE_ZONES,
  type CaveZoneId,
} from "@/services/worldbuilding/subterraneanSpeleologyEngine";

export interface SubterraneanSpeleologyEngineModalProps {
  className?: string;
}

export function SubterraneanSpeleologyEngineModal({ className }: SubterraneanSpeleologyEngineModalProps) {
  const [seed, setSeed] = useState(42);
  const [selected, setSelected] = useState<CaveZoneId[]>(CAVE_ZONES.map((z) => z.id));

  const report = useMemo(() => analyzeCaveSystem(selected, seed), [selected, seed]);

  function toggle(id: CaveZoneId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const severityColor = (s: "ok" | "warn" | "critical") =>
    s === "critical" ? "var(--error)" : s === "warn" ? "var(--warn)" : "var(--success)";

  return (
    <div
      className={className}
      data-testid="speleology-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🕳️ Unterirdischer Höhlen- &amp; Speleologie-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        System {report.id} · {report.surveys.length} Zonen · {report.criticalCount} kritische Befunde · tiefste Zone: {report.deepestZone.name}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⛏️ UNTERTAGE-ZONEN ({selected.length} aktiv)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CAVE_ZONES.map((z) => {
            const active = selected.includes(z.id);
            return (
              <button
                key={z.id}
                onClick={() => toggle(z.id)}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  borderRadius: 4,
                  background: active ? "var(--accent)" : "var(--panel)",
                  color: active ? "var(--bg)" : "var(--fg)",
                  border: "1px solid var(--border)",
                }}
              >
                {z.name} ({z.depthMeters} m)
              </button>
            );
          })}
        </div>
      </details>

      {report.surveys.map((s) => (
        <details key={s.id} style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            {s.survivable ? "✓" : "✗"} {s.zone.name} — {s.zone.depthMeters} m
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
              <div><strong>Temperatur:</strong> {s.zone.temperatureC} °C · <strong>Sauerstoff:</strong> {s.oxygenPercent} % · <strong>Stabilität:</strong> {s.stability}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Gefahren: {s.zone.hazards.join(", ")}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {s.hazards.map((h, i) => (
                <div key={i} style={{ padding: 6, border: `1px solid ${severityColor(h.severity)}`, borderRadius: 4, background: "var(--panel)", fontSize: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: severityColor(h.severity), fontWeight: 700 }}>{h.kind}</span>
                    <span style={{ color: "var(--muted)" }}>{h.value} / {h.threshold}</span>
                  </div>
                  <div style={{ marginTop: 2 }}>{h.message}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>FINSTERNIS-PROSA</div>
              <div style={{ fontStyle: "italic" }}>{s.darknessPassage.text}</div>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
