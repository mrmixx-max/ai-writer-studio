import type { EditorMode } from "@/types/mode";
import type { Project, Chapter } from "@/types/project";
import type { TranslationKey } from "@/i18n";

export type SidebarTab = "projects" | "prompts";

export type RowActions = {
  onOpenProject: (id: string) => void;
  onOpenChapter: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameChapter: (projectId: string, id: string, title: string) => void;
  onDeleteChapter: (projectId: string, id: string) => void;
};

export type ModeEntry = {
  id: EditorMode;
  key: TranslationKey;
  icon: string;
  descKey: TranslationKey;
  wide?: boolean;
  requiresChapter?: boolean;
  standalone?: boolean;
};

export type ModePanelProps = {
  mode: EditorMode;
  projectId: string | null;
  chapterId: string | null;
};

export type ProjectTreeProps = {
  projects: Project[];
  activeProjectId: string | null;
  activeChapterId: string | null;
  chapters: Chapter[];
  rowActions: RowActions;
};

export type SidebarState = {
  tab: SidebarTab;
  mode: EditorMode;
  modesCollapsed: boolean;
};

export type SidebarActions = {
  setTab: (tab: SidebarTab) => void;
  setMode: (mode: EditorMode) => void;
  toggleModesCollapsed: () => void;
};