// PlanetaryClimateEngineModal (WP 82.2)
//
// Interaktiver planetarer Klima- & Jahreszeiten-Simulator.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateClimateReport,
  formatClimateReport,
  type PlanetParams,
} from "@/services/worldbuilding/planetaryClimateEngine";

export interface PlanetaryClimateEngineModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function PlanetaryClimateEngineModal({ className }: PlanetaryClimateEngineModalProps) {
  const [planetName, setPlanetName] = useState("Aetherie");
  const [dayLength, setDayLength] = useState(24);
  const [yearLength, setYearLength] = useState(365);
  const [axialTilt, setAxialTilt] = useState(23);
  const [moonCount, setMoonCount] = useState(2);
  const [eccentricity, setEccentricity] = useState(0.1);

  const params: PlanetParams = useMemo(
    () => ({
      dayLengthHours: dayLength,
      yearLengthDays: yearLength,
      axialTiltDeg: axialTilt,
      moonCount,
      orbitalEccentricity: eccentricity,
    }),
    [dayLength, yearLength, axialTilt, moonCount, eccentricity],
  );

  const report = useMemo(() => generateClimateReport(planetName, params), [planetName, params]);

  return (
    <div
      className={className}
      data-testid="planetary-climate-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🪐 Planetarer Klima- & Jahreszeiten-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {report.planetName} · {report.zones.length} Zonen · {report.seasons.length} Jahreszeiten
      </div>

      {/* Parameter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Planet
          <input
            data-testid="climate-name-input"
            value={planetName}
            onChange={(e) => setPlanetName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Tageslänge (h)
          <input
            data-testid="climate-day-input"
            type="number"
            value={dayLength}
            onChange={(e) => setDayLength(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Jahreslänge (Tage)
          <input
            data-testid="climate-year-input"
            type="number"
            value={yearLength}
            onChange={(e) => setYearLength(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Achsenneigung (°)
          <input
            data-testid="climate-tilt-input"
            type="number"
            value={axialTilt}
            onChange={(e) => setAxialTilt(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Monde
          <input
            data-testid="climate-moon-input"
            type="number"
            value={moonCount}
            onChange={(e) => setMoonCount(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Exzentrizität
          <input
            data-testid="climate-ecc-input"
            type="number"
            step="0.01"
            value={eccentricity}
            onChange={(e) => setEccentricity(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Klimazonen */}
      <div
        data-testid="climate-zones"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>KLIMAZONEN</div>
        {report.zones.map((zone, i) => (
          <div key={i} data-testid={`climate-zone-${i}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {zone.name}: {zone.minTempC}°C bis {zone.maxTempC}°C
          </div>
        ))}
      </div>

      {/* Jahreszeiten */}
      <div
        data-testid="climate-seasons"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>JAHRESZEITEN</div>
        {report.seasons.map((season, i) => (
          <div key={i} data-testid={`climate-season-${i}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {season.name}: Tag {season.startDay}-{season.endDay}, Ø {season.avgTempC}°C
          </div>
        ))}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="climate-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="climate-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatClimateReport(report)}
        </pre>
      </details>
    </div>
  );
}
