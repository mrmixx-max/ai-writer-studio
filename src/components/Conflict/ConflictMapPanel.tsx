// ConflictMapPanel (Sprint 28, Agent 5): Konfliktkarte.
import { useState, useCallback } from "react";
import { generateConflictMap, type ConflictMap } from "@/services/conflict/conflictMap";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function ConflictMapPanel() {
  const [map, setMap] = useState<ConflictMap | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try { setMap(generateConflictMap(text)); }
    finally { setBusy(false); }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>⚔️ KONFLIKTKARTE</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Text hier einfügen..." style={{ width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={handleAnalyze} disabled={busy || !text.trim()} style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{busy ? "LÄUFT..." : "ANALYSIEREN"}</button>
      {map && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>KONFLIKTE</div><div style={{ fontSize: 20, fontWeight: 700 }}>{map.totalConflicts}</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>GELÖST</div><div style={{ fontSize: 20, fontWeight: 700, color: "#44ff88" }}>{map.resolvedConflicts}</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>OFFEN</div><div style={{ fontSize: 20, fontWeight: 700, color: "#ff4444" }}>{map.unresolvedConflicts}</div></div>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>KONFLIKTE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {map.conflicts.slice(0, 10).map((c) => (
                <div key={c.id} style={{ background: BG, border: `1px solid ${BORDER}`, padding: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, flex: 1 }}>{c.description.slice(0, 60)}...</span>
                  <span style={{ color: c.intensity > 60 ? "#ff4444" : AMBER, fontSize: 10 }}>{c.type} ({c.intensity}%)</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
