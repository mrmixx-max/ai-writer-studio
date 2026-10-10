// SkillTreeMatrixModal (WP 134.2 UI / Meilenstein 65.0, v7.7.0)
import { useState, useMemo } from "react";
import {
  SKILL_TREES,
  CLASS_EVOLUTIONS,
  validateSkillPath,
  calculateOptimalPath,
  generateSkillTreeSVG,
  type SkillNode,
} from "@/services/worldbuilding/skillTreeMatrix";

export interface SkillTreeMatrixModalProps {
  className?: string;
}

export function SkillTreeMatrixModal({ className }: SkillTreeMatrixModalProps) {
  const [treeId, setTreeId] = useState("pyromancer");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [targetSkill, setTargetSkill] = useState<string>("");

  const tree = useMemo(() => SKILL_TREES.find((t) => t.id === treeId) ?? SKILL_TREES[0], [treeId]);
  const validation = useMemo(() => validateSkillPath(treeId, selectedSkills), [treeId, selectedSkills]);
  const svg = useMemo(() => generateSkillTreeSVG(treeId), [treeId]);
  const path = useMemo(() => {
    if (!targetSkill) return null;
    try { return calculateOptimalPath(treeId, targetSkill); } catch { return null; }
  }, [treeId, targetSkill]);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

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
      data-testid="skill-tree-matrix-modal"
      style={{
        background: "var(--bg)", color: "var(--fg)", padding: 16,
        height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌳 Skill-Tree- & Klassen-Evolutions-Architekt
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {tree.name} · {selectedSkills.length} Skills gewählt · {validation.valid ? "✅ Gültig" : "❌ " + validation.violations.length + " Verstöße"}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={labelStyle}>
          Skill-Tree
          <select value={treeId} onChange={(e) => { setTreeId(e.target.value); setSelectedSkills([]); }} style={selectStyle}>
            {SKILL_TREES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Ziel-Skill
          <select value={targetSkill} onChange={(e) => setTargetSkill(e.target.value)} style={selectStyle}>
            <option value="">-- wählen --</option>
            {tree.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.icon} {n.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Skill Selection */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 SKILL-AUSWAHL
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {tree.nodes.map((node) => {
            const isSelected = selectedSkills.includes(node.id);
            return (
              <label
                key={node.id}
                style={{
                  ...panelStyle,
                  cursor: "pointer",
                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: isSelected ? "var(--accent)" : "var(--bg)",
                  color: isSelected ? "var(--bg)" : "var(--fg)",
                  display: "flex", gap: 8, alignItems: "center",
                }}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleSkill(node.id)} style={{ margin: 0 }} />
                <span style={{ fontSize: 16 }}>{node.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {node.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({node.type}, T{node.tier}, {node.cost} SP, {node.cooldown}s CD)</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{node.description}</div>
                  {node.exclusions.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--accent)" }}>
                      Schließt aus: {node.exclusions.map((id) => tree.nodes.find((n) => n.id === id)?.name ?? id).join(", ")}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </details>

      {/* Validation */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✅ VALIDIERUNG
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          {validation.valid ? (
            <div style={{ color: "var(--accent)" }}>✅ Pfad gültig — keine Verstöße.</div>
          ) : (
            <div style={{ color: "var(--fg)" }}>
              ❌ {validation.violations.length} Verstoß(e):
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {validation.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.synergies.length > 0 && (
            <div style={{ marginTop: 8, color: "var(--muted)" }}>
              Synergien: {validation.synergies.map((n) => n.name).join(", ")}
            </div>
          )}
          {validation.exclusions.length > 0 && (
            <div style={{ marginTop: 4, color: "var(--accent)" }}>
              Ausgeschlossen: {validation.exclusions.map((n) => n.name).join(", ")}
            </div>
          )}
        </div>
      </details>

      {/* SVG Visualization */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎨 SVG-VISUALISIERUNG
        </summary>
        <div style={{ marginTop: 8, overflow: "auto" }}>
          <svg width={svg.width} height={svg.height} style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            {/* Edges */}
            {svg.edges.map((edge, i) => {
              const from = svg.nodes.find((n) => n.id === edge.from)!;
              const to = svg.nodes.find((n) => n.id === edge.to)!;
              return (
                <line
                  key={i}
                  x1={from.x + from.width / 2}
                  y1={from.y + from.height}
                  x2={to.x + to.width / 2}
                  y2={to.y}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              );
            })}
            {/* Nodes */}
            {svg.nodes.map((node) => {
              const isSelected = selectedSkills.includes(node.id);
              const skillNode = tree.nodes.find((n) => n.id === node.id);
              return (
                <g
                  key={node.id}
                  onClick={() => toggleSkill(node.id)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={4}
                    fill={isSelected ? "var(--accent)" : node.color}
                    opacity={isSelected ? 1 : 0.6}
                    stroke={isSelected ? "var(--fg)" : "none"}
                    strokeWidth={2}
                  />
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + 16}
                    textAnchor="middle"
                    fontSize={14}
                    fill="var(--bg)"
                  >
                    {skillNode?.icon}
                  </text>
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + 34}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--bg)"
                    fontFamily="var(--font-mono)"
                  >
                    {node.label.length > 14 ? node.label.slice(0, 12) + "…" : node.label}
                  </text>
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + 46}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--bg)"
                    fontFamily="var(--font-mono)"
                  >
                    T{node.tier} · {skillNode?.cost}SP
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </details>

      {/* Optimal Path */}
      {path && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🛤️ OPTIMALER PFAD
          </summary>
          <div style={{ marginTop: 8, ...panelStyle }}>
            <div><strong>Ziel:</strong> {tree.nodes.find((n) => n.id === targetSkill)?.name}</div>
            <div style={{ marginTop: 4 }}><strong>Pfad:</strong> {path.nodes.map((n) => `${n.icon} ${n.name}`).join(" → ")}</div>
            <div style={{ marginTop: 4 }}><strong>Kosten:</strong> {path.totalCost} SP · <strong>Max Tier:</strong> T{path.maxTier} · <strong>Cooldown:</strong> {path.totalCooldown}s</div>
          </div>
        </details>
      )}

      {/* Class Evolutions */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🏛️ KLASSEN-EVOLUTIONEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {CLASS_EVOLUTIONS.map((evo) => (
            <div key={evo.id} style={panelStyle}>
              <div style={{ fontWeight: 700 }}>{evo.name}</div>
              <div style={{ color: "var(--muted)" }}>{evo.fromClass} → {evo.toClass} (Level {evo.levelRequired})</div>
              <div style={{ color: "var(--muted)" }}>{evo.description}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default SkillTreeMatrixModal;
