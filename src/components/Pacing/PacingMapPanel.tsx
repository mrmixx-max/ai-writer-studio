// PacingMapPanel (Sprint 28, Agent 4): Pacing-Karte.
import { useState, useCallback } from "react";
import { generatePacingMap, type PacingMap } from "@/services/pacing/pacingMap";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";


export function PacingMapPanel() {
  const [text, setText] = useState("");
  const [map, setMap] = useState<PacingMap | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try { setMap(generatePacingMap(text)); }
    finally { setBusy(false); }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>🗺️ PACING-MAP</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Text hier einfügen..." style={{ width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={handleAnalyze} disabled={busy || !text.trim()} style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{busy ? "LÄUFT..." : "ANALYSIEREN"}</button>
      {map && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>SCHNELL</div><div style={{ fontSize: 20, fontWeight: 700, color: "#ff4444" }}>{map.fastPercentage}%</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>MITTEL</div><div style={{ fontSize: 20, fontWeight: 700, color: AMBER }}>{map.mediumPercentage}%</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>LANGSAM</div><div style={{ fontSize: 20, fontWeight: 700, color: "#44ff88" }}>{map.slowPercentage}%</div></div>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>SEGMENTE</div>
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {map.segments.map((seg) => (
                <div key={seg.id} style={{ width: 20, height: 20, background: seg.pace === "fast" ? "#ff4444" : seg.pace === "medium" ? AMBER : "#44ff88", border: `1px solid ${BORDER}` }} title={`${seg.wordCount} Wörter - ${seg.pace}`} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
