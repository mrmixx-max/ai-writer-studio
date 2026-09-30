import { memo } from "react";
import { useI18n } from "@/i18n";
import type { Project, Chapter } from "@/types/project";
import type { RowActions } from "../types";

/**
 * ProjectRow — memoized Projekt-Zeile mit Expand/Collapse für Kapitel.
 * Verhindert unnötige Re-Renders beim Tippen im Editor.
 */
export const ProjectRow = memo(function ProjectRow({
  project,
  active,
  activeChapterId,
  chapters,
  actions,
}: {
  project: Project;
  active: boolean;
  activeChapterId: string | null;
  chapters: Chapter[];
  actions: RowActions;
}) {
  const { t } = useI18n();

  return (
    <li className={active ? "active" : ""}>
      <div
        className="node"
        role="button"
        tabIndex={0}
        aria-label={t("sidebar.openProject", { name: project.name })}
        onClick={() => actions.onOpenProject(project.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.onOpenProject(project.id);
          }
        }}
      >
        📁 {project.name}
        <span className="node-actions">
          <button
            aria-label={t("sidebar.renameProject", { name: project.name })}
            onClick={(e) => {
              e.stopPropagation();
              actions.onRenameProject(project.id, project.name);
            }}
          >
            ✎
          </button>
          <button
            aria-label={t("sidebar.deleteProject", { name: project.name })}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteProject(project.id);
            }}
          >
            🗑
          </button>
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

/**
 * ChapterRow — memoized Kapitel-Zeile.
 */
export const ChapterRow = memo(function ChapterRow({
  chapter,
  projectId,
  active,
  actions,
}: {
  chapter: Chapter;
  projectId: string;
  active: boolean;
  actions: RowActions;
}) {
  const { t } = useI18n();

  return (
    <li className={active ? "active" : ""}>
      <div
        className="node"
        role="button"
        tabIndex={0}
        aria-label={t("sidebar.openChapter", { title: chapter.title })}
        onClick={() => actions.onOpenChapter(chapter.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.onOpenChapter(chapter.id);
          }
        }}
      >
        📄 {chapter.title}
        <span className="node-actions">
          <button
            aria-label={t("sidebar.renameChapter", { title: chapter.title })}
            onClick={(e) => {
              e.stopPropagation();
              actions.onRenameChapter(projectId, chapter.id, chapter.title);
            }}
          >
            ✎
          </button>
          <button
            aria-label={t("sidebar.deleteChapter", { title: chapter.title })}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteChapter(projectId, chapter.id);
            }}
          >
            🗑
          </button>
        </span>
      </div>
    </li>
  );
});