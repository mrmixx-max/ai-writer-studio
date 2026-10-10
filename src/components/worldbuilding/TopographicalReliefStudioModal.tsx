// TopographicalReliefStudioModal (WP 104.2 UI)
import { useState, useMemo } from "react";
import {
  analyzeRelief,
  generateReliefMap,
  calculateSlope,
  analyzeSightLine,
  calculateFatigue,
  ELEVATION_BANDS,
  PARTY_PROFILES,
  type PartyProfile,
} from "@/services/worldbuilding/topographicalReliefStudio";

export interface TopographicalReliefStudioModalProps {
  className?: string;
}

export function TopographicalReliefStudioModal({ className }: TopographicalReliefStudioModalProps) {
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(6);
  const [seed, setSeed] = useState(42);
  const [party, setParty] = useState<PartyProfile>(PARTY_PROFILES[1]);

  const map = useMemo(() => generateReliefMap(width, height, seed), [width, height, seed]);
  const report = useMemo(() => analyzeRelief(map), [map]);

  const slope = useMemo(
    () => calculateSlope(map, { x: 0, y: 0 }, { x: Math.max(0, width - 1), y: Math.max(0, height - 1) }),
    [map, width, height]
  );
  const sightLine = useMemo(
    () => analyzeSightLine(map, { x: 0, y: 0 }, { x: Math.max(0, width - 1), y: Math.max(0, height - 1) }),
    [map, width, height]
  );
  const fatigue = useMemo(
    () => calculateFatigue(party, Math.max(0, map.maxMeters - map.minMeters), map.maxMeters),
    [party, map]
  );

  const bandColor = (elevation: number) => {
    const ratio = map.maxMeters > 0 ? elevation / map.maxMeters : 0;
    return `color-mix(in srgb, var(--accent) ${Math.round(ratio * 85)}%, var(--panel))`;
  };

  return (
    <div
      className={className}
      data-testid="relief-studio-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⛰️ Topografisches Höhenschichten- &amp; Relief-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Karte {map.id} · {map.width}×{map.height} · {map.minMeters} m bis {map.maxMeters} m
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 70 }}>
          Breite
          <input
            type="number"
            min={1}
            max={16}
            value={width}
            onChange={(e) => setWidth(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 70 }}>
          Höhe
          <input
            type="number"
            min={1}
            max={16}
            value={height}
            onChange={(e) => setHeight(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
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
          🗺️ HYPSOMETRISCHE RELIEFKARTE
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${map.width}, 1fr)`, gap: 2 }}>
            {map.cells.map((cell) => (
              <div
                key={`${cell.x}-${cell.y}`}
                title={`(${cell.x},${cell.y}) ${cell.elevationMeters} m · ${cell.band}`}
                style={{ height: 20, borderRadius: 2, background: bandColor(cell.elevationMeters), border: "1px solid var(--border)", fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg)" }}
              >
                {cell.elevationMeters}
              </div>
            ))}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 HÖHENSTUFEN-VERTEILUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {report.bandCounts.map((bc) => {
            const band = ELEVATION_BANDS.find((b) => b.id === bc.band);
            return (
              <div key={bc.band} style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
                <span>{band?.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{bc.count} Felder · {band?.minMeters}–{band?.maxMeters} m</span>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Höchste Stufe: {report.highestBand.name} · {report.gradientSummary}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👁️ TAKTISCHE SICHTACHSEN-ANALYSE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: `1px solid ${sightLine.visible ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ fontWeight: 700, color: sightLine.visible ? "var(--success)" : "var(--error)" }}>
              {sightLine.visible ? "✓ Freie Sichtachse" : "✗ Verdeckt"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sightLine.reason}</div>
            {sightLine.deadAngleAt && (
              <div style={{ fontSize: 10, marginTop: 2 }}>Toter Winkel bei ({sightLine.deadAngleAt.x}, {sightLine.deadAngleAt.y})</div>
            )}
          </div>
          {slope && (
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div>Gefälle Diagonale: {slope.gradientPercent}% ({slope.classification})</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                Höhenunterschied {slope.riseMeters} m über {slope.horizontalUnits} Felder
              </div>
            </div>
          )}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🥾 HÖHENMETER-ERSCHÖPFUNGS-KALKULATOR
        </summary>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Gruppe
            <select
              value={party.id}
              onChange={(e) => setParty(PARTY_PROFILES.find((p) => p.id === e.target.value) || PARTY_PROFILES[0])}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
            >
              {PARTY_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.members} Pers.)</option>
              ))}
            </select>
          </label>
          <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
            <div><strong>Aufstieg:</strong> {fatigue.climbMeters} m · {fatigue.hoursNeeded} h</div>
            <div><strong>Kalorien/Person:</strong> {fatigue.caloriesPerPerson} kcal</div>
            <div>
              <strong>Höhenkrankheitsrisiko:</strong>{" "}
              <span style={{ color: fatigue.altitudeSicknessRisk >= 60 ? "var(--error)" : fatigue.altitudeSicknessRisk >= 30 ? "var(--warn)" : "var(--success)", fontWeight: 700 }}>
                {fatigue.altitudeSicknessRisk}%
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>{fatigue.verdict}</div>
          </div>
        </div>
      </details>
    </div>
  );
}
