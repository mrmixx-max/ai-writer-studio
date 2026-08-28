// TrackChangesExtension: Änderungsverfolgung via Marks.
// Eingefügter Text wird mit "tcInsert"-Mark markiert, Löschungen werden
// via Callback aufgezeichnet (der Text ist nach dem Entfernen nicht mehr im Dok).
// Befehle: acceptTrackChanges / rejectTrackChanges (global oder auf Auswahl).
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trackChanges: {
      acceptTrackChanges: (from?: number, to?: number) => ReturnType;
      rejectTrackChanges: (from?: number, to?: number) => ReturnType;
    };
  }
}

export interface TrackChangesCallbacks {
  onInsert?: (position: number, text: string) => void;
  onDelete?: (position: number, text: string) => void;
}

export const TcInsertMark = Mark.create({
  name: "tcInsert",
  parseHTML() {
    return [{ tag: "ins[data-tc]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["ins", mergeAttributes({ "data-tc": "1", class: "tc-insert" }, HTMLAttributes), 0];
  },
});

export const TcDeleteMark = Mark.create({
  name: "tcDelete",
  // Gelöschter Text bleibt sichtbar (wie Word), wird bei "Annehmen" entfernt.
  inclusive: false,
  parseHTML() {
    return [{ tag: "del[data-tc]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["del", mergeAttributes({ "data-tc": "1", class: "tc-delete" }, HTMLAttributes), 0];
  },
});

export interface TrackChangesStorage {
  enabled: boolean;
  author: string;
  callbacks: TrackChangesCallbacks;
}

export const TrackChangesExtension = Extension.create<Record<string, never>, TrackChangesStorage>({
  name: "trackChanges",

  addStorage() {
    return { enabled: false, author: "Autor", callbacks: {} };
  },

  addCommands() {
    return {
      acceptTrackChanges:
        (from?: number, to?: number) =>
        ({ tr, state, dispatch }) => {
          const insertType = state.schema.marks.tcInsert;
          const deleteType = state.schema.marks.tcDelete;
          const doc = state.doc;
          const lower = from ?? 0;
          const upper = to ?? doc.content.size;
          doc.descendants((node, pos) => {
            if (pos + node.nodeSize < lower || pos > upper) return true;
            const hasDelete = deleteType && node.marks.some((m) => m.type === deleteType);
            const hasInsert = insertType && node.marks.some((m) => m.type === insertType);
            if (hasDelete) tr.delete(pos, pos + node.nodeSize);
            else if (hasInsert) tr.removeMark(pos, pos + node.nodeSize, insertType);
            return true;
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      rejectTrackChanges:
        (from?: number, to?: number) =>
        ({ tr, state, dispatch }) => {
          const insertType = state.schema.marks.tcInsert;
          const deleteType = state.schema.marks.tcDelete;
          const doc = state.doc;
          const lower = from ?? 0;
          const upper = to ?? doc.content.size;
          doc.descendants((node, pos) => {
            if (pos + node.nodeSize < lower || pos > upper) return true;
            const hasInsert = insertType && node.marks.some((m) => m.type === insertType);
            if (hasInsert) tr.delete(pos, pos + node.nodeSize);
            else if (deleteType && node.marks.some((m) => m.type === deleteType)) {
              tr.removeMark(pos, pos + node.nodeSize, deleteType);
            }
            return true;
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  appendTransaction(transactions: Transaction[], oldState: EditorState, newState: EditorState) {
    const storage = this.storage as TrackChangesStorage;
    if (!storage.enabled) return null;
    if (!transactions.some((tr) => tr.docChanged)) return null;

    const insertType = newState.schema.marks.tcInsert;
    const tr = newState.tr;
    let touched = false;

    for (const transaction of transactions) {
      transaction.mapping.maps.forEach((map) => {
        map.forEach((oldStart, oldEnd, newStart, newEnd) => {
          // Eingefügter Text → tcInsert-Mark + Callback
          if (newEnd > newStart) {
            const text = newState.doc.textBetween(newStart, newEnd, "\n");
            if (text.trim()) {
              tr.addMark(newStart, newEnd, insertType.create());
              touched = true;
              storage.callbacks.onInsert?.(newStart, text);
            }
          }
          // Gelöschter Text → Callback (nicht mehr im neuen Dok)
          if (oldEnd > oldStart) {
            const text = oldState.doc.textBetween(oldStart, oldEnd, "\n");
            if (text.trim()) {
              storage.callbacks.onDelete?.(oldStart, text);
            }
          }
        });
      });
    }
    return touched ? tr : null;
  },
});
