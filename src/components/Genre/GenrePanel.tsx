// GenrePanel (Sprint 27, Agent 6): Genre-Analyse.
import { useState, useCallback } from "react";
import {
  analyzeGenre,
  type GenreAnalysis,
} from "@/services/genre/genreAnalyzer";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function GenrePanel() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<GenreAnalysis | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setAnalysis(analyzeGenre(text));
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🎭 GENRE-ANALYSE
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
              <div style={{ color: DIM, fontSize: 10 }}>PRIMÄR</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{analysis.primaryGenre}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>SEKUNDÄR</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{analysis.secondaryGenre}</div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>GENRE-SCORES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {analysis.scores.slice(0, 5).map((score) => (
                <div key={score.genre} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 80, fontSize: 11 }}>{score.genre}</span>
                  <div style={{ flex: 1, height: 16, background: BG, border: `1px solid ${BORDER}` }}>
                    <div style={{ width: `${Math.min(100, score.score * 10)}%`, height: "100%", background: CYAN }} />
                  </div>
                  <span style={{ color: DIM, fontSize: 10, width: 30 }}>{score.score}%</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>DETAILS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
              <div>Zielgruppe: <span style={{ color: CYAN }}>{analysis.audience}</span></div>
              <div>Ton: <span style={{ color: CYAN }}>{analysis.tone}</span></div>
              <div>Pacing: <span style={{ color: CYAN }}>{analysis.pacing}</span></div>
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
