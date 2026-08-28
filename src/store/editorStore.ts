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
  /** Queue von Texten, die vom KI-Panel ins Dokument eingefügt werden sollen (Race-Fix) */
  pendingInserts: string[];
  setChapter: (id: string | null, content: string) => void;
  setContent: (content: string) => void;
  setCounts: (words: number, chars: number) => void;
  toggleFocusMode: () => void;
  markSaved: () => void;
  /** Fügt Text am Dokument-Ende ein (vom KI-Panel aufgerufen) */
  insertAtEnd: (text: string) => void;
  /** Entfernt einen Text aus der Queue nach erfolgreichem Insert */
  consumeInsert: (text: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  chapterId: null,
  content: "{}",
  wordCount: 0,
  charCount: 0,
  focusMode: false,
  dirty: false,
  insertTrigger: 0,
  pendingInserts: [],
  setChapter: (id, content) =>
    set({ chapterId: id, content, dirty: false, wordCount: 0, charCount: 0 }),
  setContent: (content) => set({ content, dirty: true }),
  setCounts: (words, chars) => set({ wordCount: words, charCount: chars }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  markSaved: () => set({ dirty: false }),
  insertAtEnd: (text) => {
    // Empty-Guard: Whitespace-Only-Output nicht einfügen
    if (!text || !text.trim()) return;
    set((s) => {
      try {
        const cur = JSON.parse(s.content || "{}");
        const para = { type: "paragraph", content: [{ type: "text", text }] };
        if (cur.content && Array.isArray(cur.content)) cur.content.push(para);
        else cur.content = [para];
        return {
          content: JSON.stringify(cur),
          pendingInserts: [...s.pendingInserts, text],
          insertTrigger: s.insertTrigger + 1,
          dirty: true,
        };
      } catch {
        // JSON-Parsing fehlgeschlagen — Insert ignorieren
        return {};
      }
    });
  },
  consumeInsert: (text) =>
    set((s) => ({
      pendingInserts: s.pendingInserts.filter((t) => t !== text),
    })),
}));
