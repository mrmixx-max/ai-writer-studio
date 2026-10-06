// SceneCameraBlockingModal (WP 70.2)
//
// Interaktives Bühnen-Canvas (SVG) mit 180-Grad-Achsen-Wächter und
// Blickfeld-Visualisierung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  checkAxisCrossing,
  computeFrustum,
  analyzeBlocking,
  buildDefaultStage,
  type StageElement,
  type CameraSetup,
  type ShotSize,
  type CameraAngle,
} from "@/services/visual/sceneCameraBlocking";

export interface SceneCameraBlockingModalProps {
  className?: string;
}

const SHOT_SIZES: Array<{ id: ShotSize; label: string }> = [
  { id: "close-up", label: "Nahaufnahme" },
  { id: "medium", label: "Halbnah" },
  { id: "wide", label: "Totale" },
  { id: "extreme-wide", label: "Weite Totale" },
];

const ANGLES: Array<{ id: CameraAngle; label: string }> = [
  { id: "eye-level", label: "Augenhöhe" },
  { id: "low", label: "Untersicht" },
  { id: "high", label: "Aufsicht" },
  { id: "birds-eye", label: "Vogelperspektive" },
];

const KIND_ICON: Record<string, string> = {
  character: "🧍",
  prop: "📦",
  door: "🚪",
  camera: "🎥",
};

/** Bühnenmaße in Metern (wird auf SVG-Pixel skaliert). */
const STAGE_W = 12;
const STAGE_H = 8;
const SCALE = 45;
const PAD = 20;

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

export function SceneCameraBlockingModal({ className }: SceneCameraBlockingModalProps) {
  const [elements, setElements] = useState<StageElement[]>(() => buildDefaultStage());
  const [activeCameraId, setActiveCameraId] = useState("cam-1");
  const [previousCameraId, setPreviousCameraId] = useState<string>("");
  const [shotSize, setShotSize] = useState<ShotSize>("medium");
  const [angle, setAngle] = useState<CameraAngle>("eye-level");
  const [focalLength, setFocalLength] = useState(50);

  const axisCheck = useMemo(
    () => checkAxisCrossing(elements, activeCameraId, previousCameraId || null),
    [elements, activeCameraId, previousCameraId],
  );

  const setup: CameraSetup = useMemo(
    () => ({ cameraId: activeCameraId, shotSize, angle, focalLength }),
    [activeCameraId, shotSize, angle, focalLength],
  );

  const frustum = useMemo(() => computeFrustum(elements, setup), [elements, setup]);
  const report = useMemo(() => analyzeBlocking(elements), [elements]);

  const toPx = (v: number) => PAD + v * SCALE;

  const moveElement = (id: string, dx: number, dy: number) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id
          ? {
              ...el,
              x: Math.max(0, Math.min(STAGE_W, el.x + dx)),
              y: Math.max(0, Math.min(STAGE_H, el.y + dy)),
            }
          : el,
      ),
    );
  };

  const rotateElement = (id: string, delta: number) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, rotation: (el.rotation + delta + 360) % 360 } : el)),
    );
  };

  return (
    <div
      className={className}
      data-testid="scene-camera-blocking-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 3D-Szenen- & Kamera-Blocking
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {report.characterCount} Figuren · {report.cameraCount} Kameras · {report.sightLines.length} Blicklinien
      </div>

      {/* Achsen-Wächter */}
      <div
        data-testid="blocking-axis"
        style={{
          border: `1px solid ${axisCheck.valid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          180-GRAD-ACHSEN-WÄCHTER
        </div>
        <div
          data-testid="blocking-axis-status"
          style={{
            fontWeight: 700,
            color: axisCheck.valid ? "var(--success)" : "var(--error)",
          }}
        >
          {axisCheck.valid ? "✓ Achse eingehalten" : "⚠ ACHSENSPRUNG"}
        </div>
        <div data-testid="blocking-axis-message" style={{ marginTop: 4, color: "var(--muted)" }}>
          {axisCheck.message}
        </div>
        {axisCheck.axis && (
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
            Handlungsachse: {axisCheck.axis.join(" ↔ ")} · Kameraseite: {axisCheck.cameraSide}
            {axisCheck.previousSide !== null && ` (vorher: ${axisCheck.previousSide})`}
          </div>
        )}
      </div>

      {/* Bühnen-Canvas */}
      <div style={{ marginBottom: 14, overflowX: "auto" }}>
        <svg
          data-testid="blocking-stage"
          viewBox={`0 0 ${STAGE_W * SCALE + PAD * 2} ${STAGE_H * SCALE + PAD * 2}`}
          style={{
            width: "100%",
            maxWidth: 560,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          {/* Raster */}
          {Array.from({ length: Math.floor(STAGE_W) + 1 }, (_, i) => (
            <line
              key={`vx${i}`}
              x1={toPx(i)}
              y1={PAD}
              x2={toPx(i)}
              y2={PAD + STAGE_H * SCALE}
              style={{ stroke: "var(--border)", strokeWidth: 0.5 }}
            />
          ))}
          {Array.from({ length: Math.floor(STAGE_H) + 1 }, (_, i) => (
            <line
              key={`hy${i}`}
              x1={PAD}
              y1={toPx(i)}
              x2={PAD + STAGE_W * SCALE}
              y2={toPx(i)}
              style={{ stroke: "var(--border)", strokeWidth: 0.5 }}
            />
          ))}

          {/* Blickfeld der aktiven Kamera */}
          <polygon
            data-testid="blocking-frustum"
            points={[
              `${toPx(frustum.origin.x)},${toPx(frustum.origin.y)}`,
              ...frustum.edges.map((e) => `${toPx(e.x)},${toPx(e.y)}`),
            ].join(" ")}
            style={{ fill: "var(--accent)", opacity: 0.15, stroke: "var(--accent)", strokeWidth: 1 }}
          />

          {/* Handlungsachse */}
          {axisCheck.axis && (
            <line
              data-testid="blocking-axis-line"
              x1={toPx(elements.find((e) => e.id === axisCheck.axis![0])?.x ?? 0)}
              y1={toPx(elements.find((e) => e.id === axisCheck.axis![0])?.y ?? 0)}
              x2={toPx(elements.find((e) => e.id === axisCheck.axis![1])?.x ?? 0)}
              y2={toPx(elements.find((e) => e.id === axisCheck.axis![1])?.y ?? 0)}
              style={{ stroke: "var(--warn)", strokeWidth: 1.5, strokeDasharray: "6 4" }}
            />
          )}

          {/* Blicklinien */}
          {report.sightLines.map((s, i) => {
            const from = elements.find((e) => e.id === s.from);
            const to = elements.find((e) => e.id === s.to);
            if (!from || !to) return null;
            return (
              <line
                key={i}
                data-testid={`blocking-sight-${i}`}
                x1={toPx(from.x)}
                y1={toPx(from.y)}
                x2={toPx(to.x)}
                y2={toPx(to.y)}
                style={{ stroke: "var(--success)", strokeWidth: 1, opacity: 0.6 }}
              />
            );
          })}

          {/* Elemente */}
          {elements.map((el) => (
            <g
              key={el.id}
              data-testid={`blocking-element-${el.id}`}
              onClick={() => {
                if (el.kind === "camera") {
                  setPreviousCameraId(activeCameraId);
                  setActiveCameraId(el.id);
                }
              }}
              style={{ cursor: el.kind === "camera" ? "pointer" : "default" }}
            >
              <circle
                cx={toPx(el.x)}
                cy={toPx(el.y)}
                r={12}
                style={{
                  fill: "var(--bg)",
                  stroke: el.id === activeCameraId ? "var(--accent)" : "var(--border)",
                  strokeWidth: el.id === activeCameraId ? 2.5 : 1.5,
                }}
              />
              <text
                x={toPx(el.x)}
                y={toPx(el.y) + 4}
                textAnchor="middle"
                style={{ fontSize: 12, fill: "var(--fg)" }}
              >
                {KIND_ICON[el.kind] ?? "•"}
              </text>
              {/* Blickrichtung */}
              <line
                x1={toPx(el.x)}
                y1={toPx(el.y)}
                x2={toPx(el.x) + Math.cos((el.rotation * Math.PI) / 180) * 16}
                y2={toPx(el.y) + Math.sin((el.rotation * Math.PI) / 180) * 16}
                style={{ stroke: "var(--accent)", strokeWidth: 2 }}
              />
              <text
                x={toPx(el.x)}
                y={toPx(el.y) + 26}
                textAnchor="middle"
                style={{ fontSize: 8, fill: "var(--muted)" }}
              >
                {el.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Element-Steuerung */}
      <div
        data-testid="blocking-controls"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          ELEMENT-BEWEGUNG (Figuren)
        </div>
        {elements
          .filter((e) => e.kind === "character")
          .map((el) => (
            <div
              key={el.id}
              data-testid={`blocking-ctrl-${el.id}`}
              style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}
            >
              <span style={{ minWidth: 60, color: "var(--accent)" }}>{el.label}</span>
              <span style={{ fontSize: 9, color: "var(--muted)", minWidth: 80 }}>
                ({el.x.toFixed(1)}, {el.y.toFixed(1)}) · {el.rotation}°
              </span>
              <button data-testid={`blocking-left-${el.id}`} onClick={() => moveElement(el.id, -0.5, 0)} style={btnStyle}>
                ←
              </button>
              <button data-testid={`blocking-right-${el.id}`} onClick={() => moveElement(el.id, 0.5, 0)} style={btnStyle}>
                →
              </button>
              <button data-testid={`blocking-up-${el.id}`} onClick={() => moveElement(el.id, 0, -0.5)} style={btnStyle}>
                ↑
              </button>
              <button data-testid={`blocking-down-${el.id}`} onClick={() => moveElement(el.id, 0, 0.5)} style={btnStyle}>
                ↓
              </button>
              <button data-testid={`blocking-rot-${el.id}`} onClick={() => rotateElement(el.id, 45)} style={btnStyle}>
                ↻
              </button>
            </div>
          ))}
      </div>

      {/* Kamera-Setup */}
      <div
        data-testid="blocking-camera-setup"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KAMERA-SETUP</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
            Einstellung
            <select
              data-testid="blocking-shot-select"
              value={shotSize}
              onChange={(e) => setShotSize(e.target.value as ShotSize)}
              style={inputStyle}
            >
              {SHOT_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
            Winkel
            <select
              data-testid="blocking-angle-select"
              value={angle}
              onChange={(e) => setAngle(e.target.value as CameraAngle)}
              style={inputStyle}
            >
              {ANGLES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Brennweite (mm)
            <input
              data-testid="blocking-focal-input"
              type="number"
              min={14}
              max={200}
              value={focalLength}
              onChange={(e) => setFocalLength(Number(e.target.value) || 50)}
              style={inputStyle}
            />
          </label>
        </div>
        <div data-testid="blocking-framing" style={{ color: "var(--accent)" }}>
          {frustum.framing}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Öffnungswinkel: ±{frustum.halfAngle}° · Reichweite: {frustum.range} m
        </div>
      </div>

      {/* Warnungen */}
      <div
        data-testid="blocking-warnings"
        style={{
          border: `1px solid ${report.warnings.length > 0 ? "var(--warn)" : "var(--border)"}`,
          borderRadius: 4,
          padding: 10,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          BLOCKING-ANALYSE
        </div>
        {report.warnings.length === 0 ? (
          <div data-testid="blocking-no-warnings" style={{ color: "var(--success)" }}>
            ✓ Keine Auffälligkeiten
          </div>
        ) : (
          report.warnings.map((w, i) => (
            <div key={i} data-testid={`blocking-warning-${i}`} style={{ color: "var(--warn)", marginBottom: 3 }}>
              ⚠ {w}
            </div>
          ))
        )}
        {report.sightLines.length > 0 && (
          <div data-testid="blocking-sight-list" style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
            Blicklinien:{" "}
            {report.sightLines
              .map((s) => {
                const a = elements.find((e) => e.id === s.from)?.label ?? s.from;
                const b = elements.find((e) => e.id === s.to)?.label ?? s.to;
                return `${a} → ${b}`;
              })
              .join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 3,
  cursor: "pointer",
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
} as const;
