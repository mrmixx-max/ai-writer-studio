import { useCallback } from "react";
import { useI18n } from "@/i18n";
import type { Project, Chapter } from "@/types/project";
import type { RowActions } from "../types";
import { ProjectRow } from "./ProjectTree";

interface ProjectTabProps {
  projects: Project[];
  activeProjectId: string | null;
  activeChapterId: string | null;
  chapters: Chapter[];
  rowActions: RowActions;
  onNewProject: () => void;
  onNewChapter: () => void;
  onSwitchToPrompts: () => void;
}

/**
 * ProjectTab — rendert den Projects-Tab mit Toolbar und Projektbaum.
 * Extrahiert aus Sidebar.tsx.
 */
export function ProjectTab({
  projects,
  activeProjectId,
  activeChapterId,
  chapters,
  rowActions,
  onNewProject,
  onNewChapter,
  onSwitchToPrompts,
}: ProjectTabProps) {
  const { t } = useI18n();

  const handleNewProject = useCallback(() => {
    onNewProject();
  }, [onNewProject]);

  const handleNewChapter = useCallback(() => {
    onNewChapter();
  }, [onNewChapter]);

  return (
    <aside id="app-sidebar" tabIndex={-1} aria-label={t("sidebar.listLabel")} className="sidebar">
      <nav className="sidebar-tabs">
        <button className="active" aria-current="page" onClick={() => {}}>
          {t("sidebar.projectsTab")}
        </button>
        <button onClick={onSwitchToPrompts}>{t("sidebar.promptsTab")}</button>
      </nav>
      <div className="sidebar-content">
        <div className="project-toolbar">
          <button onClick={handleNewProject}>{t("sidebar.newProject")}</button>
          {activeProjectId && (
            <button onClick={handleNewChapter}>{t("sidebar.newChapter")}</button>
          )}
        </div>
        <ul className="project-tree">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              active={activeProjectId === p.id}
              activeChapterId={activeChapterId}
              chapters={activeProjectId === p.id ? chapters : []}
              actions={rowActions}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}