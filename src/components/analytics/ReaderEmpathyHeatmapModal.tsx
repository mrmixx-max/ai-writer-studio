// ReaderEmpathyHeatmapModal (WP 71.1)
//
// Manuskript-Heatmap: legt eine transparente Farb-Glow-Schicht über den Text,
// die emotionale Hotspots farblich hervorhebt.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  analyzeEmpathyHeatmap,
  glowOpacity,
  summarizeHeatmap,
  REACTION_LABELS,
  type ReactionKind,
} from "@/services/analytics/readerEmpathyHeatmap";

export interface ReaderEmpathyHeatmapModalProps {
  initialText?: string;
  className?: string;
}

const SAMPLE = `Sie stand am Fenster und weinte. Der Verlust saß zu tief, und niemand konnte sie trösten.

Plötzlich zersplitterte das Glas. Eine Waffe, ein Schuss, keine Zeit mehr — sie rannte, die Angst im Nacken.

Dann geschah das Unfassbare: Die Wahrheit wurde enthüllt, eine Katharsis, die alle erlöste.

Er stolperte über den Teppich, ein alberner Patzer, und alle kicherten laut.`;

/** Farbe je Reaktionsart als CSS-Token-Referenz. */
const REACTION_COLORS: Record<ReactionKind, string> = {
  tears: "var(--accent)",
  goosebumps: "var(--success)",
  laughter: "var(--warn)",
  adrenaline: "var(--error)",
};

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

export function ReaderEmpathyHeatmapModal({
  initialText = SAMPLE,
  className,
}: ReaderEmpathyHeatmapModalProps) {
  const [text, setText] = useState(initialText);
  const [activeKinds, setActiveKinds] = useState<ReactionKind[]>([
    "tears",
    "goosebumps",
    "laughter",
    "adrenaline",
  ]);

  const heatmap = useMemo(() => analyzeEmpathyHeatmap(text), [text]);
  const summary = useMemo(() => summarizeHeatmap(heatmap), [heatmap]);

  const toggleKind = (kind: ReactionKind) => {
    setActiveKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
  };

  return (
    <div
      className={className}
      data-testid="reader-empathy-heatmap-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💓 Leser-Empathie- & Tränen-Heatmap
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {heatmap.paragraphs.length} Absätze · {heatmap.totalWords} Wörter ·{" "}
        {heatmap.hotspots.length} Hotspots
      </div>

      {/* Text */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Manuskript
        <textarea
          data-testid="empathy-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Reaktions-Filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {(Object.keys(REACTION_LABELS) as ReactionKind[]).map((kind) => (
          <button
            key={kind}
            data-testid={`empathy-filter-${kind}`}
            onClick={() => toggleKind(kind)}
            aria-pressed={activeKinds.includes(kind)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: activeKinds.includes(kind) ? "var(--accent)" : "var(--panel)",
              color: activeKinds.includes(kind) ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {REACTION_LABELS[kind]}
          </button>
        ))}
      </div>

      {/* Durchschnittswerte */}
      <div
        data-testid="empathy-averages"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DURCHSCHNITTLICHE REAKTIONSSTÄRKE
        </div>
        {(Object.keys(REACTION_LABELS) as ReactionKind[]).map((kind) => (
          <div key={kind} data-testid={`empathy-avg-${kind}`} style={{ marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--muted)" }}>{REACTION_LABELS[kind]}</span>
              <span style={{ color: REACTION_COLORS[kind] }}>{heatmap.averages[kind]}%</span>
            </div>
            <div style={{ height: 4, background: "var(--panel)", borderRadius: 2, marginTop: 2 }}>
              <div
                style={{
                  width: `${Math.max(2, heatmap.averages[kind])}%`,
                  height: 4,
                  background: REACTION_COLORS[kind],
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div
        data-testid="empathy-heatmap"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          MANUSKRIPT-HEATMAP (Glow über dem Text)
        </div>
        {heatmap.paragraphs.length === 0 ? (
          <div data-testid="empathy-empty" style={{ color: "var(--muted)" }}>
            Kein Text analysiert.
          </div>
        ) : (
          heatmap.paragraphs.map((p) => {
            const visibleKinds = activeKinds.filter((k) => p[k] > 0);
            return (
              <div
                key={p.index}
                data-testid={`empathy-paragraph-${p.index}`}
                style={{ position: "relative", marginBottom: 10, padding: 6, borderRadius: 4 }}
              >
                {/* Glow-Schicht */}
                {visibleKinds.map((kind) => (
                  <div
                    key={kind}
                    data-testid={`empathy-glow-${p.index}-${kind}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: REACTION_COLORS[kind],
                      opacity: glowOpacity(p[kind]),
                      borderRadius: 4,
                      pointerEvents: "none",
                    }}
                  />
                ))}
                <div style={{ position: "relative", lineHeight: 1.6 }}>
                  <span style={{ fontSize: 9, color: "var(--muted)", marginRight: 6 }}>
                    §{p.index}
                  </span>
                  {p.preview}
                  {p.preview.length >= 80 && "…"}
                </div>
                <div
                  data-testid={`empathy-values-${p.index}`}
                  style={{ position: "relative", fontSize: 9, color: "var(--muted)", marginTop: 4 }}
                >
                  {visibleKinds.map((k) => `${REACTION_LABELS[k]} ${p[k]}%`).join(" · ") || "—"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hotspots */}
      <div
        data-testid="empathy-hotspots"
        style={{
          border: `1px solid ${heatmap.hotspots.length > 0 ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          EMOTIONALE HOTSPOTS
        </div>
        {heatmap.hotspots.length === 0 ? (
          <div data-testid="empathy-no-hotspots" style={{ color: "var(--muted)" }}>
            Keine ausgeprägten Hotspots gefunden.
          </div>
        ) : (
          heatmap.hotspots.slice(0, 8).map((h, i) => (
            <div key={i} data-testid={`empathy-hotspot-${i}`} style={{ marginBottom: 3 }}>
              <span style={{ color: REACTION_COLORS[h.kind] }}>●</span> {h.label}
            </div>
          ))
        )}
      </div>

      {/* Klimax + Zusammenfassung */}
      {heatmap.climaxParagraph !== null && (
        <div
          data-testid="empathy-climax"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
            EMOTIONALER HÖHEPUNKT
          </div>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>
            Absatz {heatmap.climaxParagraph}
          </div>
        </div>
      )}

      <details data-testid="empathy-summary">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Zusammenfassung
        </summary>
        <pre
          data-testid="empathy-summary-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {summary}
        </pre>
      </details>
    </div>
  );
}
