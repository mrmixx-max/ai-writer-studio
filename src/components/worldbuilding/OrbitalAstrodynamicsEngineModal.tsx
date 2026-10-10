// OrbitalAstrodynamicsEngineModal (WP 112.1 UI)
import { useState, useMemo } from "react";
import {
  calculateFlight,
  radioDelayMinutes,
  generateCockpitLog,
  createFlightPlan,
  CELESTIAL_BODIES,
  type CelestialBodyId,
  type FlightProfileId,
} from "@/services/worldbuilding/orbitalAstrodynamicsEngine";

export interface OrbitalAstrodynamicsEngineModalProps {
  className?: string;
}

export function OrbitalAstrodynamicsEngineModal({ className }: OrbitalAstrodynamicsEngineModalProps) {
  const [from, setFrom] = useState<CelestialBodyId>("earth");
  const [to, setTo] = useState<CelestialBodyId>("mars");
  const [profile, setProfile] = useState<FlightProfileId>("brachistochrone");
  const [payload, setPayload] = useState(10);
  const [seed, setSeed] = useState(42);

  const flight = useMemo(() => calculateFlight(from, to, profile, payload), [from, to, profile, payload]);
  const delay = useMemo(() => radioDelayMinutes(from, to), [from, to]);
  const log = useMemo(() => generateCockpitLog(5, seed), [seed]);
  const plan = useMemo(() => createFlightPlan(from, to, profile, payload, seed), [from, to, profile, payload, seed]);

  return (
    <div
      className={className}
      data-testid="orbital-astrodynamics-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🚀 Orbital-Astrodynamik &amp; Raumflug-Rechner
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {plan.from.name} → {plan.to.name} · {flight.name} · {flight.flightTimeHours} h
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Von
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as CelestialBodyId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {CELESTIAL_BODIES.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Nach
          <select
            value={to}
            onChange={(e) => setTo(e.target.value as CelestialBodyId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {CELESTIAL_BODIES.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Flugprofil
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value as FlightProfileId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            <option value="brachistochrone">Brachistochron (1G)</option>
            <option value="hohmann">Hohmann-Transfer</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Nutzlast (t)
          <input
            type="number"
            min={1}
            max={1000}
            value={payload}
            onChange={(e) => setPayload(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
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
          📡 LICHTGESCHWINDIGKEITS-FUNKVERZÖGERUNG
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Einweg:</strong> {delay} Minuten</div>
          <div><strong>Zweiweg:</strong> {Math.round(delay * 2 * 100) / 100} Minuten</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Lichtgeschwindigkeit: 299.792 km/s — keine Kommunikation ist schneller.
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛰️ FLUGBAHN-RECHNER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Profil:</strong> {flight.name}</div>
          <div><strong>Delta-v:</strong> {flight.deltaV} km/s</div>
          <div><strong>Flugzeit:</strong> {flight.flightTimeHours} Stunden</div>
          <div><strong>Treibstoff:</strong> {flight.fuelTons} Tonnen</div>
          <div><strong>Künstliche Schwerkraft:</strong> {flight.artificialGravity > 0 ? "1G (ja)" : "Nein"}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{flight.description}</div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📟 COCKPIT-LOGBUCH
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {log.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: 6,
                border: `1px solid ${entry.type === "critical" ? "var(--error)" : entry.type === "warning" ? "var(--warning)" : "var(--border)"}`,
                borderRadius: 4,
                background: "var(--panel)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: entry.type === "critical" ? "var(--error)" : entry.type === "warning" ? "var(--warning)" : "var(--accent)", fontWeight: 700 }}>
                  {entry.type.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: "var(--muted)" }}>{entry.timestamp}</span>
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>{entry.message}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
