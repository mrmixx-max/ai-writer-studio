// Fragment-Store: UI-State für Fragment-Modus.
import { create } from "zustand";
import { listFragments, reorderFragments } from "@/services/fragment";
import type { Fragment } from "@/types/project";

type ViewMode = "list" | "cards" | "timeline";

interface FragmentState {
  chapterId: string | null;
  fragments: Fragment[];
  view: ViewMode;
  setChapter: (id: string) => void;
  setView: (v: ViewMode) => void;
  refresh: () => void;
  reorder: (orderedIds: string[]) => void;
}

export const useFragmentStore = create<FragmentState>((set, get) => ({
  chapterId: null,
  fragments: [],
  view: "cards",
  setChapter: (id) => set({ chapterId: id, fragments: listFragments(id) }),
  setView: (v) => set({ view: v }),
  refresh: () => {
    const { chapterId } = get();
    if (chapterId) set({ fragments: listFragments(chapterId) });
  },
  reorder: (orderedIds) => {
    reorderFragments(orderedIds);
    get().refresh();
  },
}));
