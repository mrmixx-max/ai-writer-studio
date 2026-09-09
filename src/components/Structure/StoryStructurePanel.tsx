// StoryStructurePanel (Sprint 28, Agent 6): Geschichtsstruktur.
import { useState, useCallback } from "react";
import { analyzeStoryStructure, type StoryStructure } from "@/services/structure/storyStructure";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function StoryStructurePanel() {
  const [text, setText] = useState("");
  const [structure, setStructure] = useState<StoryStructure | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try { setStructure(analyzeStoryStructure(text)); }
    finally { setBusy(false); }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>📜 GESCHICHTSSTRUKTUR</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Text hier einfügen..." style={{ width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={handleAnalyze} disabled={busy || !text.trim()} style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{busy ? "LÄUFT..." : "ANALYSIEREN"}</button>
      {structure && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>TYP</div><div style={{ fontSize: 14, fontWeight: 700 }}>{structure.structureType.toUpperCase()}</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>VOLLSTÄNDIG</div><div style={{ fontSize: 20, fontWeight: 700 }}>{structure.completeness}%</div></div>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>STRUKTURPUNKTE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {structure.points.map((p) => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 100, fontSize: 10, color: DIM }}>{p.position}%</span>
                  <div style={{ flex: 1, height: 16, background: BG, border: `1px solid ${BORDER}` }}>
                    <div style={{ width: `${p.confidence}%`, height: "100%", background: CYAN }} />
                  </div>
                  <span style={{ fontSize: 11 }}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
          {structure.missingElements.length > 0 && (
            <div style={{ background: PANEL, border: `1px solid #ff4444`, padding: 12, marginBottom: 12 }}>
              <div style={{ color: "#ff4444", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>FEHLENDE ELEMENTE</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
                {structure.missingElements.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
