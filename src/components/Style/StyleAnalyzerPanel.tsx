// StyleAnalyzerPanel (Sprint 27, Agent 5): Stil-Analyse.
import { useState, useCallback } from "react";
import {
  analyzeStyle,
  type StyleAnalysis,
} from "@/services/style/styleAnalyzer";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function StyleAnalyzerPanel() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setAnalysis(analyzeStyle(text));
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🎨 STIL-ANALYSE
      </h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
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

      {analysis && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>STIL</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{analysis.style.toUpperCase()}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>TON</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{analysis.tone.toUpperCase()}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>ZIELGRUPPE</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{analysis.audience.toUpperCase()}</div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>METRIKEN</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
              <div>Wortschatz: <span style={{ color: CYAN }}>{Math.round(analysis.metrics.vocabularyRichness * 100)}%</span></div>
              <div>Ø Wortlänge: <span style={{ color: CYAN }}>{analysis.metrics.averageWordLength}</span></div>
              <div>Ø Satzlänge: <span style={{ color: CYAN }}>{analysis.metrics.averageSentenceLength}</span></div>
              <div>Passiv: <span style={{ color: CYAN }}>{Math.round(analysis.metrics.passiveVoiceRatio * 100)}%</span></div>
              <div>Dialog: <span style={{ color: CYAN }}>{Math.round(analysis.metrics.dialogueRatio * 100)}%</span></div>
              <div>Handlung: <span style={{ color: CYAN }}>{Math.round(analysis.metrics.actionRatio * 100)}%</span></div>
              <div>Emotion: <span style={{ color: CYAN }}>{Math.round(analysis.metrics.emotionRatio * 100)}%</span></div>
              <div>Lesbarkeit: <span style={{ color: CYAN }}>{analysis.metrics.readabilityScore}</span></div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>VORSCHLÄGE</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
              {analysis.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
