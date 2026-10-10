// NauticalNavalSimulatorModal (WP 108.1 UI)
import { useState, useMemo } from "react";
import {
  calculateSailing,
  fireBroadside,
  generateBattlePassage,
  simulateEngagement,
  POINTS_OF_SAIL,
  RIGS,
  AMMO_TYPES,
  type RigId,
  type AmmoTypeId,
} from "@/services/worldbuilding/nauticalNavalSimulator";

export interface NauticalNavalSimulatorModalProps {
  className?: string;
}

export function NauticalNavalSimulatorModal({ className }: NauticalNavalSimulatorModalProps) {
  const [rig, setRig] = useState<RigId>("frigate");
  const [ammo, setAmmo] = useState<AmmoTypeId>("roundShot");
  const [windAngle, setWindAngle] = useState(90);
  const [windSpeed, setWindSpeed] = useState(18);
  const [distance, setDistance] = useState(400);
  const [seed] = useState(42);

  const sailing = useMemo(() => calculateSailing(rig, windAngle, windSpeed), [rig, windAngle, windSpeed]);
  const broadside = useMemo(() => fireBroadside(rig, ammo, distance, seed), [rig, ammo, distance, seed]);
  const passage = useMemo(() => generateBattlePassage(3, seed), [seed]);
  const engagement = useMemo(() => simulateEngagement(rig, "brig", ammo, distance, windSpeed, seed), [rig, ammo, distance, windSpeed, seed]);

  return (
    <div
      className={className}
      data-testid="nautical-naval-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚓ Segelschiff-Physik &amp; Seeschlachten-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {sailing.rig.name} · {sailing.pointOfSail.name} · {sailing.speedKnots} kn
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Schiffstyp
          <select
            value={rig}
            onChange={(e) => setRig(e.target.value as RigId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {RIGS.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.gunsPerBroadside} Geschütze)</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Munition
          <select
            value={ammo}
            onChange={(e) => setAmmo(e.target.value as AmmoTypeId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {AMMO_TYPES.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Windwinkel
          <input
            type="number"
            min={0}
            max={180}
            value={windAngle}
            onChange={(e) => setWindAngle(Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Wind (kn)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Distanz (m)
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌬️ WINDROSEN- &amp; SEGEL-PHYSIK
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Kurs:</strong> {sailing.pointOfSail.name} ({sailing.pointOfSail.angleDegrees}°)</div>
          <div><strong>Fahrt:</strong> {sailing.speedKnots} kn ({sailing.speedKmh} km/h) — Rumpfgeschwindigkeit {sailing.rig.hullSpeedKnots} kn</div>
          <div><strong>Krängung:</strong> {sailing.heelDegrees}° · <strong>Abdrift:</strong> {sailing.leewayDegrees}° nach Lee</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sailing.pointOfSail.description}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Takelage: {sailing.rig.sails.join(", ")}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💥 BREITSEITEN-BALLISTIK
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ fontWeight: 700, color: "var(--accent)" }}>{broadside.ammo.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{broadside.ammo.description}</div>
            <div style={{ marginTop: 4 }}>
              Rumpf {broadside.hullDamagePercent}% · Takelage {broadside.riggingDamagePercent}% · {broadside.crewCasualties} Gefallene
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              Reichweitenfaktor {broadside.rangeEffect} (effektiv bis {broadside.ammo.effectiveRangeMeters} m)
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>{broadside.summary}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚔️ SEEGEFECHT — VORTEIL: {engagement.advantage.toUpperCase()}
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div>Angreifer: {engagement.attacker.rig.name} mit {engagement.attacker.speedKnots} kn</div>
          <div>Verteidiger: {engagement.defender.rig.name} mit {engagement.defender.speedKnots} kn</div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 SEESCHLACHTEN-PROSA
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.7 }}>
          {passage.text}
        </pre>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Kurse: {POINTS_OF_SAIL.map((p) => p.name).join(" · ")}
        </div>
      </details>
    </div>
  );
}
