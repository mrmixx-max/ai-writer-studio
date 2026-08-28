// Interaktive Timeline-Visualisierung als SVG: Zoom, Klick-Auswahl, Plot-Struktur-Bänder.
import { memo, useMemo, useState } from "react";

export interface TimelineItem {
  id: string;
  label: string;
  sub?: string;
  detail?: string;
  color?: string;
}

export interface TimelineBand {
  label: string;
  color: string;
  /** Anteil [0..1] der Breite, wo das Band beginnt/endet. */
  from: number;
  to: number;
}

interface Props {
  items: TimelineItem[];
  bands?: TimelineBand[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}

const PAD_X = 40;
const PAD_Y = 30;
const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

export const TimelineCanvas = memo(function TimelineCanvas({ items, bands = [], selectedId = null, onSelect, height = 220 }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const width = 800;

  const layout = useMemo(() => {
    const n = Math.max(items.length, 1);
    const usableW = width - PAD_X * 2;
    const spacing = (usableW * zoom) / Math.max(n - 1, 1);
    return items.map((item, i) => ({
      item,
      x: n === 1 ? width / 2 : PAD_X + i * spacing,
      y: height / 2,
      color: item.color ?? COLORS[i % COLORS.length],
    }));
  }, [items, zoom, height]);

  const svgW = Math.max(width, layout.length ? layout[layout.length - 1].x + PAD_X : width);

  if (!items.length) {
    return <div className="mode-placeholder">Noch keine Einträge für die Timeline.</div>;
  }

  return (
    <div className="timeline-canvas">
      <div className="timeline-controls">
        <label>
          Zoom
          <input
            type="range" min={1} max={4} step={0.1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <span className="timeline-hint">{items.length} Punkte · klicken für Details</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg
          width={svgW} height={height} role="img" aria-label="Timeline"
          style={{ display: "block", userSelect: "none" }}
        >
          {/* Plot-Struktur-Bänder */}
          {bands.map((b) => (
            <g key={b.label}>
              <rect
                x={PAD_X + b.from * (svgW - PAD_X * 2)}
                y={PAD_Y - 18}
                width={(b.to - b.from) * (svgW - PAD_X * 2)}
                height={height - PAD_Y * 2 + 18}
                fill={b.color}
                opacity={0.12}
                rx={6}
              />
              <text
                x={PAD_X + ((b.from + b.to) / 2) * (svgW - PAD_X * 2)}
                y={PAD_Y - 24}
                textAnchor="middle"
                fontSize={12}
                fill={b.color}
                fontWeight="bold"
              >
                {b.label}
              </text>
            </g>
          ))}

          {/* Grundlinie */}
          <line x1={PAD_X} y1={height / 2} x2={svgW - PAD_X} y2={height / 2} stroke="currentColor" opacity={0.3} strokeWidth={2} />

          {/* Punkte */}
          {layout.map(({ item, x, y, color }, i) => {
            const active = item.id === selectedId || item.id === hoverId;
            return (
              <g
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                onMouseEnter={() => setHoverId(item.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x} cy={y} r={active ? 9 : 6}
                  fill={color} opacity={0.9}
                  stroke={item.id === selectedId ? "#fff" : "none"}
                  strokeWidth={2}
                />
                {/* Wechselnde Seite für Label (verhindert Überlappung) */}
                <text x={x} y={y - 16} textAnchor="middle" fontSize={11} fill="currentColor" fontWeight={active ? "bold" : "normal"}>
                  {i + 1}. {item.label.length > 18 ? item.label.slice(0, 17) + "…" : item.label}
                </text>
                {item.sub && (
                  <text x={x} y={y + 24} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.65}>
                    {item.sub}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {selectedId && (
        <div className="timeline-detail">
          {(() => {
            const sel = items.find((i) => i.id === selectedId);
            if (!sel) return null;
            return (
              <>
                <strong>{sel.label}</strong>
                {sel.sub && <span className="timeline-detail-sub"> · {sel.sub}</span>}
                {sel.detail && <p>{sel.detail}</p>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
});
