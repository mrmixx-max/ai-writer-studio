// RepetitionPanel (Sprint 26, Agent 2): Wort- und Phrasenwiederholungen
// anzeigen. Bloomberg-Terminal-Stil.
import { useState, useCallback } from "react";
import {
  generateRepetitionReport,
  type RepetitionReport,
} from "@/services/repetition/repetitionFinder";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const RED = "#ff4444";
const YELLOW = "#ffaa00";

export function RepetitionPanel() {
  const [text, setText] = useState("");
  const [report, setReport] = useState<RepetitionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<"de" | "en">("de");

  const handleCheck = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const rep = generateRepetitionReport(text, language);
      setReport(rep);
    } finally {
      setBusy(false);
    }
  }, [text, language]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🔁 WIEDERHOLUNGS-FINDER
      </h2>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["de", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLanguage(l)}
            style={{
              padding: "4px 10px",
              background: language === l ? AMBER : PANEL,
              color: language === l ? "#000" : TEXT,
              border: `1px solid ${language === l ? AMBER : BORDER}`,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Text hier einfügen..."
        style={{
          width: "100%",
          padding: "8px 10px",
          background: PANEL,
          border: `1px solid ${BORDER}`,
          color: TEXT,
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          boxSizing: "border-box",
          marginBottom: 12,
        }}
      />

      <button
        onClick={handleCheck}
        disabled={busy || !text.trim()}
        style={{
          padding: "8px 20px",
          background: busy || !text.trim() ? DIM : AMBER,
          color: "#000",
          border: "none",
          cursor: busy || !text.trim() ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {busy ? "LÄUFT..." : "ANALYSIEREN"}
      </button>

      {report && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>WÖRTER</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{report.totalWords}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>EINDEUTIG</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{report.uniqueWords}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${report.repetitionRatio > 0.3 ? RED : YELLOW}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>RATIO</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: report.repetitionRatio > 0.3 ? RED : YELLOW }}>
                {Math.round(report.repetitionRatio * 100)}%
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.repetitions.slice(0, 30).map((rep) => (
              <div
                key={rep.id}
                style={{
                  background: PANEL,
                  border: `1px solid ${rep.count >= 5 ? RED : YELLOW}`,
                  padding: "8px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ color: rep.type === "word" ? CYAN : AMBER, fontSize: 10, marginRight: 8 }}>
                    {rep.type === "word" ? "WORT" : "PHRASE"}
                  </span>
                  <span style={{ fontSize: 13 }}>{rep.text}</span>
                </div>
                <span style={{ color: rep.count >= 5 ? RED : YELLOW, fontWeight: 700 }}>
                  {rep.count}x
                </span>
              </div>
            ))}
            {report.repetitions.length === 0 && (
              <div style={{ color: "#44ff88", textAlign: "center", padding: 20 }}>
                ✓ Keine Wiederholungen gefunden
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
