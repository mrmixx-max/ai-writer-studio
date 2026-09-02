// Projekt-State: aktives Projekt/Kapitel + Baum.
import { create } from "zustand";
import { listProjects, listChapters, createProject, createChapter, getChapter } from "@/services/project";
import type { Project, Chapter, ChapterStatus } from "@/types/project";
import { createDefaultChapter } from "@/services/writing/chapterPlan";

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
  newChapter: (title: string, content?: string) => void;
  /** Erstellt ein Kapitel mit vollständiger Planung (Zielwortzahl etc.). */
  newPlannedChapter: (title: string, targetWordCount: number, purpose?: string, synopsis?: string) => void;
  /** Aktualisiert Felder eines Kapitels. */
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  /** Setzt den Status eines Kapitels. */
  setChapterStatus: (id: string, status: ChapterStatus) => void;
  /** Aktualisiert die aktuelle Wortzahl eines Kapitels. */
  updateChapterWordCount: (id: string, wordCount: number) => void;
  /** Sortiert Kapitel um (Drag & Drop). */
  reorderChapters: (fromIndex: number, toIndex: number) => void;
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
  newChapter: (title: string, content?: string) => {
    const pid = get().activeProjectId;
    if (!pid) return;
    const c = createChapter(pid, title, content);
    Promise.resolve(c).then((chap) => set({ chapters: listChapters(pid), activeChapterId: chap.id, activeContent: chap.content }));
  },
  setActiveContent: (c) => set({ activeContent: c }),
  // --- Kapitelplanung ---
  newPlannedChapter: (title, targetWordCount, purpose, synopsis) => {
    const pid = get().activeProjectId;
    if (!pid) return;
    const orderIndex = get().chapters.length;
    const chapter = createDefaultChapter(pid, orderIndex, {
      title,
      targetWordCount,
      purpose,
      synopsis,
    });
    // Persistieren via createChapter (Content = "" — wird bei Generation gefüllt)
    const c = createChapter(pid, chapter.id, "", orderIndex);
    Promise.resolve(c).then(() => {
      set({
        chapters: listChapters(pid),
        activeChapterId: chapter.id,
        activeContent: "",
      });
    });
  },
  updateChapter: (id, updates) => {
    const pid = get().activeProjectId;
    if (!pid) return;
    const chapters = get().chapters.map((ch) =>
      ch.id === id ? { ...ch, ...updates, updatedAt: Date.now() } : ch,
    );
    set({ chapters });
    // TODO: persistiere in DB sobald createChapter/Update API existiert
  },
  setChapterStatus: (id, status) => {
    get().updateChapter(id, { status });
  },
  updateChapterWordCount: (id, wordCount) => {
    const chapters = get().chapters.map((ch) =>
      ch.id === id
        ? {
            ...ch,
            currentWordCount: wordCount,
            updatedAt: Date.now(),
          }
        : ch,
    );
    set({ chapters });
  },
  reorderChapters: (fromIndex, toIndex) => {
    const chapters = [...get().chapters];
    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    // orderIndex neu setzen
    const reordered = chapters.map((ch, i) => ({ ...ch, orderIndex: i }));
    set({ chapters: reordered });
  },
}));
