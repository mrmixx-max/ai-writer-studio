// Projekt-State: aktives Projekt/Kapitel + Baum.
// Kapitel-Updates werden jetzt INKREMENTELL in SQLite persistiert
// (updateChapterFields) — kein reinen RAM-Puffer mehr.
import { create } from "zustand";
import {
  listProjects, listChapters, createProject, createChapter, getChapter,
  updateChapterFields,
} from "@/services/project";
import type { Project, Chapter, ChapterStatus } from "@/types/project";
import { createDefaultChapter, computeWordStats } from "@/services/writing/chapterPlan";

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
  /** Aktualisiert Felder eines Kapitels (State + DB, inkrementell). */
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  /** Setzt den Status eines Kapitels. */
  setChapterStatus: (id: string, status: ChapterStatus) => void;
  /** Aktualisiert die aktuelle Wortzahl eines Kapitels. */
  updateChapterWordCount: (id: string, wordCount: number) => void;
  /** Sortiert Kapitel um (Drag & Drop). */
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  setActiveContent: (c: string) => void;
  /**
   * INTERFACE-CHANGE: Gliederung-Reconcile für "Gliederung neu generieren".
   * Behält fertige Kapitel (draft/completed), markiert abweichende als
   * needs_revision, plant neue Kapitel ein.
   */
  reconcileOutline: (
    newChapters: { title: string; summary?: string; purpose?: string }[],
  ) => void;
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
    // Inkrementell in SQLite schreiben (kein RAM-Puffer mehr).
    void updateChapterFields(id, updates).catch(() => {
      // DB-Fehler darf die UI nicht blockieren; State bleibt konsistent.
    });
  },
  setChapterStatus: (id, status) => {
    get().updateChapter(id, { status });
  },
  updateChapterWordCount: (id, wordCount) => {
    get().updateChapter(id, { currentWordCount: wordCount });
  },
  reorderChapters: (fromIndex, toIndex) => {
    const chapters = [...get().chapters];
    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    // orderIndex neu setzen
    const reordered = chapters.map((ch, i) => ({ ...ch, orderIndex: i }));
    set({ chapters: reordered });
    // Persistieren der neuen Reihenfolge
    for (const ch of reordered) {
      void updateChapterFields(ch.id, { orderIndex: ch.orderIndex }).catch(() => undefined);
    }
  },
  reconcileOutline: (newChapters) => {
    const pid = get().activeProjectId;
    if (!pid) return;
    const existing = get().chapters;
    const now = Date.now();
    const next: Chapter[] = [];

    newChapters.forEach((nc, i) => {
      const prev = existing[i];
      const titleChanged = !prev || prev.title !== nc.title;
      if (prev && !titleChanged) {
        // Unverändertes Kapitel: Plan-Felder aktualisieren, Status behalten.
        next.push({ ...prev, synopsis: nc.summary ?? prev.synopsis, updatedAt: now });
        if (nc.summary !== undefined && nc.summary !== prev.synopsis) {
          get().updateChapter(prev.id, { synopsis: nc.summary });
        }
      } else if (prev) {
        // Umbenannt → Betroffenes Kapitel zur Überarbeitung markieren,
        // fertiger Content bleibt erhalten (draft/completed nicht löschen).
        const keepStatus = prev.status === "draft" || prev.status === "completed"
          ? "needs_revision"
          : prev.status;
        get().updateChapter(prev.id, { title: nc.title, synopsis: nc.summary, status: keepStatus });
        next.push({ ...prev, title: nc.title, synopsis: nc.summary, status: keepStatus, updatedAt: now });
      } else {
        // Neues Kapitel ans Ende planen.
        const fresh = createDefaultChapter(pid, i, {
          title: nc.title,
          synopsis: nc.summary,
          purpose: nc.purpose,
        });
        const created = createChapter(pid, fresh.id, "", i);
        Promise.resolve(created).then(() => {
          void updateChapterFields(fresh.id, { synopsis: nc.summary, purpose: nc.purpose }).catch(() => undefined);
        });
        next.push(fresh);
      }
    });

    set({ chapters: next });
  },
}));

// Re-Export für Komponenten, die Statistiken im Row berechnen (Agent 3 UI).
export { computeWordStats };
