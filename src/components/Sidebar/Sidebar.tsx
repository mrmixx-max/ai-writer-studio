// Sidebar mit Avantgarde-Modus-Switcher + Projekt-Baum.
import { memo, useCallback, useMemo, useState, useEffect, lazy, Suspense } from "react";
import type { Project, Chapter } from "@/types/project";
import { useProjectStore } from "@/store/projectStore";
import { usePromptStore } from "@/store/promptStore";

// Lazy-loaded Panels — werden erst beim ersten Zugriff geladen
const PromptGenerator = lazy(() =>
  import("@/components/PromptGenerator/PromptGenerator").then((m) => ({ default: m.PromptGenerator }))
);
const KnowledgePanel = lazy(() =>
  import("@/components/Knowledge/KnowledgePanel").then((m) => ({ default: m.KnowledgePanel }))
);
const DiagnosticsPanel = lazy(() =>
  import("@/components/Diagnostics/DiagnosticsPanel").then((m) => ({ default: m.DiagnosticsPanel }))
);
const PreflightPanel = lazy(() =>
  import("@/components/Preflight/PreflightPanel").then((m) => ({ default: m.PreflightPanel }))
);
const SnapshotPanel = lazy(() =>
  import("@/components/Preflight/SnapshotPanel").then((m) => ({ default: m.SnapshotPanel }))
);
const KdpChecklistPanel = lazy(() =>
  import("@/components/KDP/KdpChecklistPanel").then((m) => ({ default: m.KdpChecklistPanel }))
);
const PublishingAssistantPanel = lazy(() =>
  import("@/components/Publishing/PublishingAssistantPanel").then((m) => ({ default: m.PublishingAssistantPanel }))
);
const FragmentPanel = lazy(() =>
  import("@/components/Fragment/FragmentPanel").then((m) => ({ default: m.FragmentPanel }))
);
const VoiceLab = lazy(() =>
  import("@/components/VoiceLab/VoiceLab").then((m) => ({ default: m.VoiceLab }))
);
const SemanticMap = lazy(() =>
  import("@/components/SemanticMap/SemanticMap").then((m) => ({ default: m.SemanticMap }))
);
const DialoguePanel = lazy(() =>
  import("@/components/Dialogue/DialoguePanel").then((m) => ({ default: m.DialoguePanel }))
);
const VersionsPanel = lazy(() =>
  import("@/components/Versions/VersionsPanel").then((m) => ({ default: m.VersionsPanel }))
);
const ObstructionPanel = lazy(() =>
  import("@/components/Obstruction/ObstructionPanel").then((m) => ({ default: m.ObstructionPanel }))
);
const DreamLogicPanel = lazy(() =>
  import("@/components/DreamLogic/DreamLogicPanel").then((m) => ({ default: m.DreamLogicPanel }))
);
const ImageGenerationPanel = lazy(() =>
  import("@/components/ImageGen/ImageGenPanel").then((m) => ({ default: m.ImageGenerationPanel }))
);
const CoverGenPanel = lazy(() =>
  import("@/components/CoverGen/CoverGenPanel").then((m) => ({ default: m.CoverGenPanel }))
);
const BlurbGenPanel = lazy(() =>
  import("@/components/BlurbGen/BlurbGenPanel").then((m) => ({ default: m.BlurbGenPanel }))
);
const ScientificWritingPanel = lazy(() =>
  import("@/components/ScientificWriting/ScientificWritingPanel").then((m) => ({ default: m.ScientificWritingPanel }))
);
const TimelinePanel = lazy(() =>
  import("@/components/Timeline/TimelinePanel").then((m) => ({ default: m.TimelinePanel }))
);
const WorldbuildingPanel = lazy(() =>
  import("@/components/Worldbuilding/WorldbuildingPanel").then((m) => ({ default: m.WorldbuildingPanel }))
);
const InvestigatePanel = lazy(() =>
  import("@/components/Writing/InvestigatePanel").then((m) => ({ default: m.InvestigatePanel }))
);
const ResearchPanel = lazy(() =>
  import("@/components/Research/ResearchPanel").then((m) => ({ default: m.ResearchPanel }))
);
const CharactersPanel = lazy(() =>
  import("@/components/Characters/CharactersPanel").then((m) => ({ default: m.CharactersPanel }))
);
import {
  renameProject, renameChapter, deleteProject, deleteChapter,
} from "@/services/project";
import type { EditorMode } from "@/types/mode";

const MODES: { id: EditorMode; label: string; icon: string }[] = [
  { id: "editor", label: "Editor", icon: "📝" },
  { id: "prompts", label: "Prompts", icon: "💡" },
  { id: "knowledge", label: "Projektwissen", icon: "📚" },
  { id: "diagnostics", label: "Manuskriptprüfung", icon: "🔍" },
  { id: "preflight", label: "Exportprüfung", icon: "✅" },
  { id: "snapshots", label: "Snapshots", icon: "📂" },
  { id: "kdp", label: "KDP", icon: "🚀" },
  { id: "publishing", label: "Publishing", icon: "📦" },
  { id: "fragments", label: "Fragmente", icon: "🧩" },
  { id: "voices", label: "Stimmen", icon: "🎭" },
  { id: "map", label: "Karte", icon: "🗺️" },
  { id: "dialogue", label: "Dialog", icon: "💬" },
  { id: "versions", label: "Versionen", icon: "🕐" },
  { id: "obstruction", label: "Obstruktion", icon: "⛓️" },
  { id: "dream", label: "Traumlogik", icon: "🌙" },
  { id: "imagegen", label: "Bildgenerierung", icon: "🖼️" },
  { id: "covergen", label: "Cover-Generator", icon: "📚" },
  { id: "blurbgen", label: "Blurb-Generator", icon: "📝" },
  { id: "scientificwriting", label: "Wissenschaft", icon: "🎓" },
  { id: "timeline", label: "Timeline", icon: "📅" },
  { id: "characters", label: "Figuren", icon: "👥" },
  { id: "worldbuilding", label: "Worldbuilding", icon: "🌍" },
  { id: "research", label: "Recherche", icon: "🔎" },
  { id: "investigate", label: "Investigativ", icon: "🕵️" },
];

export function Sidebar() {
  const [tab, setTab] = useState<"projects" | "prompts">("projects");
  const [mode, setMode] = useState<EditorMode>("editor");
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const projects = useProjectStore((s) => s.projects);
  const chapters = useProjectStore((s) => s.chapters);
  const refresh = useProjectStore((s) => s.refresh);
  const newProject = useProjectStore((s) => s.newProject);
  const newChapter = useProjectStore((s) => s.newChapter);
  const openProject = useProjectStore((s) => s.openProject);
  const openChapter = useProjectStore((s) => s.openChapter);
  const prompt = usePromptStore();

  // Stabilisierte Handler: Nur so kann memoized ProjectRow auf Rerenders
  // der Sidebar verzichten, wenn sich Projekt-/Kapitelliste nicht geändert hat.
  const handleRenameProject = useCallback((id: string, name: string) => {
    const n = renamePrompt(name);
    if (n) { renameProject(id, n); refresh(); }
  }, [refresh]);

  const handleDeleteProject = useCallback((id: string) => {
    if (confirm("Projekt löschen?")) { deleteProject(id); refresh(); }
  }, [refresh]);

  const handleRenameChapter = useCallback((pid: string, id: string, title: string) => {
    const n = renamePrompt(title);
    if (n) { renameChapter(id, n); openProject(pid); }
  }, [openProject]);

  const handleDeleteChapter = useCallback((pid: string, id: string) => {
    if (confirm("Kapitel löschen?")) { deleteChapter(id); openProject(pid); }
  }, [openProject]);

  const rowActions = useMemo<RowActions>(() => ({
    onOpenProject: openProject,
    onOpenChapter: openChapter,
    onRenameProject: handleRenameProject,
    onDeleteProject: handleDeleteProject,
    onRenameChapter: handleRenameChapter,
    onDeleteChapter: handleDeleteChapter,
  }), [openProject, openChapter, handleRenameProject, handleDeleteProject, handleRenameChapter, handleDeleteChapter]);

  useEffect(() => {
    refresh();
  }, []);

  // Avantgarde-Modus aktiv? Der Switcher wird weiter unten definiert und hier
  // wiederverwendet — deshalb erst nach dessen Deklaration prüfen.
  const inSpecialMode = mode !== "editor" && mode !== "prompts";

  // Modus-Switcher — MUSS in jedem Zweig erscheinen, sonst sind die
  // Spezialbereiche (Projektwissen, Fragmente, Stimmen …) unerreichbar.
  // Genau dieser Fehler hat alle acht Modi unbenutzbar gemacht.
  const switcher = (
    <nav className="mode-switcher">
      {MODES.map((m) => (
        <button
          key={m.id}
          title={m.label}
          className={mode === m.id ? "active" : ""}
          onClick={() => {
            setMode(m.id);
            // Editor und Prompts sind gleichzeitig Tabs — synchron halten.
            if (m.id === "editor") setTab("projects");
            if (m.id === "prompts") setTab("prompts");
          }}
        >
          {m.icon}
        </button>
      ))}
    </nav>
  );

  if (inSpecialMode) {
    return (
      <aside id="app-sidebar" tabIndex={-1} aria-label="Projektliste" className={`sidebar${mode === "knowledge" || mode === "research" || mode === "diagnostics" || mode === "preflight" || mode === "snapshots" || mode === "kdp" || mode === "publishing" || mode === "investigate" ? " wide" : ""}`}>
        {switcher}
        <div className="sidebar-content">
          <ModePanel mode={mode} projectId={activeProjectId} chapterId={activeChapterId} />
        </div>
      </aside>
    );
  }

  if (tab === "prompts") {
    return (
      <aside id="app-sidebar" tabIndex={-1} aria-label="Projektliste" className="sidebar">
        {switcher}
        <nav className="sidebar-tabs">
          <button onClick={() => { setTab("projects"); setMode("editor"); }}>📁 Projekte</button>
          <button className="active" onClick={() => prompt.set("tab", "generate")}>💡 Prompts</button>
        </nav>
        <div className="sidebar-content"><Suspense fallback={<div className="mode-placeholder">Lädt…</div>}><PromptGenerator /></Suspense></div>
      </aside>
    );
  }

  return (
    <aside id="app-sidebar" tabIndex={-1} aria-label="Projektliste" className="sidebar">
      {switcher}
      <nav className="sidebar-tabs">
        <button className="active" onClick={() => setTab("projects")}>📁 Projekte</button>
        <button onClick={() => { setTab("prompts"); setMode("prompts"); }}>💡 Prompts</button>
      </nav>
      <div className="sidebar-content">
        <div className="project-toolbar">
          <button onClick={() => { const n = promptName(); if (n) newProject(n); }}>+ Projekt</button>
          {activeProjectId && (
            <button onClick={() => { const t = promptChapter(); if (t) newChapter(t); }}>+ Kapitel</button>
          )}
        </div>
        <ul className="project-tree">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              active={activeProjectId === p.id}
              activeChapterId={activeChapterId}
              chapters={activeProjectId === p.id ? chapters : EMPTY_CHAPTERS}
              actions={rowActions}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

// Rendert das Panel für den aktiven Avantgarde-Modus.
// ---------------------------------------------------------------------------
// Memoized Listenzeilen: Ein Tastendruck im Editor rerendert die Sidebar, aber
// nicht jede Projekt-/Kapitelzeile neu, solange sich die Props nicht ändern.
// ---------------------------------------------------------------------------

const EMPTY_CHAPTERS: Chapter[] = [];

type RowActions = {
  onOpenProject: (id: string) => void;
  onOpenChapter: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameChapter: (projectId: string, id: string, title: string) => void;
  onDeleteChapter: (projectId: string, id: string) => void;
};

const ChapterRow = memo(function ChapterRow({
  chapter, projectId, active, actions,
}: {
  chapter: Chapter;
  projectId: string;
  active: boolean;
  actions: RowActions;
}) {
  return (
    <li className={active ? "active" : ""}>
      <div className="node" onClick={() => actions.onOpenChapter(chapter.id)}>
        📄 {chapter.title}
        <span className="node-actions">
          <button onClick={(e) => { e.stopPropagation(); actions.onRenameChapter(projectId, chapter.id, chapter.title); }}>✎</button>
          <button onClick={(e) => { e.stopPropagation(); actions.onDeleteChapter(projectId, chapter.id); }}>🗑</button>
        </span>
      </div>
    </li>
  );
});

const ProjectRow = memo(function ProjectRow({
  project, active, activeChapterId, chapters, actions,
}: {
  project: Project;
  active: boolean;
  activeChapterId: string | null;
  chapters: Chapter[];
  actions: RowActions;
}) {
  return (
    <li className={active ? "active" : ""}>
      <div className="node" onClick={() => actions.onOpenProject(project.id)}>
        📁 {project.name}
        <span className="node-actions">
          <button onClick={(e) => { e.stopPropagation(); actions.onRenameProject(project.id, project.name); }}>✎</button>
          <button onClick={(e) => { e.stopPropagation(); actions.onDeleteProject(project.id); }}>🗑</button>
        </span>
      </div>
      {active && (
        <ul className="chapter-tree">
          {chapters.map((c) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              projectId={project.id}
              active={activeChapterId === c.id}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

function ModePanel({ mode, projectId, chapterId }: { mode: EditorMode; projectId: string | null; chapterId: string | null }) {
  const panel = (() => {
    if (mode === "knowledge") return <KnowledgePanel projectId={projectId} />;
    if (mode === "research") return <ResearchPanel projectId={projectId} />;
    if (mode === "diagnostics") return <DiagnosticsPanel projectId={projectId} chapterId={chapterId} />;
    if (mode === "preflight") return <PreflightPanel projectId={projectId} chapterId={chapterId} />;
    if (mode === "snapshots") return <SnapshotPanel projectId={projectId} />;
    if (mode === "kdp") return <KdpChecklistPanel projectId={projectId} />;
    if (mode === "publishing") return <PublishingAssistantPanel projectId={projectId} />;
    if (!projectId || !chapterId) {
      return <div className="mode-placeholder">Wähle links ein Projekt und Kapitel, um die Avantgarde-Funktionen zu nutzen.</div>;
    }
    switch (mode) {
      case "fragments": return <FragmentPanel chapterId={chapterId} />;
      case "voices": return <VoiceLab text="(Text aus Editor wählen)" />;
      case "map": return <SemanticMap projectId={projectId} />;
      case "dialogue": return <DialoguePanel chapterId={chapterId} text="(Text aus Editor wählen)" />;
      case "versions": return <VersionsPanel chapterId={chapterId} content="(Inhalt)" />;
      case "obstruction": return <ObstructionPanel text="(Text aus Editor wählen)" />;
      case "dream": return <DreamLogicPanel text="(Text aus Editor wählen)" />;
      case "imagegen": return <ImageGenerationPanel />;
      case "covergen": return <CoverGenPanel />;
      case "blurbgen": return <BlurbGenPanel />;
      case "scientificwriting": return <ScientificWritingPanel />;
      case "timeline": return <TimelinePanel projectId={projectId} />;
      case "characters": return <CharactersPanel projectId={projectId} />;
      case "worldbuilding": return <WorldbuildingPanel projectId={projectId} />;
      case "investigate": return <InvestigatePanel />;
      default: return null;
    }
  })();

  return <Suspense fallback={<div className="mode-placeholder">Lädt…</div>}>{panel}</Suspense>;
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
