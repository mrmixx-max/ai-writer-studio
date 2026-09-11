// HookPanel (Sprint 28, Agent 1): Hook-Analyse.
import { useState, useCallback } from "react";
import { analyzeAllHooks } from "@/services/hook/hookAnalyzer";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function HookPanel() {
  const [text, setText] = useState("");
  const [report, setReport] = useState<ReturnType<typeof analyzeAllHooks> | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try { setReport(analyzeAllHooks(text)); }
    finally { setBusy(false); }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>🎣 HOOK-ANALYSE</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Text hier einfügen..." style={{ width: "100%", padding: "8px 10px", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={handleAnalyze} disabled={busy || !text.trim()} style={{ padding: "8px 20px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{busy ? "LÄUFT..." : "ANALYSIEREN"}</button>
      {report && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>HOOKS</div><div style={{ fontSize: 20, fontWeight: 700 }}>{report.hooks.length}</div></div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}><div style={{ color: DIM, fontSize: 10 }}>Ø STÄRKE</div><div style={{ fontSize: 20, fontWeight: 700 }}>{report.averageStrength}%</div></div>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>HOKS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {report.hooks.slice(0, 8).map((h) => (
                <div key={h.hook.slice(0, 20)} style={{ background: BG, border: `1px solid ${BORDER}`, padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12 }}>{h.hook.slice(0, 60)}...</span>
                    <span style={{ color: h.strength > 60 ? "#44ff88" : h.strength > 40 ? AMBER : "#ff4444", fontSize: 11 }}>{h.strength}%</span>
                  </div>
                  <div style={{ color: DIM, fontSize: 10 }}>{h.type} • {h.wordCount} Wörter</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
