// OutlinerPanel (Sprint 22, Agent 5): Baumansicht mit Einrueckung, Drag & Drop,
// Knoten-Bearbeitung (inline), Auf/Zu-Pfeilen, Markdown Export/Import und
// "Als Projekt erstellen".
//
// Standalone-Panel — arbeitet gegen eine eigene OutlinerEngine-Instanz;
// die Projekt-Erstellung ist ueber `onCreateProject` injizierbar
// (Mock in Tests, Default: projectStore).
//
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono). Inline-Stile, keine geteilte CSS-Datei.

import { useRef, useState } from "react";
import {
  OutlinerEngine,
  type Outline,
  type OutlineNode,
} from "@/services/outliner/outliner";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/i18n";

export interface OutlinerPanelProps {
  initialTitle?: string;
  /** Startinhalt als Markdown (wird einmalig beim Mount importiert). */
  initialMarkdown?: string;
  /** Injizierbar (Mock in Tests, Default: projectStore). */
  onCreateProject?: (outline: Outline) => void;
  /** Test-Hook: erhaelt das exportierte Markdown. */
  onExport?: (markdown: string) => void;
  className?: string;
}

const ACCENT = "#ffa028";

const rootStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 4,
  padding: 12,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 13,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const buttonStyle: React.CSSProperties = {
  background: "#111",
  color: ACCENT,
  border: "1px solid #333",
  borderRadius: 3,
  padding: "4px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const nodeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "1px 6px",
  lineHeight: 1.4,
};

function chapterContent(node: OutlineNode): string {
  const parts: string[] = [];
  if (node.content) parts.push(node.content);
  for (const child of node.children) {
    parts.push(`## ${child.title}`);
    if (child.content) parts.push(child.content);
  }
  return parts.join("\n\n");
}

function defaultCreateProject(outline: Outline): void {
  const store = useProjectStore.getState();
  store.newProject(outline.title || "Unbenannte Gliederung");
  for (const node of outline.nodes) {
    store.newChapter(node.title, chapterContent(node));
  }
}

export function OutlinerPanel({
  initialTitle = "Unbenannte Gliederung",
  initialMarkdown,
  onCreateProject,
  onExport,
  className,
}: OutlinerPanelProps) {
  const { t } = useI18n();
  const engineRef = useRef<OutlinerEngine | null>(null);
  if (!engineRef.current) {
    const engine = new OutlinerEngine(initialTitle);
    if (initialMarkdown) engine.importMarkdown(initialMarkdown);
    engineRef.current = engine;
  }
  const engine = engineRef.current;
  const [, setRev] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const bump = () => setRev((r) => r + 1);

  const outline = engine.getOutline();

  const handleAddRoot = () => {
    engine.addNode(null, t("outliner.newNode"));
    bump();
  };

  const handleExport = () => {
    const md = engine.toMarkdown();
    onExport?.(md);
    try {
      const blob = new Blob([md], { type: "text/markdown" });
      const createUrl = (URL as unknown as { createObjectURL?: (b: Blob) => string })
        .createObjectURL;
      if (typeof createUrl === "function") {
        const url = createUrl.call(URL, blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${outline.title || "gliederung"}.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        throw new Error("kein Download in dieser Umgebung");
      }
    } catch {
      try {
        void navigator.clipboard?.writeText(md);
      } catch {
        /* Clipboard optional — onExport hat das Markdown bereits geliefert. */
      }
    }
  };

  const handleCreateProject = () => {
    (onCreateProject ?? defaultCreateProject)(engine.getOutline());
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    engine.importMarkdown(importText);
    setImportText("");
    setImportOpen(false);
    bump();
  };

  return (
    <section
      className={className}
      aria-label={t("outliner.title")}
      style={rootStyle}
      onDragOver={(e) => {
        // Nur Container-Drops (nicht auf Knoten) → Wurzelebene.
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.target !== e.currentTarget || !dragId) return;
        e.preventDefault();
        engine.moveNode(dragId, null, engine.getOutline().nodes.length);
        setDragId(null);
        bump();
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden="true">🌳</span>
        <strong style={{ color: ACCENT }}>{t("outliner.title")}</strong>
        <span style={{ color: "#888" }}>
          ({outline.nodes.length} {outline.nodes.length === 1 ? "Knoten" : "Knoten"})
        </span>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" style={buttonStyle} onClick={handleAddRoot}>
          {t("outliner.addRoot")}
        </button>
        <button type="button" style={buttonStyle} onClick={handleCreateProject}>
          {t("outliner.createProject")}
        </button>
        <button type="button" style={buttonStyle} onClick={handleExport}>
          {t("outliner.exportMarkdown")}
        </button>
        <button type="button" style={buttonStyle} onClick={() => setImportOpen((v) => !v)}>
          {t("outliner.importMarkdown")}
        </button>
      </div>

      {importOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            aria-label={t("outliner.importMarkdown")}
            placeholder={t("outliner.importPh")}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            style={{
              background: "#0a0a0a",
              color: "#e8e8e8",
              border: "1px solid #333",
              borderRadius: 3,
              fontFamily: "inherit",
              fontSize: 12,
              padding: 6,
            }}
          />
          <button type="button" style={buttonStyle} onClick={handleImport}>
            {t("outliner.importMarkdown")}
          </button>
        </div>
      )}

      {outline.nodes.length === 0 ? (
        <p style={{ color: "#888", margin: 0 }}>{t("outliner.emptyHint")}</p>
      ) : (
        <div role="tree" aria-label={t("outliner.title")}>
          {outline.nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              depth={0}
              engine={engine}
              dragId={dragId}
              onDragStart={setDragId}
              onDragEnd={() => setDragId(null)}
              onChange={bump}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface NodeRowProps {
  node: OutlineNode;
  depth: number;
  engine: OutlinerEngine;
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onChange: () => void;
}

function NodeRow({ node, depth, engine, dragId, onDragStart, onDragEnd, onChange }: NodeRowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const hasChildren = node.children.length > 0;
  const isDragOver = dragId !== null && dragId !== node.id;

  const commitEdit = () => {
    const title = draft.trim() || t("outliner.newNode");
    engine.renameNode(node.id, title);
    setEditing(false);
    onChange();
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? !node.collapsed : undefined} aria-level={depth + 1}>
      <div
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          try {
            e.dataTransfer.setData("text/plain", node.id);
          } catch {
            /* jsdom kennt dataTransfer nur teilweise */
          }
          onDragStart(node.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (isDragOver) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!dragId || dragId === node.id) return;
          e.preventDefault();
          e.stopPropagation();
          engine.moveNode(dragId, node.id, node.children.length);
          onDragEnd();
          onChange();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: depth * 18,
          paddingTop: 2,
          paddingBottom: 2,
          outline: dragId === node.id ? `1px dashed ${ACCENT}` : undefined,
          background: isDragOver ? "#1a1206" : undefined,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={node.collapsed ? t("outliner.expand") : t("outliner.collapse")}
            style={{ ...nodeButtonStyle, minWidth: 24 }}
            onClick={() => {
              engine.toggleCollapse(node.id);
              onChange();
            }}
          >
            <span aria-hidden="true">{node.collapsed ? "▸" : "▾"}</span>
          </button>
        ) : (
          <span aria-hidden="true" style={{ minWidth: 24, textAlign: "center", color: "#555" }}>
            ·
          </span>
        )}
        {editing ? (
          <input
            aria-label={t("outliner.titlePh")}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              flex: 1,
              background: "#0a0a0a",
              color: "#e8e8e8",
              border: `1px solid ${ACCENT}`,
              borderRadius: 3,
              fontFamily: "inherit",
              fontSize: 13,
              padding: "1px 6px",
            }}
          />
        ) : (
          <span
            onDoubleClick={() => {
              setDraft(node.title);
              setEditing(true);
            }}
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {node.title}
          </span>
        )}
        <button
          type="button"
          aria-label={`${t("outliner.addChild")}: ${node.title}`}
          title={t("outliner.addChild")}
          style={nodeButtonStyle}
          onClick={() => {
            engine.addNode(node.id, t("outliner.newNode"));
            if (node.collapsed) engine.toggleCollapse(node.id);
            onChange();
          }}
        >
          +
        </button>
        {!editing && (
          <button
            type="button"
            aria-label={`${t("outliner.renameNode")}: ${node.title}`}
            title={t("outliner.renameNode")}
            style={nodeButtonStyle}
            onClick={() => {
              setDraft(node.title);
              setEditing(true);
            }}
          >
            ✎
          </button>
        )}
        <button
          type="button"
          aria-label={`${t("outliner.deleteNode")}: ${node.title}`}
          title={t("outliner.deleteNode")}
          style={nodeButtonStyle}
          onClick={() => {
            engine.removeNode(node.id);
            onChange();
          }}
        >
          🗑
        </button>
      </div>
      {hasChildren && !node.collapsed && (
        <div role="group">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              engine={engine}
              dragId={dragId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
