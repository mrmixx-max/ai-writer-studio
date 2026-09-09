// CharacterNetworkPanel (Sprint 27, Agent 3): Beziehungsnetzwerk.
import { useState, useCallback } from "react";
import {
  buildCharacterNetwork,
  generateNetworkAscii,
  type CharacterNetwork,
} from "@/services/network/characterNetwork";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export function CharacterNetworkPanel() {
  const [text, setText] = useState("");
  const [network, setNetwork] = useState<CharacterNetwork | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setNetwork(buildCharacterNetwork(text, []));
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🌐 CHARAKTER-NETZWERK
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

      {network && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>KNOTEN</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{network.nodes.length}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>KANTEN</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{network.edges.length}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>DICHTE</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{network.density}</div>
            </div>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>NETZWERK</div>
            <pre style={{ fontSize: 10, lineHeight: 1.4, color: CYAN, overflowX: "auto" }}>
              {generateNetworkAscii(network)}
            </pre>
          </div>

          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>VERBUNDEN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {network.nodes.sort((a, b) => b.connections - a.connections).map((node) => (
                <div key={node.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>{node.label}</span>
                  <span style={{ color: DIM }}>{node.connections}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
