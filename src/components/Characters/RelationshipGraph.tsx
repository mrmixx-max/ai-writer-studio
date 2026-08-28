// Charakter-Beziehungsgraph als SVG: Kreislayout, Kanten mit Typ, Klick/Hover, Isolation.
import { memo, useMemo, useState } from "react";
import type { Character } from "@/services/characters/characters";
import type { CharacterRelationship } from "@/services/characters/relationships";

interface Props {
  characters: Character[];
  relationships: CharacterRelationship[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}

const NODE_R = 26;
const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7"];

export const RelationshipGraph = memo(function RelationshipGraph({ characters, relationships, selectedId = null, onSelect, height = 380 }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const width = 560;

  const positions = useMemo(() => {
    const n = characters.length;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - NODE_R - 30;
    return characters.map((c, i) => {
      const angle = (i / Math.max(n, 1)) * 2 * Math.PI - Math.PI / 2;
      return { char: c, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), color: COLORS[i % COLORS.length] };
    });
  }, [characters, height]);

  const posOf = (id: string) => positions.find((p) => p.char.id === id);

  if (!characters.length) {
    return <div className="mode-placeholder">Keine Figuren vorhanden — lege zuerst Figuren an.</div>;
  }

  return (
    <div className="relationship-graph">
      <svg width={width} height={height} role="img" aria-label="Beziehungsgraph" style={{ display: "block" }}>
        {/* Kanten */}
        {relationships.map((rel) => {
          const a = posOf(rel.fromCharId);
          const b = posOf(rel.toCharId);
          if (!a || !b) return null;
          const active = hoverId === rel.fromCharId || hoverId === rel.toCharId ||
            selectedId === rel.fromCharId || selectedId === rel.toCharId;
          return (
            <g key={rel.id} opacity={active ? 1 : 0.55}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8b5cf6" strokeWidth={active ? 2.5 : 1.5} />
              {rel.relType && (
                <text
                  x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  textAnchor="middle" fontSize={10} fill="#8b5cf6" fontWeight={active ? "bold" : "normal"}
                >
                  {rel.relType}
                </text>
              )}
            </g>
          );
        })}
        {/* Knoten */}
        {positions.map(({ char, x, y, color }) => {
          const active = char.id === selectedId || char.id === hoverId;
          return (
            <g
              key={char.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoverId(char.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onSelect?.(char.id)}
            >
              <circle cx={x} cy={y} r={active ? NODE_R + 4 : NODE_R} fill={color} opacity={0.85}
                stroke={char.id === selectedId ? "#fff" : "none"} strokeWidth={3} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold">
                {char.name.slice(0, 8) || "?"}
              </text>
              <text x={x} y={y + NODE_R + 14} textAnchor="middle" fontSize={10} fill="currentColor">
                {char.name.length > 14 ? char.name.slice(0, 13) + "…" : char.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});
