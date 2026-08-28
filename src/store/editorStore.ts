// Editor-Store: hält aktuellen Kapitel-Inhalt (TipTap JSON als String) + UI-Flags.
import { create } from "zustand";

interface EditorState {
  chapterId: string | null;
  content: string; // TipTap-Doc als JSON-String
  wordCount: number;
  charCount: number;
  focusMode: boolean;
  dirty: boolean;
  /** Version-Counter: erhöht sich bei insertAtEnd — Editor lauscht darauf */
  insertTrigger: number;
  /** Text, der vom KI-Panel ins Dokument eingefügt werden soll */
  pendingInsert: string;
  setChapter: (id: string | null, content: string) => void;
  setContent: (content: string) => void;
  setCounts: (words: number, chars: number) => void;
  toggleFocusMode: () => void;
  markSaved: () => void;
  /** Fügt Text am Dokument-Ende ein (vom KI-Panel aufgerufen) */
  insertAtEnd: (text: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  chapterId: null,
  content: "{}",
  wordCount: 0,
  charCount: 0,
  focusMode: false,
  dirty: false,
  insertTrigger: 0,
  pendingInsert: "",
  setChapter: (id, content) =>
    set({ chapterId: id, content, dirty: false, wordCount: 0, charCount: 0 }),
  setContent: (content) => set({ content, dirty: true }),
  setCounts: (words, chars) => set({ wordCount: words, charCount: chars }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  markSaved: () => set({ dirty: false }),
  insertAtEnd: (text) =>
    set((s) => ({
      pendingInsert: text,
      insertTrigger: s.insertTrigger + 1,
      dirty: true,
    })),
}));
