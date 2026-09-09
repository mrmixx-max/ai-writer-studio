// CharacterArcPanel (Sprint 28, Agent 3): Charakterentwicklung.
import { useState, useCallback } from "react";
import { analyzeCharacterArc, type CharacterArc } from "@/services/arc/characterArc";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function CharacterArcPanel() {
  const [text, setText] = useState("");
  const [arc, setArc] = useState<CharacterArc | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try { setArc(analyzeCharacterArc(text)); }
    finally { setBusy(false); }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>👤 CHARAKTER-ARC</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Text hier einfügen..." style={{ width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={handleAnalyze} disabled={busy || !text.trim()} style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{busy ? "LÄUFT..." : "ANALYSIEREN"}</button>
      {arc && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>ENTWICKLUNG</div><div style={{ fontSize: 14, fontWeight: 700, color: arc.overallDevelopment > 0 ? "#44ff88" : arc.overallDevelopment < 0 ? "#ff4444" : CYAN }}>{arc.overallDevelopment > 0 ? "+" : ""}{arc.overallDevelopment}</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>TYP</div><div style={{ fontSize: 14, fontWeight: 700 }}>{arc.arcType.toUpperCase()}</div></div>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>ENTWICKLUNGSKURVE</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
              {arc.points.slice(0, 50).map((p, i) => (
                <div key={i} style={{ flex: 1, height: `${Math.abs(p.development)}%`, background: p.development > 0 ? "#44ff88" : p.development < 0 ? "#ff4444" : CYAN }} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
