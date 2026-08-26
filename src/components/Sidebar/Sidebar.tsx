// Sidebar mit Avantgarde-Modus-Switcher + Projekt-Baum.
import { useState, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { usePromptStore } from "@/store/promptStore";
import { PromptGenerator } from "@/components/PromptGenerator/PromptGenerator";
import { FragmentPanel } from "@/components/Fragment/FragmentPanel";
import { VoiceLab } from "@/components/VoiceLab/VoiceLab";
import { SemanticMap } from "@/components/SemanticMap/SemanticMap";
import { DialoguePanel } from "@/components/Dialogue/DialoguePanel";
import { VersionsPanel } from "@/components/Versions/VersionsPanel";
import { ObstructionPanel } from "@/components/Obstruction/ObstructionPanel";
import { DreamLogicPanel } from "@/components/DreamLogic/DreamLogicPanel";
import {
  renameProject, renameChapter, deleteProject, deleteChapter,
} from "@/services/project";
import type { EditorMode } from "@/types/mode";

const MODES: { id: EditorMode; label: string; icon: string }[] = [
  { id: "editor", label: "Editor", icon: "📝" },
  { id: "prompts", label: "Prompts", icon: "💡" },
  { id: "fragments", label: "Fragmente", icon: "🧩" },
  { id: "voices", label: "Stimmen", icon: "🎭" },
  { id: "map", label: "Karte", icon: "🗺️" },
  { id: "dialogue", label: "Dialog", icon: "💬" },
  { id: "versions", label: "Versionen", icon: "🕐" },
  { id: "obstruction", label: "Obstruktion", icon: "⛓️" },
  { id: "dream", label: "Traumlogik", icon: "🌙" },
];

export function Sidebar() {
  const [tab, setTab] = useState<"projects" | "prompts">("projects");
  const [mode, setMode] = useState<EditorMode>("editor");
  const proj = useProjectStore();
  const prompt = usePromptStore();

  useEffect(() => {
    proj.refresh();
  }, []);

  // Avantgarde-Modus aktiv?
  if (mode !== "editor" && mode !== "prompts") {
    return (
      <aside className="sidebar">
        <nav className="mode-switcher">
          {MODES.map((m) => (
            <button
              key={m.id}
              title={m.label}
              className={mode === m.id ? "active" : ""}
              onClick={() => setMode(m.id)}
            >
              {m.icon}
            </button>
          ))}
        </nav>
        <div className="sidebar-content">
          <ModePanel mode={mode} projectId={proj.activeProjectId} chapterId={proj.activeChapterId} />
        </div>
      </aside>
    );
  }

  if (tab === "prompts") {
    return (
      <aside className="sidebar">
        <nav className="sidebar-tabs">
          <button onClick={() => setTab("projects")}>📁 Projekte</button>
          <button className="active" onClick={() => prompt.set("tab", "generate")}>💡 Prompts</button>
        </nav>
        <div className="sidebar-content"><PromptGenerator /></div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-tabs">
        <button className="active" onClick={() => setTab("projects")}>📁 Projekte</button>
        <button onClick={() => setTab("prompts")}>💡 Prompts</button>
      </nav>
      <div className="sidebar-content">
        <div className="project-toolbar">
          <button onClick={() => { const n = promptName(); if (n) proj.newProject(n); }}>+ Projekt</button>
          {proj.activeProjectId && (
            <button onClick={() => { const t = promptChapter(); if (t) proj.newChapter(t); }}>+ Kapitel</button>
          )}
        </div>
        <ul className="project-tree">
          {proj.projects.map((p) => (
            <li key={p.id} className={proj.activeProjectId === p.id ? "active" : ""}>
              <div className="node" onClick={() => proj.openProject(p.id)}>
                📁 {p.name}
                <span className="node-actions">
                  <button onClick={(e) => { e.stopPropagation(); const n = renamePrompt(p.name); if (n) { renameProject(p.id, n); proj.refresh(); } }}>✎</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Projekt löschen?")) { deleteProject(p.id); proj.refresh(); } }}>🗑</button>
                </span>
              </div>
              {proj.activeProjectId === p.id && (
                <ul className="chapter-tree">
                  {proj.chapters.map((c) => (
                    <li key={c.id} className={proj.activeChapterId === c.id ? "active" : ""}>
                      <div className="node" onClick={() => proj.openChapter(c.id)}>
                        📄 {c.title}
                        <span className="node-actions">
                          <button onClick={(e) => { e.stopPropagation(); const n = renamePrompt(c.title); if (n) { renameChapter(c.id, n); proj.openProject(p.id); } }}>✎</button>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm("Kapitel löschen?")) { deleteChapter(c.id); proj.openProject(p.id); } }}>🗑</button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// Rendert das Panel für den aktiven Avantgarde-Modus.
function ModePanel({ mode, projectId, chapterId }: { mode: EditorMode; projectId: string | null; chapterId: string | null }) {
  if (!projectId || !chapterId) {
    return <div className="mode-placeholder">Wähle links ein Projekt und Kapitel, um die Avantgarde-Funktionen zu nutzen.</div>;
  }
  switch (mode) {
    case "fragments":
      return <FragmentPanel chapterId={chapterId} />;
    case "voices":
      return <VoiceLab text="(Text aus Editor wählen)" />;
    case "map":
      return <SemanticMap projectId={projectId} />;
    case "dialogue":
      return <DialoguePanel chapterId={chapterId} text="(Text aus Editor wählen)" />;
    case "versions":
      return <VersionsPanel chapterId={chapterId} content="(Inhalt)" />;
    case "obstruction":
      return <ObstructionPanel text="(Text aus Editor wählen)" />;
    case "dream":
      return <DreamLogicPanel text="(Text aus Editor wählen)" />;
    default:
      return null;
  }
}

function promptName(): string | null {
  const v = window.prompt("Projektname:");
  return v && v.trim() ? v.trim() : null;
}
function promptChapter(): string | null {
  const v = window.prompt("Kapitel-Titel:");
  return v && v.trim() ? v.trim() : null;
}
function renamePrompt(current: string): string | null {
  const v = window.prompt("Neuer Name:", current);
  return v && v.trim() ? v.trim() : null;
}
