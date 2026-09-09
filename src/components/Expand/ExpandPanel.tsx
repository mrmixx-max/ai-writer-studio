// ExpandPanel (Sprint 26, Agent 4): Textausweitung mit Details.
import { useState, useCallback } from "react";
import {
  expandText,
  expandAll,
  EXPAND_TECHNIQUES,
  type ExpandResult,
} from "@/services/expand/expandEngine";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function ExpandPanel() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<ExpandResult[]>([]);
  const [busy, setBusy] = useState(false);

  const handleExpand = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setResults(expandAll(text));
    } finally {
      setBusy(false);
    }
  }, [text]);

  const handleSingleTechnique = useCallback((id: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setResults([expandText(text, id)]);
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        📐 EXPAND
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

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={handleExpand} disabled={busy || !text.trim()}
          style={{ padding: "6px 14px", background: busy || !text.trim() ? DIM : AMBER, color: "#000", border: "none", cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}>
          {busy ? "LÄUFT..." : "ALLE"}
        </button>
        {EXPAND_TECHNIQUES.map((t) => (
          <button key={t.id} onClick={() => handleSingleTechnique(t.id)} disabled={busy || !text.trim()}
            style={{ padding: "6px 14px", background: PANEL, color: CYAN, border: `1px solid ${CYAN}`, cursor: busy || !text.trim() ? "not-allowed" : "pointer", fontSize: 11 }}>
            {t.name}
          </button>
        ))}
      </div>

      {results.map((res, i) => (
        <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 8 }}>
          <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            {EXPAND_TECHNIQUES.find((t) => t.id === res.technique)?.name ?? res.technique}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{res.expanded}</div>
          {res.additions.length > 0 && (
            <div style={{ color: DIM, fontSize: 10, marginTop: 6 }}>
              +{res.additions.length} Details hinzugefügt
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
