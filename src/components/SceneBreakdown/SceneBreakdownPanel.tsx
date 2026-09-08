// SceneBreakdownPanel (Sprint 23, Agent 3): Szenen-Liste + Statistiken +
// Zeitverteilung + Konflikt-Anzeige + CSV-Export.
//
// Standalone-Panel — arbeitet auf freiem Text (initialText) oder dem
// Editor-Inhalt; kein offenes Kapitel noetig.
//
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono). Inline-Stile, keine geteilte CSS-Datei.

import { useMemo, useState } from "react";
import {
  analyzeBreakdown,
  exportToCSV,
  parseScenes,
  suggestImprovements,
} from "@/services/scene/sceneBreakdown";
import { useI18n } from "@/i18n";

export interface SceneBreakdownPanelProps {
  /** Starttext (wird einmalig uebernommen). */
  initialText?: string;
  /** Aktueller Editor-Text ("Aktuellen Text analysieren"). */
  editorText?: string;
  /** Test-Hook: erhaelt das exportierte CSV. */
  onExport?: (csv: string) => void;
  className?: string;
}

const ACCENT = "#ffa028";

const rootStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 4,
  padding: 12,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 13,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const buttonStyle: React.CSSProperties = {
  background: "#111",
  color: ACCENT,
  border: "1px solid #333",
  borderRadius: 3,
  padding: "4px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 3,
  padding: "6px 8px",
};

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 3,
  padding: 8,
  fontFamily: "inherit",
  fontSize: 12,
  minHeight: 120,
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
};

export function SceneBreakdownPanel({
  initialText = "",
  editorText,
  onExport,
  className,
}: SceneBreakdownPanelProps) {
  const { t } = useI18n();
  const [text, setText] = useState(initialText);
  const [analyzed, setAnalyzed] = useState(initialText.length > 0);

  const scenes = useMemo(() => (analyzed ? parseScenes(text) : []), [analyzed, text]);
  const breakdown = useMemo(() => analyzeBreakdown(scenes), [scenes]);
  const tips = useMemo(() => (analyzed ? suggestImprovements(breakdown) : []), [analyzed, breakdown]);

  const handleAnalyze = () => setAnalyzed(true);
  const handleUseEditor = () => {
    setText(editorText ?? "");
    setAnalyzed(true);
  };
  const handleExport = () => {
    const csv = exportToCSV(scenes);
    onExport?.(csv);
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scene-breakdown.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* onExport genuegt als Fallback (Tests) */
    }
  };

  const td = breakdown.timeDistribution;
  const statCards = [
    { label: t("scene.totalScenes"), value: String(breakdown.totalScenes) },
    { label: t("scene.locations"), value: String(breakdown.locations.length) },
    { label: t("scene.characters"), value: String(breakdown.characters.length) },
    { label: t("scene.avgLength"), value: `${breakdown.averageSceneLength} ${t("scene.words")}` },
    { label: t("scene.pacing"), value: t(`scene.pacing.${breakdown.pacing}`) },
  ];

  return (
    <div className={className} style={rootStyle} data-testid="scene-breakdown-panel">
      <div style={{ color: ACCENT, fontWeight: 700 }}>🎬 {t("scene.title")}</div>

      <label htmlFor="scene-input" style={{ color: "#999" }}>
        {t("scene.inputLabel")}
      </label>
      <textarea
        id="scene-input"
        aria-label={t("scene.inputLabel")}
        style={inputStyle}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setAnalyzed(false);
        }}
        placeholder="INT. WOHNUNG - TAG"
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={buttonStyle} onClick={handleAnalyze}>
          {t("scene.analyze")}
        </button>
        {editorText !== undefined && (
          <button type="button" style={buttonStyle} onClick={handleUseEditor}>
            {t("scene.useEditor")}
          </button>
        )}
        {analyzed && scenes.length > 0 && (
          <button type="button" style={buttonStyle} onClick={handleExport}>
            {t("scene.exportCsv")}
          </button>
        )}
      </div>

      {analyzed && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label={t("scene.stats")}>
            {statCards.map((c) => (
              <div key={c.label} style={{ ...cardStyle, minWidth: 110 }}>
                <div style={{ color: "#999", fontSize: 11 }}>{c.label}</div>
                <div style={{ color: ACCENT, fontSize: 16, fontWeight: 700 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#999", fontSize: 11 }}>{t("scene.timeDistribution")}</div>
            <div>
              {t("scene.time.day")}: {td.day} · {t("scene.time.night")}: {td.night} ·{" "}
              {t("scene.time.dawn")}: {td.dawn} · {t("scene.time.dusk")}: {td.dusk}
            </div>
          </div>

          {breakdown.locations.length > 0 && (
            <div style={cardStyle}>
              <div style={{ color: "#999", fontSize: 11 }}>{t("scene.locations")}</div>
              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                {breakdown.locations.map((l) => (
                  <li key={l.name}>
                    {l.name} ({l.count}×)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {breakdown.characters.length > 0 && (
            <div style={cardStyle}>
              <div style={{ color: "#999", fontSize: 11 }}>{t("scene.characters")}</div>
              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                {breakdown.characters.map((c) => (
                  <li key={c.name}>
                    {c.name} ({c.sceneCount}×)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div style={{ color: ACCENT, fontWeight: 700 }}>{t("scene.sceneList")}</div>
            {scenes.length === 0 ? (
              <div style={{ color: "#999" }}>{t("scene.noScenes")}</div>
            ) : (
              <ul aria-label={t("scene.sceneList")} style={{ margin: "4px 0", paddingLeft: 18 }}>
                {scenes.map((s) => (
                  <li key={s.id} style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 700 }}>{s.heading}</div>
                    <div style={{ color: "#999", fontSize: 12 }}>
                      {s.location} · {t(`scene.time.${s.timeOfDay}`)}
                      {s.characters.length > 0 && ` · ${s.characters.join(", ")}`}
                      {` · 💬 ${s.dialogue}% 🎬 ${s.action}% 📝 ${s.description}%`}
                    </div>
                    {s.conflict && (
                      <div style={{ color: "#ff6b6b", fontSize: 12 }}>
                        ⚠ {t("scene.conflict")}: {s.conflict}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#999", fontSize: 11 }}>{t("scene.tips")}</div>
            <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
