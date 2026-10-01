// editorialTrackChanges.ts — Wandelt Lektorat-Patches in ProseMirror-Track-Changes um.
//
// Die Lektoratsschleife (editorialLoop.ts) liefert Patches als search/replace-Paare.
// Diese Module wandelt sie in ProseMirror-Marks um, die im Editor als
// Track-Changes dargestellt werden — ähnlich wie Word oder Google Docs.
//
// Der Autor sieht die Änderungen im Text und kann sie einzeln akzeptieren
// oder ablehnen. Erst bei "Akzeptieren" wird der Patch ins Dokument geschrieben.

import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import type { TextPatch } from "@/services/llm/textPatch";

/** Ein angewandter Track-Change im Dokument. */
export interface AppliedTrackChange {
  /** Der ursprüngliche Patch. */
  patch: TextPatch;
  /** PM-Position des gelöschten Texts (von). */
  from: number;
  /** PM-Position des gelöschten Texts (bis). */
  to: number;
  /** PM-Position des eingefügten Texts (von). */
  insertFrom: number;
  /** PM-Position des eingefügten Texts (bis). */
  insertTo: number;
}

/**
 * Findet die Position von `search` im ProseMirror-Dokument.
 * Gibt die PM-Position (von, zu) zurück, oder null wenn nicht gefunden.
 *
 * Sucht nur in Textknoten, nicht in Blöcken. Der search-Text muss
 * wörtlich vorkommen — keine Fuzzy-Suche.
 */
export function findTextPosition(
  doc: Node,
  search: string,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.isText) {
      const idx = node.text!.indexOf(search);
      if (idx !== -1) {
        found = { from: pos + idx, to: pos + idx + search.length };
        return false;
      }
    }
    return true;
  });
  return found;
}

/**
 * Wendet einen Patch als Track-Change auf den Editor-State an.
 *
 * Der alte Text wird mit `tcDelete` markiert (bleibt sichtbar, wie in Word),
 * der neue Text wird mit `tcInsert` markiert (eingefügt).
 *
 * Gibt die neue EditorState und die Position des eingefügten Texts zurück,
 * oder null wenn der Patch nicht angewendet werden konnte.
 */
export function applyPatchAsTrackChange(
  state: EditorState,
  patch: TextPatch,
): { state: EditorState; insertPos: number } | null {
  const pos = findTextPosition(state.doc, patch.search);
  if (!pos) return null;

  const tr = state.tr;
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;

  if (!deleteType || !insertType) return null;

  // 1. Den alten Text mit tcDelete markieren (mit Begründung als Attribut)
  const deleteAttrs = patch.reason ? { "data-reason": patch.reason } : undefined;
  tr.addMark(pos.from, pos.to, deleteType.create(deleteAttrs));

  // 2. Den neuen Text einfügen und mit tcInsert markieren (mit Begründung)
  const insertAttrs = patch.reason ? { "data-reason": patch.reason } : undefined;
  const insertNode = state.schema.text(patch.replace, [insertType.create(insertAttrs)]);
  tr.insert(pos.to, insertNode);

  return { state: state.apply(tr), insertPos: pos.to };
}

/**
 * Wendet mehrere Patches als Track-Changes an.
 * Gibt die neue EditorState zurück, oder null wenn kein Patch griff.
 *
 * Wichtig: Die Patches werden in umgekehrter Reihenfolge angewendet,
 * damit die Positionen der späteren Patches nicht durch die früheren
 * verschoben werden.
 */
export function applyPatchesAsTrackChanges(
  state: EditorState,
  patches: TextPatch[],
): { state: EditorState; applied: AppliedTrackChange[] } | null {
  const applied: AppliedTrackChange[] = [];
  let currentState = state;

  // In umgekehrter Reihenfolge anwenden, damit Positionen stabil bleiben
  for (let i = patches.length - 1; i >= 0; i--) {
    const patch = patches[i];
    const pos = findTextPosition(currentState.doc, patch.search);
    if (!pos) continue;

    const deleteType = currentState.schema.marks.tcDelete;
    const insertType = currentState.schema.marks.tcInsert;
    if (!deleteType || !insertType) continue;

    const tr = currentState.tr;

    // Alten Text markieren
    tr.addMark(pos.from, pos.to, deleteType.create());

    // Neuen Text einfügen und markieren
    const insertNode = currentState.schema.text(patch.replace, [insertType.create()]);
    tr.insert(pos.to, insertNode);

    applied.push({
      patch,
      from: pos.from,
      to: pos.to,
      insertFrom: pos.to,
      insertTo: pos.to + patch.replace.length,
    });

    currentState = currentState.apply(tr);
  }

  if (applied.length === 0) return null;
  return { state: currentState, applied };
}

/**
 * Akzeptiert einen Track-Change: Entfernt die Marks, behält den neuen Text.
 */
export function acceptTrackChange(
  state: EditorState,
  change: AppliedTrackChange,
): EditorState {
  const tr = state.tr;
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;

  if (deleteType) {
    tr.removeMark(change.from, change.to, deleteType);
  }
  if (insertType) {
    tr.removeMark(change.insertFrom, change.insertTo, insertType);
  }

  return state.apply(tr);
}

/**
 * Lehnt einen Track-Change ab: Entfernt den neuen Text, behält den alten.
 */
export function rejectTrackChange(
  state: EditorState,
  change: AppliedTrackChange,
): EditorState {
  const tr = state.tr;
  const deleteType = state.schema.marks.tcDelete;

  // Neuen Text entfernen
  tr.delete(change.insertFrom, change.insertTo);

  // Alten Text wiederherstellen (Marks entfernen)
  if (deleteType) {
    tr.removeMark(change.from, change.to, deleteType);
  }

  return state.apply(tr);
}

/**
 * Akzeptiert ALLE Track-Changes im Dokument.
 * Entfernt alle tcDelete- und tcInsert-Marks, behält den neuen Text.
 */
export function acceptAllTrackChanges(state: EditorState): EditorState {
  const tr = state.tr;
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;

  if (deleteType) {
    tr.removeMark(0, state.doc.content.size, deleteType);
  }
  if (insertType) {
    tr.removeMark(0, state.doc.content.size, insertType);
  }

  return state.apply(tr);
}

/**
 * Lehnt ALLE Track-Changes ab.
 * Entfernt alle tcInsert-Marks und stellt den alten Text wieder her.
 */
export function rejectAllTrackChanges(state: EditorState): EditorState {
  const tr = state.tr;
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;

  // Erst alle tcInsert-Marks entfernen (neuer Text verschwindet)
  if (insertType) {
    tr.removeMark(0, state.doc.content.size, insertType);
  }
  // Dann alle tcDelete-Marks entfernen (alter Text bleibt)
  if (deleteType) {
    tr.removeMark(0, state.doc.content.size, deleteType);
  }

  return state.apply(tr);
}

/**
 * Prüft, ob noch offene Track-Changes im Dokument existieren.
 * Für den Export-Guard: Vor dem Export prüfen, ob noch Lektoratsänderungen
 * offen sind, die der Autor akzeptieren oder ablehnen sollte.
 */
export function hasOpenTrackChanges(state: EditorState): boolean {
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;
  let hasChanges = false;

  state.doc.descendants((node) => {
    if (hasChanges) return false;
    if (deleteType && node.marks.some((m) => m.type === deleteType)) {
      hasChanges = true;
      return false;
    }
    if (insertType && node.marks.some((m) => m.type === insertType)) {
      hasChanges = true;
      return false;
    }
    return true;
  });

  return hasChanges;
}

/**
 * Zählt die offenen Track-Changes im Dokument.
 */
export function countOpenTrackChanges(state: EditorState): number {
  const deleteType = state.schema.marks.tcDelete;
  const insertType = state.schema.marks.tcInsert;
  let count = 0;

  state.doc.descendants((node) => {
    if (deleteType && node.marks.some((m) => m.type === deleteType)) count++;
    if (insertType && node.marks.some((m) => m.type === insertType)) count++;
    return true;
  });

  return count;
}
