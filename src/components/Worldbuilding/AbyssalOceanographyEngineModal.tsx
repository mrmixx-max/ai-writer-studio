// AbyssalOceanographyEngineModal (WP 109.1 UI)
import { useState, useMemo } from "react";
import {
  readDepth,
  analyzeOceanProfile,
  generateAbyssalPassage,
  generateBioluminescenceSpectrum,
  PELAGIC_ZONES,
  BIOLUMINESCENT_ORGANISMS,
} from "@/services/worldbuilding/abyssalOceanographyEngine";

export interface AbyssalOceanographyEngineModalProps {
  className?: string;
}

export function AbyssalOceanographyEngineModal({ className }: AbyssalOceanographyEngineModalProps) {
  const [depth, setDepth] = useState(4000);
  const [seed, setSeed] = useState(42);

  const reading = useMemo(() => readDepth(depth), [depth]);
  const passage = useMemo(() => generateAbyssalPassage(depth, 3, seed), [depth, seed]);
  const spectrum = useMemo(() => generateBioluminescenceSpectrum(reading.zone.id, seed), [reading.zone.id, seed]);
  const profile = useMemo(() => analyzeOceanProfile([50, 400, 2000, 5000, 8000], seed), [seed]);

  return (
    <div
      className={className}
      data-testid="abyssal-oceanography-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌊 Tiefsee-Ozeanografie &amp; Abyssale Zonen
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {reading.zone.name} · {depth} m · {reading.pressureBar} Bar · {reading.temperatureC} °C
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Wassertiefe (m)
          <input
            type="number"
            min={0}
            max={11000}
            value={depth}
            onChange={(e) => setDepth(Math.max(0, Math.min(11000, Number(e.target.value) || 0)))}
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
          📏 TIEFENMESSUNG
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Zone:</strong> {reading.zone.name}</div>
          <div><strong>Hydrostatischer Druck:</strong> {reading.pressureBar} Bar</div>
          <div><strong>Restlicht:</strong> {reading.lightPercent} % der Oberflächenhelligkeit</div>
          <div><strong>Temperatur:</strong> {reading.temperatureC} °C</div>
          <div style={{ marginTop: 4, color: reading.lethalWithoutHull ? "var(--error)" : "var(--success)", fontWeight: 700 }}>
            {reading.lethalWithoutHull ? "✗ Ohne Druckkörper tödlich" : "✓ Ohne Druckkörper überlebbar"}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{reading.zone.description}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 PELAGIALE TIEFENSTUFEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {PELAGIC_ZONES.map((z) => (
            <div
              key={z.id}
              style={{
                padding: 6,
                border: `1px solid ${z.id === reading.zone.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                background: "var(--panel)",
                fontWeight: z.id === reading.zone.id ? 700 : 400,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{z.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{z.minDepthMeters}–{z.maxDepthMeters} m · {z.temperatureC} °C</span>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✨ BIOLUMINESZENZ-SPEKTRUM
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {spectrum.organisms.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--muted)", padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              {spectrum.description}
            </div>
          )}
          {spectrum.organisms.map((o, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{o.name}</strong>
                <span style={{ color: "var(--accent)", fontSize: 10 }}>{o.wavelengthNm} nm</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{o.colorName} · {o.mechanism}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 KLAUSTROPHOBISCHE TIEFSEE-PROSA
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.7 }}>
          {passage.text}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗺️ OZEAN-PROFIL ({profile.readings.length} Messungen)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {profile.readings.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <span>{r.depthMeters} m — {r.zone.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>{r.pressureBar} Bar</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Tiefste Zone: {profile.deepestZone.name} · Maximaldruck {profile.maxPressureBar} Bar · {BIOLUMINESCENT_ORGANISMS.length} Leuchtarten gesamt
          </div>
        </div>
      </details>
    </div>
  );
}
