// BookTrailerStudio (WP 44.1): Social Buchtrailer- & Teaser-Studio.
//
// Erstellt eine Trailer-Timeline (Hook → Partikel → Titel → Cover-Drehung →
// Call-to-Action), zeigt eine Keyframe-Vorschau und exportiert animiertes SVG.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createTrailerTimeline,
  renderTrailerFrame,
  exportTimelineAsSvg,
  calculateTrailerDuration,
  type TrailerFormat,
} from "@/services/marketing/bookTrailerStudio";

export interface BookTrailerStudioProps {
  className?: string;
  defaultTitle?: string;
  defaultAuthor?: string;
}

const KIND_LABEL: Record<string, string> = {
  hook: "Hook-Zitat",
  particles: "Partikel-Animation",
  title: "Titelschrift",
  "cover-rotate": "3D-Cover-Drehung",
  cta: "Call-to-Action",
};

export function BookTrailerStudio({
  className,
  defaultTitle = "Der letzte Winter",
  defaultAuthor = "Erik Gieske",
}: BookTrailerStudioProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [author, setAuthor] = useState(defaultAuthor);
  const [hook, setHook] = useState("Niemand verließ die Stadt lebend.");
  const [cta, setCta] = useState("Jetzt vorbestellen");
  const [format, setFormat] = useState<TrailerFormat>("vertical");
  const [previewMs, setPreviewMs] = useState(0);
  const [svg, setSvg] = useState("");

  const timeline = useMemo(
    () =>
      createTrailerTimeline({
        title,
        author,
        hookQuote: hook,
        callToAction: cta,
        format,
      }),
    [title, author, hook, cta, format],
  );

  const frame = useMemo(() => renderTrailerFrame(timeline, previewMs), [timeline, previewMs]);
  const duration = calculateTrailerDuration(timeline);

  const handleExport = useCallback(() => {
    setSvg(exportTimelineAsSvg(timeline, format));
  }, [timeline, format]);

  return (
    <div
      className={className}
      data-testid="book-trailer-studio"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 Buchtrailer-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {timeline.width}×{timeline.height} px · {(duration / 1000).toFixed(1)} s ·{" "}
        {timeline.keyframes.length} Keyframes
      </div>

      {/* Format-Umschalter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["vertical", "horizontal"] as const).map((f) => (
          <button
            key={f}
            data-testid={`trailer-format-${f}`}
            onClick={() => setFormat(f)}
            style={{
              background: format === f ? "var(--accent)" : "transparent",
              color: format === f ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {f === "vertical" ? "9:16 Vertikal (TikTok/Reels)" : "16:9 Horizontal (YouTube)"}
          </button>
        ))}
      </div>

      {/* Eingaben */}
      <div style={{ display: "grid", gap: 8, marginBottom: 14, maxWidth: 520 }}>
        {[
          { label: "Titel", value: title, set: setTitle, testid: "trailer-input-title" },
          { label: "Autor", value: author, set: setAuthor, testid: "trailer-input-author" },
          { label: "Hook-Zitat", value: hook, set: setHook, testid: "trailer-input-hook" },
          { label: "Call-to-Action", value: cta, set: setCta, testid: "trailer-input-cta" },
        ].map((f) => (
          <label key={f.testid} style={{ fontSize: 11, color: "var(--muted)" }}>
            {f.label}
            <input
              data-testid={f.testid}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </label>
        ))}
      </div>

      {/* Keyframe-Zeitleiste */}
      <div data-testid="trailer-timeline" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>TIMELINE</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {timeline.keyframes.map((kf) => {
            const active = frame.activeKeyframe === kf.id;
            return (
              <button
                key={kf.id}
                data-testid={`trailer-keyframe-${kf.kind}`}
                onClick={() => setPreviewMs(kf.startMs)}
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--bg)" : "var(--fg)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  padding: "5px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600 }}>{KIND_LABEL[kf.kind] ?? kf.kind}</div>
                <div style={{ fontSize: 9, opacity: 0.8 }}>
                  {(kf.startMs / 1000).toFixed(1)}–{((kf.startMs + kf.durationMs) / 1000).toFixed(1)} s
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vorschau */}
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
        VORSCHAU @ {(previewMs / 1000).toFixed(1)} s
      </div>
      <input
        data-testid="trailer-scrub"
        type="range"
        min={0}
        max={Math.max(0, duration - 1)}
        value={previewMs}
        onChange={(e) => setPreviewMs(Number(e.target.value))}
        style={{ width: "100%", maxWidth: 520, marginBottom: 10 }}
      />
      <div
        data-testid="trailer-preview"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 14,
          maxWidth: 520,
          minHeight: 90,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          data-testid="trailer-preview-text"
          style={{
            fontSize: 15,
            color: "var(--fg)",
            opacity: frame.opacity,
            transform: `scale(${frame.scale.toFixed(3)}) rotate(${frame.rotationDeg.toFixed(1)}deg)`,
            transition: "none",
          }}
        >
          {frame.text || "—"}
        </div>
        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 8 }}>
          Opacity {frame.opacity.toFixed(2)} · Scale {frame.scale.toFixed(2)} · Rotation{" "}
          {frame.rotationDeg.toFixed(1)}°
        </div>
      </div>

      <button
        data-testid="trailer-export"
        onClick={handleExport}
        style={{
          background: "var(--accent)",
          color: "var(--bg)",
          border: "none",
          borderRadius: 4,
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 14,
        }}
      >
        SVG-Animation exportieren
      </button>

      {svg && (
        <pre
          data-testid="trailer-svg-output"
          style={{
            marginTop: 10,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            maxHeight: 200,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {svg}
        </pre>
      )}
    </div>
  );
}
