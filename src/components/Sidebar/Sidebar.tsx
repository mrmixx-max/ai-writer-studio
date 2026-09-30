// Sidebar mit Avantgarde-Modus-Switcher + Projekt-Baum.
// Bloomberg-Terminal-Thema (Sprint 18, Agent 2): Stile in sidebar.css.
import "./sidebar.css";

import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/i18n";
import type { EditorMode } from "@/types/mode";

import { ModeSwitcher } from "./components/ModeSwitcher";
import { ProjectTab } from "./components/ProjectTab";
import { PromptTab } from "./components/PromptTab";
import { ModePanel } from "./panels/ModePanel";
import { useSidebarState, useModeValidation } from "./hooks/useSidebarState";
import { isWideMode } from "./modeRegistry";

/**
 * Sidebar — Hauptkomponente der linken Navigationsleiste.
 * 
 * Refactored: Aufgeteilt in:
 * - types.ts: TypeScript-Interfaces
 * - modeRegistry.ts: Zentrale Mode-Definitionen (65+ Modi)
 * - hooks/useSidebarState.tsx: State-Management & Actions
 * - components/ModeSwitcher.tsx: Modus-Schalter
 * - components/ProjectTab.tsx: Projekte-Tab
 * - components/PromptTab.tsx: Prompts-Tab
 * - components/ProjectTree.tsx: ProjectRow + ChapterRow (memoized)
 * - panels/ModePanel.tsx: Panel-Dispatcher für alle Modi
 * 
 * Ursprüngliche Größe: 756 Zeilen → jetzt ~150 Zeilen
 */
export function Sidebar() {
  const { t } = useI18n();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const projects = useProjectStore((s) => s.projects);
  const chapters = useProjectStore((s) => s.chapters);

  // State & Actions aus Hook
  const [state, actions, rowActions, dlgEl, { askPrompt }] = useSidebarState();
  const { tab, mode, modesCollapsed } = state;
  const { setTab, setMode, toggleModesCollapsed } = actions;

  // Mode-Validierung: prüft ob Projekt/Kapitel für aktuellen Modus vorhanden
  const { valid: modeValid, fallback } = useModeValidation(mode, activeProjectId, activeChapterId);

  // ModeSwitcher-Handler: Editor/Prompts Tabs synchron halten
  const handleModeChange = (newMode: EditorMode) => {
    setMode(newMode);
    if (newMode === "editor") setTab("projects");
    if (newMode === "prompts") setTab("prompts");
  };

  // Breiten-Check für Sidebar-Klasse
  const isWide = isWideMode(mode);

  // Spezial-Modus: nicht Editor und nicht Prompts
  const inSpecialMode = mode !== "editor" && mode !== "prompts";

  // Fallback wenn Modus ungültig (z.B. BookWriter ohne Projekt/Kapitel)
  if (!modeValid && fallback) {
    setMode(fallback);
    if (fallback === "editor") setTab("projects");
  }

  // ===== RENDER =====

  // 1. Spezial-Modi (Knowledge, Diagnostics, BookWriter, etc.)
  if (inSpecialMode) {
    return (
      <aside
        id="app-sidebar"
        tabIndex={-1}
        aria-label={t("sidebar.listLabel")}
        className={`sidebar${isWide ? " wide" : ""}`}
      >
        <ModeSwitcher
          mode={mode}
          modesCollapsed={modesCollapsed}
          onModeChange={handleModeChange}
          onToggleCollapsed={toggleModesCollapsed}
        />
        {dlgEl}
        <div className="sidebar-content">
          <ModePanel mode={mode} projectId={activeProjectId} chapterId={activeChapterId} />
        </div>
      </aside>
    );
  }

  // 2. Prompts-Tab
  if (tab === "prompts") {
    return (
      <PromptTab
        onSwitchToProjects={() => {
          setTab("projects");
          setMode("editor");
        }}
      />
    );
  }

  // 3. Standard: Projects-Tab (Editor-Modus)
  return (
    <ProjectTab
      projects={projects}
      activeProjectId={activeProjectId}
      activeChapterId={activeChapterId}
      chapters={chapters}
      rowActions={rowActions}
      onNewProject={() => {
        void (async () => {
          const n = await askPrompt(t("sidebar.promptProjectName"));
          if (n) {
            useProjectStore.getState().newProject(n);
          }
        })();
      }}
      onNewChapter={() => {
        void (async () => {
          const n = await askPrompt(t("sidebar.promptChapterTitle"));
          if (n) {
            useProjectStore.getState().newChapter(n);
          }
        })();
      }}
      onSwitchToPrompts={() => {
        setTab("prompts");
        setMode("prompts");
      }}
    />
  );
}
