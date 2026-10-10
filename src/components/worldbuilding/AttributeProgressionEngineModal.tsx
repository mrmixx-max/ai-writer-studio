// AttributeProgressionEngineModal (WP 134.1 UI / Meilenstein 65.0, v7.7.0)
import { useState, useMemo } from "react";
import {
  ATTRIBUTE_DEFS,
  TIERS,
  scaleAttribute,
  generateProgressionTable,
  getTierForLevel,
  getNextTier,
  getPhysicsEquivalent,
  analyzePowerCreep,
  compareCurves,
  type AttributeId,
  type ScalingCurve,
} from "@/services/worldbuilding/attributeProgressionEngine";

export interface AttributeProgressionEngineModalProps {
  className?: string;
}

const CURVE_LABELS: Record<ScalingCurve, string> = {
  linear: "Linear",
  exponential: "Exponentiell",
  logarithmic: "Logarithmisch (Soft-Cap)",
};

export function AttributeProgressionEngineModal({ className }: AttributeProgressionEngineModalProps) {
  const [attrId, setAttrId] = useState<AttributeId>("strength");
  const [curve, setCurve] = useState<ScalingCurve>("linear");
  const [level, setLevel] = useState(50);
  const [maxLevel, setMaxLevel] = useState(100);

  const attr = useMemo(() => ATTRIBUTE_DEFS.find((a) => a.id === attrId) ?? ATTRIBUTE_DEFS[0], [attrId]);

  const progression = useMemo(() => scaleAttribute(attr.baseValue, attr.growthRate, level, curve), [attr, level, curve]);
  const tier = useMemo(() => getTierForLevel(level), [level]);
  const nextTier = useMemo(() => getNextTier(level), [level]);
  const physics = useMemo(() => getPhysicsEquivalent(attrId, progression.value), [attrId, progression]);
  const creep = useMemo(() => analyzePowerCreep(attr.baseValue, attr.growthRate, curve), [attr, curve]);
  const table = useMemo(() => generateProgressionTable(attr.baseValue, attr.growthRate, maxLevel, curve), [attr, maxLevel, curve]);
  const comparison = useMemo(() => compareCurves(attr.baseValue, attr.growthRate, level), [attr, level]);

  const selectStyle: React.CSSProperties = {
    width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11,
    fontFamily: "var(--font-mono)", background: "var(--bg)", color: "var(--fg)",
    border: "1px solid var(--border)", borderRadius: 4,
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 };
  const panelStyle: React.CSSProperties = {
    padding: 10, border: "1px solid var(--border)", borderRadius: 4,
    background: "var(--bg)", fontSize: 11, lineHeight: 1.7,
  };

  return (
    <div
      className={className}
      data-testid="attribute-progression-modal"
      style={{
        background: "var(--bg)", color: "var(--fg)", padding: 16,
        height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚔️ Attributs-Skalierungs- & Stufen-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {attr.name} · Level {level} · {tier.name} · {CURVE_LABELS[curve]}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={labelStyle}>
          Attribut
          <select value={attrId} onChange={(e) => setAttrId(e.target.value as AttributeId)} style={selectStyle}>
            {ATTRIBUTE_DEFS.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.short})</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Skalierungskurve
          <select value={curve} onChange={(e) => setCurve(e.target.value as ScalingCurve)} style={selectStyle}>
            <option value="linear">Linear</option>
            <option value="exponential">Exponentiell</option>
            <option value="logarithmic">Logarithmisch (Soft-Cap)</option>
          </select>
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Level: {level}
          <input type="range" min={1} max={100} value={level} onChange={(e) => setLevel(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Max Level: {maxLevel}
          <input type="range" min={10} max={100} value={maxLevel} onChange={(e) => setMaxLevel(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
      </div>

      {/* Progression Table */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 PROGRESSIONSTABELLE
        </summary>
        <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto", ...panelStyle }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "var(--muted)" }}>
                <th style={{ textAlign: "left", padding: "2px 8px" }}>Level</th>
                <th style={{ textAlign: "right", padding: "2px 8px" }}>Wert</th>
                <th style={{ textAlign: "right", padding: "2px 8px" }}>Δ</th>
                <th style={{ textAlign: "right", padding: "2px 8px" }}>%↑</th>
                <th style={{ textAlign: "left", padding: "2px 8px" }}>Rang</th>
              </tr>
            </thead>
            <tbody>
              {table.filter((_, i) => i % Math.ceil(table.length / 25) === 0 || i === table.length - 1).map((row) => (
                <tr key={row.level} style={{ color: row.level === level ? "var(--accent)" : "var(--fg)" }}>
                  <td style={{ padding: "2px 8px", fontWeight: row.level === level ? 700 : 400 }}>{row.level}</td>
                  <td style={{ padding: "2px 8px", textAlign: "right" }}>{row.value}</td>
                  <td style={{ padding: "2px 8px", textAlign: "right", color: "var(--muted)" }}>+{row.delta}</td>
                  <td style={{ padding: "2px 8px", textAlign: "right", color: "var(--muted)" }}>{row.percentIncrease}%</td>
                  <td style={{ padding: "2px 8px" }}>{getTierForLevel(row.level).name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Current Value */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📈 AKTUELLER WERT
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
            {attr.name}: {progression.value}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Rang:</strong> {tier.name} (Level {tier.minLevel}–{tier.maxLevel})
          </div>
          {nextTier && (
            <div style={{ marginTop: 4, color: "var(--muted)" }}>
              Nächster Rang: {nextTier.name} (ab Level {nextTier.minLevel})
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <strong>Physik-Äquivalent:</strong> {physics.description}
          </div>
          <div style={{ marginTop: 4, color: "var(--muted)" }}>
            {physics.realWorldComparison}
          </div>
        </div>
      </details>

      {/* Curve Comparison */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔄 KURVEN-VERGLEICH
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div>Werte bei Level {level}:</div>
          <div style={{ marginTop: 4, display: "flex", gap: 16 }}>
            <div>Linear: <strong>{comparison.linear}</strong></div>
            <div>Exponentiell: <strong>{comparison.exponential}</strong></div>
            <div>Logarithmisch: <strong>{comparison.logarithmic}</strong></div>
          </div>
        </div>
      </details>

      {/* Power Creep */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚠️ POWER-CREEP-ANALYSE
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div>Kurve: {CURVE_LABELS[curve]}</div>
          <div style={{ marginTop: 4 }}>
            Level 10: {creep.level10} · Level 50: {creep.level50} · Level 100: {creep.level100}
          </div>
          <div style={{ marginTop: 4 }}>
            Verhältnis L10→L100: {creep.ratio10to100}x
          </div>
          <div style={{ marginTop: 4, fontWeight: 700, color: creep.verdict === "severe" ? "var(--accent)" : "var(--fg)" }}>
            {creep.verdict === "balanced" ? "✅ Ausgewogen" : creep.verdict === "moderate" ? "⚠️ Moderates Power Creep" : "🚨 Kritisches Power Creep"}
          </div>
          <div style={{ marginTop: 4, color: "var(--muted)" }}>{creep.recommendation}</div>
        </div>
      </details>

      {/* Tier Overview */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🏆 RANGSTUFEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {TIERS.map((t) => (
            <div key={t.id} style={{ ...panelStyle, borderColor: t.id === tier.id ? "var(--accent)" : "var(--border)" }}>
              <div style={{ fontWeight: 700, color: t.color }}>{t.name}</div>
              <div style={{ color: "var(--muted)" }}>Level {t.minLevel}–{t.maxLevel}</div>
              <div style={{ color: "var(--muted)" }}>{t.description}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default AttributeProgressionEngineModal;
