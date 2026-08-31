// Projekt-State: aktives Projekt/Kapitel + Baum.
import { create } from "zustand";
import { listProjects, listChapters, createProject, createChapter, getChapter } from "@/services/project";
import type { Project, Chapter } from "@/types/project";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  chapters: Chapter[];
  activeChapterId: string | null;
  activeContent: string;
  refresh: () => void;
  openProject: (id: string) => void;
  openChapter: (id: string) => void;
  newProject: (name: string) => void;
  newChapter: (title: string) => void;
  setActiveContent: (c: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  chapters: [],
  activeChapterId: null,
  activeContent: "{}",
  refresh: () => {
    try {
      set({ projects: listProjects() });
    } catch {
      // DB noch nicht initialisiert → ignorieren
    }
  },
  openProject: (id) => set({ activeProjectId: id, chapters: listChapters(id) }),
  openChapter: (id) => {
    const ch = getChapter(id);
    if (ch) set({ activeChapterId: id, activeContent: ch.content });
  },
  newProject: (name) => {
    const p = createProject(name);
    // async persist im Hintergrund; State sofort aktualisieren
    Promise.resolve(p).then((proj) => set({ projects: listProjects(), activeProjectId: proj.id, chapters: [] }));
  },
  newChapter: (title, content) => {
    const pid = get().activeProjectId;
    if (!pid) return;
    const c = createChapter(pid, title, content);
    Promise.resolve(c).then((chap) => set({ chapters: listChapters(pid), activeChapterId: chap.id, activeContent: chap.content }));
  },
  setActiveContent: (c) => set({ activeContent: c }),
}));
