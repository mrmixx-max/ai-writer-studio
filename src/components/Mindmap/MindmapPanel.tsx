// MindmapPanel (Sprint 25, Agent 2): interaktive Mindmap mit Canvas,
// Zoom/Pan, Mermaid-Export und Auto-Layout.
// Bloomberg-Terminal-Stil (Inline-Styles, keine neuen Dependencies).
import { useEffect, useRef, useState, useCallback } from "react";
import {
  generateFromText,
  addNode,
  removeNode,
  updateNode,
  exportToMermaid,
  type Mindmap,
  type MindmapNode,
} from "@/services/mindmap/mindmap";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

interface NodePosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  depth: number;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function layoutTree(root: MindmapNode): NodePosition[] {
  const positions: NodePosition[] = [];
  const NODE_W = 140;
  const NODE_H = 32;
  const GAP_X = 40;
  const GAP_Y = 60;

  const countLeaves = (n: MindmapNode): number => {
    if (n.children.length === 0) return 1;
    return n.children.reduce((s, c) => s + countLeaves(c), 0);
  };

  const place = (node: MindmapNode, depth: number, leftBound: number, rightBound: number): void => {
    const x = (leftBound + rightBound) / 2 - NODE_W / 2;
    const y = 20 + depth * GAP_Y;
    positions.push({ id: node.id, x, y, w: NODE_W, h: NODE_H, label: node.label, depth });
    if (node.children.length === 0) return;
    const totalLeaves = countLeaves(node);
    if (totalLeaves === 0) return;
    const widthPerLeaf = (rightBound - leftBound) / totalLeaves;
    let cursor = leftBound;
    for (const child of node.children) {
      const childLeaves = countLeaves(child);
      const childWidth = widthPerLeaf * childLeaves;
      place(child, depth + 1, cursor, cursor + childWidth);
      cursor += childWidth;
    }
  };

  place(root, 0, 0, Math.max(800, countLeaves(root) * (NODE_W + GAP_X)));
  return positions;
}

export function MindmapPanel() {
  const [text, setText] = useState("");
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [mermaidExport, setMermaidExport] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ type: "pan" | "node"; startX: number; startY: number; camX: number; camY: number; nodeId?: string } | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    const mm = await generateFromText(text);
    setMindmap(mm);
    setSelected(null);
    setMermaidExport(null);
    if (mm.nodes.length > 0) {
      setPositions(layoutTree(mm.nodes[0]));
      setCamera({ x: 0, y: 0, zoom: 1 });
    } else {
      setPositions([]);
    }
  }, [text]);

  const handleAddNode = () => {
    if (!mindmap || !selected || !newNodeLabel.trim()) return;
    addNode(mindmap, selected, newNodeLabel.trim());
    setMindmap({ ...mindmap });
    if (mindmap.nodes[0]) setPositions(layoutTree(mindmap.nodes[0]));
    setNewNodeLabel("");
  };

  const handleRemoveNode = (id: string) => {
    if (!mindmap) return;
    removeNode(mindmap, id);
    setMindmap({ ...mindmap });
    if (mindmap.nodes.length > 0 && mindmap.nodes[0]) {
      setPositions(layoutTree(mindmap.nodes[0]));
    } else {
      setPositions([]);
    }
    if (selected === id) setSelected(null);
  };

  const handleUpdateNode = () => {
    if (!mindmap || !selected || !editLabel.trim()) return;
    updateNode(mindmap, selected, editLabel.trim());
    setMindmap({ ...mindmap });
    if (mindmap.nodes[0]) setPositions(layoutTree(mindmap.nodes[0]));
  };

  const handleExportMermaid = async () => {
    if (!mindmap) return;
    const mermaid = await exportToMermaid(mindmap);
    setMermaidExport(mermaid);
  };

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = canvas.clientWidth);
    const H = (canvas.height = canvas.clientHeight);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(camera.x + W / 2, camera.y + H / 2);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw edges
    if (mindmap) {
      const nodeMap = new Map(positions.map((p) => [p.id, p]));
      const drawEdges = (node: MindmapNode) => {
        const parent = nodeMap.get(node.id);
        if (!parent) return;
        for (const child of node.children) {
          const childPos = nodeMap.get(child.id);
          if (childPos) {
            ctx.beginPath();
            ctx.moveTo(parent.x + parent.w / 2, parent.y + parent.h / 2);
            ctx.lineTo(childPos.x + childPos.w / 2, childPos.y + childPos.h / 2);
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          drawEdges(child);
        }
      };
      if (mindmap.nodes.length > 0) drawEdges(mindmap.nodes[0]);
    }

    // Draw nodes
    for (const p of positions) {
      const isSelected = p.id === selected;
      ctx.fillStyle = p.depth === 0 ? AMBER : isSelected ? CYAN : PANEL;
      ctx.strokeStyle = isSelected ? CYAN : p.depth === 0 ? AMBER : BORDER;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = p.depth === 0 ? "#000" : TEXT;
      ctx.font = "11px monospace";
      const label = p.label.length > 18 ? p.label.slice(0, 18) + "…" : p.label;
      ctx.fillText(label, p.x + 6, p.y + p.h / 2 + 4);
    }

    ctx.restore();
  }, [mindmap, positions, camera, selected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Check if clicked on a node
    const W = rect.width;
    const H = rect.height;
    for (const p of positions) {
      const nx = (p.x - camera.x) * camera.zoom + (W / 2 - camera.x * camera.zoom);
      const ny = (p.y - camera.y) * camera.zoom + (H / 2 - camera.y * camera.zoom);
      const nw = p.w * camera.zoom;
      const nh = p.h * camera.zoom;
      if (mx >= nx && mx <= nx + nw && my >= ny && my <= ny + nh) {
        setSelected(p.id);
        setEditLabel(p.label);
        dragRef.current = { type: "node", startX: mx, startY: my, camX: camera.x, camY: camera.y, nodeId: p.id };
        return;
      }
    }
    dragRef.current = { type: "pan", startX: mx, startY: my, camX: camera.x, camY: camera.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - dragRef.current.startX;
    const dy = my - dragRef.current.startY;
    if (dragRef.current.type === "pan") {
      setCamera((c) => ({ ...c, x: dragRef.current!.camX + dx, y: dragRef.current!.camY + dy }));
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleZoom = (delta: number) => {
    setCamera((c) => ({ ...c, zoom: Math.max(0.3, Math.min(3, c.zoom + delta)) }));
  };

  return (
    <div
      data-testid="mindmap-panel"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "monospace",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h3 style={{ margin: 0, color: AMBER, fontSize: 15 }}>🧠 MINDMAP</h3>

      <textarea
        data-testid="mindmap-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text hier einfügen, um eine Mindmap zu generieren…"
        rows={4}
        style={{
          background: PANEL,
          color: TEXT,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          padding: 8,
          fontFamily: "monospace",
          fontSize: 12,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          data-testid="mindmap-generate"
          onClick={handleGenerate}
          disabled={!text.trim()}
          style={{
            background: AMBER,
            color: "#000",
            border: "none",
            borderRadius: 4,
            padding: "6px 12px",
            cursor: text.trim() ? "pointer" : "not-allowed",
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          ▶ Generieren
        </button>
        <button
          onClick={() => handleZoom(0.2)}
          style={{ background: PANEL, color: CYAN, border: `1px solid ${CYAN}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}
        >
          +
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          style={{ background: PANEL, color: CYAN, border: `1px solid ${CYAN}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}
        >
          −
        </button>
        <button
          onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
          style={{ background: PANEL, color: DIM, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}
        >
          ⊙ Reset
        </button>
        {mindmap && (
          <button
            data-testid="mindmap-export-mermaid"
            onClick={handleExportMermaid}
            style={{ background: PANEL, color: AMBER, border: `1px solid ${AMBER}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}
          >
            ⤓ Mermaid
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        data-testid="mindmap-canvas"
        style={{
          width: "100%",
          height: 320,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          cursor: "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {selected && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            data-testid="mindmap-edit-input"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            style={{ background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", fontFamily: "monospace", fontSize: 12 }}
          />
          <button
            data-testid="mindmap-update-node"
            onClick={handleUpdateNode}
            style={{ background: PANEL, color: CYAN, border: `1px solid ${CYAN}`, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "monospace" }}
          >
            ✓ OK
          </button>
          <input
            data-testid="mindmap-new-node-input"
            value={newNodeLabel}
            onChange={(e) => setNewNodeLabel(e.target.value)}
            placeholder="Neuer Unterknoten…"
            style={{ background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", fontFamily: "monospace", fontSize: 12 }}
          />
          <button
            data-testid="mindmap-add-node"
            onClick={handleAddNode}
            disabled={!newNodeLabel.trim()}
            style={{ background: PANEL, color: AMBER, border: `1px solid ${AMBER}`, borderRadius: 4, padding: "4px 10px", cursor: newNodeLabel.trim() ? "pointer" : "not-allowed", fontFamily: "monospace" }}
          >
            + Hinzufügen
          </button>
          <button
            data-testid="mindmap-remove-node"
            onClick={() => handleRemoveNode(selected)}
            style={{ background: PANEL, color: "#ff5252", border: "1px solid #ff5252", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "monospace" }}
          >
            🗑 Löschen
          </button>
        </div>
      )}

      {mermaidExport && (
        <pre
          data-testid="mindmap-mermaid-output"
          style={{
            background: PANEL,
            color: CYAN,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: 8,
            fontSize: 11,
            overflow: "auto",
            maxHeight: 120,
          }}
        >
          {mermaidExport}
        </pre>
      )}
    </div>
  );
}
