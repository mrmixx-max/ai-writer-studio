// Semantische Kartografie: Graph-Ansicht mit Knoten + Kanten.
import { useState, useEffect } from "react";
import { listNodes, listEdges, createNode, createEdge } from "@/services/semantic";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

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

  useEffect(() => {
    setNodes(listNodes(projectId));
    setEdges(listEdges(projectId));
  }, [projectId]);

  async function addNode() {
    const label = window.prompt("Bezeichnung:");
    if (!label) return;
    const type = window.prompt(`Typ (${NODE_TYPES.join(", ")}):`, "Figur") ?? "Figur";
    await createNode(projectId, label, type, "", Math.random() * 600, Math.random() * 400);
    setNodes(listNodes(projectId));
  }

  async function linkNodes() {
    if (!selected) return;
    const target = window.prompt("Verbinden mit (Node-ID oder Label):");
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
      DEFAULT_SETTINGS,
      {
        action: "brainstorming",
        selection: `Projekt-Elemente: ${summary}\n\nFragen:\n1. Welche Figur ist unterentwickelt?\n2. Welche Motive tauchen auf, ohne aufgelöst zu werden?\n3. Wo sind blinde Flecken?`,
        context: "",
      },
      () => {},
    );
    alert(res.text);
    setBusy(false);
  }

  return (
    <div className="semantic-map">
      <div className="map-toolbar">
        <button onClick={addNode}>+ Knoten</button>
        <button onClick={linkNodes} disabled={!selected}>Verbinden</button>
        <button onClick={aiAnalyze} disabled={busy}>KI-Analyse</button>
      </div>
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
