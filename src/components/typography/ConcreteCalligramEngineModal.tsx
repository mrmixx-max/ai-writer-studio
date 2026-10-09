// ConcreteCalligramEngineModal (WP 125.1 UI / Meilenstein 60.0 / v7.2.0)
// UI für Konkrete Poesie & Vektor-Kalligramm-Studio.
import { useState, useMemo } from "react";
import {
  SHAPE_MASKS,
  layoutTextOnPath,
  exportCalligramSVG,
  createSampleShapeMask,
  createSampleCalligram,
} from "@/services/typography/concreteCalligramEngine";

export interface ConcreteCalligramEngineModalProps {
  className?: string;
}

export function ConcreteCalligramEngineModal({ className }: ConcreteCalligramEngineModalProps) {
  const sample = useMemo(() => createSampleCalligram(), []);
  const sampleMask = useMemo(() => createSampleShapeMask(), []);

  const [text, setText] = useState(
    "Die Zeit rinnt wie Sand durch die Hände der Erzähler"
  );
  const [shapeId, setShapeId] = useState(sampleMask.id);
  const [seed, setSeed] = useState(42);

  const layout = useMemo(() => layoutTextOnPath(text, shapeId, seed), [text, shapeId, seed]);
  const exportResult = useMemo(() => exportCalligramSVG(text, shapeId, seed), [text, shapeId, seed]);

  const activeMask = SHAPE_MASKS.find((m) => m.id === shapeId);

  const sectionTitleStyle = {
    fontSize: 11,
    color: "var(--accent)",
    cursor: "pointer" as const,
    fontWeight: 700 as const,
  };

  const inputStyle = {
    width: "100%",
    padding: 8,
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--fg)",
  };

  return (
    <div
      className={className}
      data-testid="concrete-calligram-modal"
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
        🔤 Konkrete Poesie &amp; Vektor-Kalligramm-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Zeichen: {text.length} · Form: {activeMask ? activeMask.name : "—"} · Seed: {seed} ·{" "}
        Export: {exportResult.width}×{exportResult.height} px @ {exportResult.dpi} DPI
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Formenmaske</div>
          <select
            value={shapeId}
            onChange={(e) => setShapeId(e.target.value)}
            style={inputStyle}
          >
            {SHAPE_MASKS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Seed</div>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 12 }}>
        Text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, marginTop: 4 }}
        />
      </label>

      {activeMask && (
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>
          {activeMask.description}
        </div>
      )}

      <details style={{ marginBottom: 12 }} open>
        <summary style={sectionTitleStyle}>🧵 PFAD-TEXT</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ color: "var(--muted)", fontSize: 10 }}>
            viewBox: {layout.viewBox} · auf dem Pfad gesetzte Zeichen: {layout.charCount}
          </div>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              overflow: "auto",
              maxHeight: 200,
            }}
            dangerouslySetInnerHTML={{ __html: layout.svg }}
          />
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              wordBreak: "break-all",
            }}
          >
            <strong style={{ color: "var(--accent)" }}>textPath:</strong> {layout.textPath}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={sectionTitleStyle}>📐 VEKTOR-EXPORT</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11 }}>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Breite:</strong> {exportResult.width} px
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Höhe:</strong> {exportResult.height} px
            </div>
            <div style={{ padding: 8, border: "1px solid var(--accent)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Auflösung:</strong> {exportResult.dpi} DPI
            </div>
          </div>
          <textarea
            readOnly
            value={exportResult.svg}
            style={{ ...inputStyle, minHeight: 160 }}
          />
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={sectionTitleStyle}>🎨 VERFÜGBARE FORMENMASKEN ({SHAPE_MASKS.length})</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
          {SHAPE_MASKS.map((m) => (
            <button
              key={m.id}
              onClick={() => setShapeId(m.id)}
              style={{
                padding: "6px 10px",
                textAlign: "left",
                background: m.id === shapeId ? "var(--panel)" : "transparent",
                border: `1px solid ${m.id === shapeId ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              <strong>{m.name}</strong> — {m.description}
            </button>
          ))}
        </div>
      </details>

      <details>
        <summary style={sectionTitleStyle}>📖 BEISPIEL-CALLIGRAMM</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
          <div style={{ color: "var(--muted)" }}>
            textPath: {sample.textPath} · Zeichen: {sample.charCount}
          </div>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
              overflow: "auto",
              maxHeight: 200,
            }}
            dangerouslySetInnerHTML={{ __html: sample.svg }}
          />
        </div>
      </details>
    </div>
  );
}
