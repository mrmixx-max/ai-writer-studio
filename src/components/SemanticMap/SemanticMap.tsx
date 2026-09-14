// Semantische Kartografie: Graph-Ansicht mit Knoten + Kanten.
// Dialoge über AppDialog (keine nativen window.prompt/alert — WebView2-tot).
import { useState, useEffect } from "react";
import { listNodes, listEdges, createNode, createEdge } from "@/services/semantic";
import { runKIAction } from "@/services/ki";
import { loadSettings } from "@/services/settings";
import { AppDialog, type DialogRequest } from "@/components/Dialog/AppDialog";

const NODE_TYPES = ["Figur", "Motiv", "Ort", "Konflikt", "Begriff"];
const COLORS: Record<string, string> = {
  Figur: "#4ec9b0",
  Motif: "#dcdcaa",
  Ort: "#569cd6",
  Konflikt: "#f44747",
  Begriff: "#c586c0",
};

export function SemanticMap({ projectId }: { projectId: string }) {
  const [nodes, setNodes] = useState(listNodes(projectId));
  const [edges, setEdges] = useState(listEdges(projectId));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<DialogRequest | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  useEffect(() => {
    setNodes(listNodes(projectId));
    setEdges(listEdges(projectId));
  }, [projectId]);

  function ask(label: string, initial = "") {
    return new Promise<string | null>((resolve) =>
      setDlg({ kind: "prompt", label, initial, resolve }),
    );
  }

  async function addNode() {
    const label = await ask("Bezeichnung:");
    if (!label) return;
    const type = (await ask(`Typ (${NODE_TYPES.join(", ")}):`, "Figur")) ?? "Figur";
    await createNode(projectId, label, type, "", Math.random() * 600, Math.random() * 400);
    setNodes(listNodes(projectId));
  }

  async function linkNodes() {
    if (!selected) return;
    const target = await ask("Verbinden mit (Node-ID oder Label):");
    if (!target) return;
    const targetNode = nodes.find((n) => n.id === target || n.label === target);
    if (!targetNode) return;
    await createEdge(projectId, selected, targetNode.id);
    setEdges(listEdges(projectId));
  }

  async function aiAnalyze() {
    setBusy(true);
    const summary = nodes.map((n) => `${n.label} (${n.nodeType})`).join(", ");
    const res = await runKIAction(
      loadSettings(),
      {
        action: "brainstorming",
        selection: `Projekt-Elemente: ${summary}\n\nFragen:\n1. Welche Figur ist unterentwickelt?\n2. Welche Motive tauchen auf, ohne aufgelöst zu werden?\n3. Wo sind blinde Flecken?`,
        context: "",
      },
      () => {},
    );
    setAnalysis(res.text);
    setBusy(false);
  }

  return (
    <div className="semantic-map">
      <AppDialog request={dlg} onDone={() => setDlg(null)} />
      <div className="map-toolbar">
        <button onClick={addNode}>+ Knoten</button>
        <button onClick={linkNodes} disabled={!selected}>Verbinden</button>
        <button onClick={aiAnalyze} disabled={busy}>KI-Analyse</button>
      </div>
      {analysis && (
        <div className="map-analysis" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <strong>KI-Analyse</strong>
            <button onClick={() => setAnalysis(null)}>×</button>
          </div>
          {analysis}
        </div>
      )}
      <svg className="map-canvas" viewBox="0 0 800 500">
        {edges.map((e) => {
          const s = nodes.find((n) => n.id === e.sourceId);
          const t = nodes.find((n) => n.id === e.targetId);
          if (!s || !t) return null;
          return (
            <line key={e.id} x1={s.x ?? 0} y1={s.y ?? 0} x2={t.x ?? 0} y2={t.y ?? 0} stroke="#666" strokeWidth={1} />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`} onClick={() => setSelected(n.id)}>
            <circle r={20} fill={COLORS[n.nodeType] ?? "#888"} opacity={selected === n.id ? 1 : 0.7} />
            <text y={35} textAnchor="middle" fill="var(--fg)" fontSize={10}>{n.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
