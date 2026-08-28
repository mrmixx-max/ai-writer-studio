// Hilfsfunktionen: Klartext-Offsets ↔ ProseMirror-Positionen.
import type { Editor } from "@tiptap/core";

export interface TextRange {
  start: number; // Klartext-Offset (inklusive)
  end: number;   // Klartext-Offset (exklusive)
}

/** Klartext des Dokuments (mit \n zwischen Blöcken). */
export function docText(editor: Editor): string {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", "\n");
}

/** Aktuelle Auswahl als Klartext-Range + PM-Range. */
export function selectionRange(editor: Editor): { text: TextRange; pm: { from: number; to: number } } | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const text = editor.state.doc.textBetween(from, to, "\n", "\n");
  const beforeText = editor.state.doc.textBetween(0, from, "\n", "\n");
  return { text: { start: beforeText.length, end: beforeText.length + text.length }, pm: { from, to } };
}

/** Wandelt einen Klartext-Offset in eine PM-Position um (nächste Textgrenze). */
export function textOffsetToPos(editor: Editor, offset: number): number {
  let acc = 0;
  let lastTextPos = 1;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && typeof node.text === "string") {
      const len = node.text.length;
      if (offset <= acc + len) {
        found = pos + (offset - acc);
        return false;
      }
      acc += len;
      lastTextPos = pos + len;
    } else if (node.isBlock && acc > 0) {
      acc += 1; // Blockgrenze zählt als \n
    }
    return true;
  });
  if (found >= 0) return found;
  // Fallback: Ende des letzten Textknotens
  return lastTextPos;
}

/** Findet die PM-Range eines Kommentars anhand seiner Mark-ID. */
export function findCommentRange(editor: Editor, commentId: string): { from: number; to: number } | null {
  let range: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (range) return false;
    const mark = node.marks.find((m) => m.type.name === "comment" && m.attrs.commentId === commentId);
    if (mark) {
      range = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return range;
}
