// ToponymicEtymologyEngineModal (WP 132.1 UI, Meilenstein 64.0 / v7.6.0)
import { useState, useMemo, type CSSProperties } from "react";
import {
  LANGUAGE_STRATA,
  TERRAIN_MORPHEMES,
  buildPlaceName,
  simulateSoundShift,
  buildLayeredToponym,
} from "@/services/worldbuilding/toponymicEtymologyEngine";

export interface ToponymicEtymologyEngineModalProps {
  className?: string;
}

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};

const sectionStyle: CSSProperties = {
  marginBottom: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--panel)",
  padding: 8,
};

const summaryStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 700,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  flex: 1,
  minWidth: 120,
};

export function ToponymicEtymologyEngineModal({ className }: ToponymicEtymologyEngineModalProps) {
  const [seed, setSeed] = useState(42);
  const [stratumId, setStratumId] = useState<string>(LANGUAGE_STRATA[0].id);
  const [terrainId, setTerrainId] = useState<string>(TERRAIN_MORPHEMES[0].id);
  const [root, setRoot] = useState("Ald");
  const [sourceName, setSourceName] = useState("Aqua Alta");
  const [years, setYears] = useState(500);

  const placeName = useMemo(
    () => buildPlaceName({ stratumId, terrainId, root }, seed),
    [stratumId, terrainId, root, seed],
  );

  const soundShift = useMemo(
    () => simulateSoundShift({ sourceName, years, stratumId }, seed),
    [sourceName, years, stratumId, seed],
  );

  const layeredStrata = useMemo(() => {
    const others = LANGUAGE_STRATA.map((s) => s.id).filter((id) => id !== stratumId);
    return [stratumId, ...others.slice(0, 2)];
  }, [stratumId]);

  const layered = useMemo(
    () => buildLayeredToponym({ baseName: sourceName, strataIds: layeredStrata }, seed),
    [sourceName, layeredStrata, seed],
  );

  return (
    <div
      className={className}
      data-testid="toponymic-etymology-modal"
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
        🗺️ Toponymische Ortsnamen- &amp; Schichten-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Sprachstämme: {LANGUAGE_STRATA.length} · Landschaftsformen: {TERRAIN_MORPHEMES.length}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...labelStyle, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Sprachstamm
          <select value={stratumId} onChange={(e) => setStratumId(e.target.value)} style={inputStyle}>
            {LANGUAGE_STRATA.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Landschaftsform
          <select value={terrainId} onChange={(e) => setTerrainId(e.target.value)} style={inputStyle}>
            {TERRAIN_MORPHEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Wurzel
          <input value={root} onChange={(e) => setRoot(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Quellname
          <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Jahre
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <details style={sectionStyle} open>
        <summary style={summaryStyle}>SPRACHSTÄMME ({LANGUAGE_STRATA.length})</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {LANGUAGE_STRATA.map((s) => (
            <div key={s.id} style={{ fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: 6 }}>
              <div style={{ color: "var(--accent)" }}>
                <strong>{s.name}</strong> · Beispiel: {s.exampleName}
              </div>
              <div style={{ color: "var(--muted)" }}>{s.description}</div>
              <div style={{ marginTop: 4 }}>Präfixe: {s.prefixes.join(", ")}</div>
              <div>Suffixe: {s.suffixes.join(", ")}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={sectionStyle} open>
        <summary style={summaryStyle}>LANDSCHAFTS-KOMPOSITA ({TERRAIN_MORPHEMES.length})</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {TERRAIN_MORPHEMES.map((t) => (
            <div key={t.id} style={{ fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: 6 }}>
              <div style={{ color: "var(--accent)" }}>
                <strong>{t.name}</strong>
              </div>
              <div style={{ color: "var(--muted)" }}>{t.description}</div>
              <div style={{ marginTop: 4 }}>Morpheme: {t.morphemes.join(", ")}</div>
              <div>Bedeutung: {t.meaning}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={sectionStyle} open>
        <summary style={summaryStyle}>ORTSNAME</summary>
        <div style={{ marginTop: 8, fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 14, color: "var(--accent)", marginBottom: 4 }}>
            <strong>{placeName.name}</strong>
          </div>
          <div>Sprachstamm: {placeName.stratum}</div>
          <div>Landschaftsform: {placeName.terrain}</div>
          <div>Morpheme: {placeName.morphemes.join(" + ")}</div>
          <div>Bedeutung: {placeName.meaning}</div>
          <div style={{ marginTop: 6, color: "var(--muted)" }}>
            {placeName.layers.map((layer, i) => (
              <div key={i}>• {layer}</div>
            ))}
          </div>
        </div>
      </details>

      <details style={sectionStyle} open>
        <summary style={summaryStyle}>LAUTVERSCHIEBUNG</summary>
        <div style={{ marginTop: 8, fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>{soundShift.description}</div>
          <div>
            <strong>{soundShift.original}</strong> → <strong style={{ color: "var(--accent)" }}>{soundShift.final}</strong>
          </div>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {soundShift.steps.map((step, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 6 }}>
                <div>
                  <strong>Jahr {step.year}</strong> · {step.form}
                </div>
                <div style={{ color: "var(--muted)" }}>Regel: {step.rule}</div>
              </div>
            ))}
            {soundShift.steps.length === 0 && (
              <div style={{ color: "var(--muted)" }}>Keine Zeitstufen — Name bleibt unverändert.</div>
            )}
          </div>
        </div>
      </details>

      <details style={sectionStyle} open>
        <summary style={summaryStyle}>GESCHICHTETE SCHICHTEN</summary>
        <div style={{ marginTop: 8, fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 14, color: "var(--accent)", marginBottom: 4 }}>
            <strong>{layered.finalName}</strong>
          </div>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>{layered.description}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {layered.layers.map((layer, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 6 }}>
                <div>
                  <strong>{layer.stratum}</strong> · {layer.era}
                </div>
                <div style={{ color: "var(--muted)" }}>Beitrag: {layer.contribution}</div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
