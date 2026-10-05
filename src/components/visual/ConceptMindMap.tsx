// ConceptMindMap (WP 50.1): Interaktive Vektor-Mind-Map & Ideen-Canvas.
//
// Erstellen, Verschieben und Verknüpfen von Knoten mit farbigen
// Beziehungspfeilen, Auto-Layout und SVG-Export.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useState } from "react";
import {
  createMindMap,
  addNode,
  connectNodes,
  autoLayout,
  exportToSvg,
  type MindMap,
  type MindNode,
} from "@/services/visual/conceptMindMap";

export interface ConceptMindMapProps {
  className?: string;
}

const NODE_KINDS: { id: MindNode["kind"]; label: string; icon: string }[] = [
  { id: "idea", label: "Idee", icon: "💡" },
  { id: "character", label: "Figur", icon: "👤" },
  { id: "motive", label: "Motiv", icon: "🎯" },
  { id: "conflict", label: "Konflikt", icon: "⚔️" },
];

export function ConceptMindMap({ className }: ConceptMindMapProps) {
  const [map, setMap] = useState<MindMap>(() => createMindMap("Neue Mind-Map"));
  const [selectedKind, setSelectedKind] = useState<MindNode["kind"]>("idea");
  const [nodeLabel, setNodeLabel] = useState("");
  const [connectFrom, setConnectFrom] = useState("");
  const [connectTo, setConnectTo] = useState("");
  const [relation, setRelation] = useState("");
  const [svg, setSvg] = useState("");

  const handleAddNode = useCallback(() => {
    if (!nodeLabel.trim()) return;
    const node: MindNode = {
      id: `n-${Date.now()}`,
      label: nodeLabel.trim(),
      kind: selectedKind,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      color: "",
    };
    setMap(addNode(map, node));
    setNodeLabel("");
  }, [map, nodeLabel, selectedKind]);

  const handleConnect = useCallback(() => {
    if (!connectFrom || !connectTo || !relation.trim()) return;
    setMap(connectNodes(map, connectFrom, connectTo, relation.trim()));
    setConnectFrom("");
    setConnectTo("");
    setRelation("");
  }, [map, connectFrom, connectTo, relation]);

  const handleAutoLayout = useCallback(() => {
    setMap(autoLayout(map));
  }, [map]);

  const handleExport = useCallback(() => {
    setSvg(exportToSvg(map));
  }, [map]);

  return (
    <div
      className={className}
      data-testid="concept-mind-map"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🧠 {map.title}
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {map.nodes.length} Knoten · {map.connections.length} Verbindungen
      </div>

      {/* Knoten hinzufügen */}
      <div data-testid="mindmap-add" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KNOTEN HINZUFÜGEN</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {NODE_KINDS.map((k) => (
            <button
              key={k.id}
              data-testid={`mindmap-kind-${k.id}`}
              onClick={() => setSelectedKind(k.id)}
              style={{
                background: selectedKind === k.id ? "var(--accent)" : "transparent",
                color: selectedKind === k.id ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            data-testid="mindmap-node-label"
            placeholder="Knotenname..."
            value={nodeLabel}
            onChange={(e) => setNodeLabel(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <button
            data-testid="mindmap-add-node"
            onClick={handleAddNode}
            disabled={!nodeLabel.trim()}
            style={{
              background: nodeLabel.trim() ? "var(--accent)" : "transparent",
              color: nodeLabel.trim() ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: nodeLabel.trim() ? "pointer" : "not-allowed",
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Verbinden */}
      <div data-testid="mindmap-connect" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KNOTEN VERBINDEN</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select
            data-testid="mindmap-connect-from"
            value={connectFrom}
            onChange={(e) => setConnectFrom(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          >
            <option value="">Von...</option>
            {map.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          <select
            data-testid="mindmap-connect-to"
            value={connectTo}
            onChange={(e) => setConnectTo(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          >
            <option value="">Nach...</option>
            {map.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            data-testid="mindmap-relation"
            placeholder="Beziehung (z.B. 'verursacht')..."
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <button
            data-testid="mindmap-connect-btn"
            onClick={handleConnect}
            disabled={!connectFrom || !connectTo || !relation.trim()}
            style={{
              background: connectFrom && connectTo && relation.trim() ? "var(--accent)" : "transparent",
              color: connectFrom && connectTo && relation.trim() ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: connectFrom && connectTo && relation.trim() ? "pointer" : "not-allowed",
            }}
          >
            Verbinden
          </button>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          data-testid="mindmap-auto-layout"
          onClick={handleAutoLayout}
          style={{
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "5px 12px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Auto-Layout
        </button>
        <button
          data-testid="mindmap-export"
          onClick={handleExport}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          SVG exportieren
        </button>
      </div>

      {/* Knoten-Liste */}
      <div data-testid="mindmap-nodes" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KNOTEN</div>
        {map.nodes.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Noch keine Knoten.</div>
        )}
        {map.nodes.map((n) => (
          <div
            key={n.id}
            data-testid={`mindmap-node-${n.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "4px 8px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
            }}
          >
            <span>{n.label}</span>
            <span style={{ color: "var(--muted)", fontSize: 9 }}>{n.kind}</span>
          </div>
        ))}
      </div>

      {/* Verbindungen */}
      {map.connections.length > 0 && (
        <div data-testid="mindmap-connections" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>VERBINDUNGEN</div>
          {map.connections.map((c) => (
            <div key={c.id} data-testid={`mindmap-connection-${c.id}`} style={{ fontSize: 11, marginBottom: 2 }}>
              {c.fromId} → {c.toId} <span style={{ color: "var(--muted)" }}>({c.relation})</span>
            </div>
          ))}
        </div>
      )}

      {/* SVG-Output */}
      {svg && (
        <pre
          data-testid="mindmap-svg-output"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            maxHeight: 200,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {svg}
        </pre>
      )}
    </div>
  );
}
