// EmotionalArcPanel (Sprint 26, Agent 6): Emotionale Handlungskurve.
import { useState, useCallback } from "react";
import {
  analyzeEmotionalArc,
  getEmotionColor,
  generateAsciiArc,
  type EmotionalArc,
} from "@/services/emotion/emotionArcEngine";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

const EMOTION_LABELS: Record<string, string> = {
  freude: "FREUDE",
  trauer: "TRAUER",
  wut: "WUT",
  angst: "ANGST",
  liebe: "LIEBE",
  hoffnung: "HOFFNUNG",
  hass: "HASS",
  verzweiflung: "VERZWEIFLUNG",
  überraschung: "ÜBERRASCHUNG",
  ekel: "EKEL",
  neutral: "NEUTRAL",
};

export function EmotionalArcPanel() {
  const [text, setText] = useState("");
  const [arc, setArc] = useState<EmotionalArc | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setArc(analyzeEmotionalArc(text));
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        💔 EMOTIONAL ARC
      </h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Text hier einfügen..."
        style={{
          width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`,
          color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12,
        }}
      />

      <button onClick={handleAnalyze} disabled={busy || !text.trim()}
        style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        {busy ? "LÄUFT..." : "ANALYSIEREN"}
      </button>

      {arc && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>DOMINANT</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: getEmotionColor(arc.dominantEmotion) }}>
                {EMOTION_LABELS[arc.dominantEmotion] ?? arc.dominantEmotion}
              </div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>TYP</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{arc.arcType.toUpperCase()}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>INTENSITÄT</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{arc.averageIntensity}%</div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>KURVE</div>
            <pre style={{ fontSize: 10, lineHeight: 1.4, color: CYAN, overflowX: "auto" }}>
              {generateAsciiArc(arc)}
            </pre>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>EMOTIONEN</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(
                arc.points.reduce((acc, p) => {
                  acc[p.emotion] = (acc[p.emotion] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([emotion, count]) => (
                <span key={emotion} style={{
                  background: getEmotionColor(emotion) + "22",
                  border: `1px solid ${getEmotionColor(emotion)}`,
                  padding: "2px 8px",
                  fontSize: 10,
                  color: getEmotionColor(emotion),
                }}>
                  {EMOTION_LABELS[emotion] ?? emotion} ({count})
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>VORSCHLÄGE</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
              {arc.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
