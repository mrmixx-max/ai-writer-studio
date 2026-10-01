// Tests für editorialTrackChanges.ts — Patch → Track-Change-Konvertierung.
//
// Kernaussage: Die Lektoratsschleife liefert Patches. Diese Tests prüfen,
// dass die Patches korrekt als ProseMirror-Marks angewendet werden und
// dass Akzeptieren/Ablehnen wie erwartet funktioniert.

import { describe, it, expect } from "vitest";
import { Node } from "@tiptap/pm/model";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import {
  findTextPosition,
  applyPatchAsTrackChange,
  applyPatchesAsTrackChanges,
  acceptTrackChange,
  rejectTrackChange,
  type AppliedTrackChange,
} from "./editorialTrackChanges";
import type { TextPatch } from "@/services/llm/textPatch";

// Minimal-Schema mit tcDelete- und tcInsert-Marks
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      toDOM: () => ["p", 0],
    },
    text: {},
  },
  marks: {
    tcDelete: {
      toDOM: () => ["del", { class: "tc-delete" }, 0],
    },
    tcInsert: {
      toDOM: () => ["ins", { class: "tc-insert" }, 0],
    },
  },
});

function makeDoc(text: string): Node {
  return schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text(text)]),
  ]);
}

function makeState(text: string): EditorState {
  return EditorState.create({ doc: makeDoc(text), schema });
}

describe("findTextPosition", () => {
  it("findet einen einfachen Text", () => {
    const doc = makeDoc("Hallo Welt, wie geht es dir?");
    const pos = findTextPosition(doc, "Welt");
    expect(pos).toEqual({ from: 7, to: 11 });
  });

  it("findet Text am Anfang", () => {
    const doc = makeDoc("Hallo Welt");
    const pos = findTextPosition(doc, "Hallo");
    expect(pos).toEqual({ from: 1, to: 6 });
  });

  it("findet Text am Ende", () => {
    const doc = makeDoc("Hallo Welt");
    const pos = findTextPosition(doc, "Welt");
    expect(pos).toEqual({ from: 7, to: 11 });
  });

  it("gibt null zurück wenn nicht gefunden", () => {
    const doc = makeDoc("Hallo Welt");
    expect(findTextPosition(doc, "Foo")).toBeNull();
  });

  it("findet nur den ersten Treffer", () => {
    const doc = makeDoc("Wort und Wort");
    const pos = findTextPosition(doc, "Wort");
    expect(pos).toEqual({ from: 1, to: 5 });
  });
});

describe("applyPatchAsTrackChange", () => {
  it("wendet einen Patch als Track-Change an", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const result = applyPatchAsTrackChange(state, patch);
    expect(result).not.toBeNull();
    expect(result!.insertPos).toBeGreaterThan(0);
  });

  it("gibt null zurück wenn der Patch nicht gefunden wird", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "nicht vorhanden", replace: "neu" };
    expect(applyPatchAsTrackChange(state, patch)).toBeNull();
  });

  it("markiert den alten Text mit tcDelete", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const result = applyPatchAsTrackChange(state, patch);
    const newState = result!.state;
    const deleteType = schema.marks.tcDelete;
    let hasDelete = false;
    newState.doc.descendants((node) => {
      if (node.marks.some((m) => m.type === deleteType)) hasDelete = true;
      return true;
    });
    expect(hasDelete).toBe(true);
  });

  it("markiert den neuen Text mit tcInsert", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const result = applyPatchAsTrackChange(state, patch);
    const newState = result!.state;
    const insertType = schema.marks.tcInsert;
    let hasInsert = false;
    newState.doc.descendants((node) => {
      if (node.marks.some((m) => m.type === insertType)) hasInsert = true;
      return true;
    });
    expect(hasInsert).toBe(true);
  });
});

describe("applyPatchesAsTrackChanges", () => {
  it("wendet mehrere Patches an", () => {
    const state = makeState("Der Hund ist braun. Die Katze ist weiß.");
    const patches: TextPatch[] = [
      { search: "braun", replace: "schwarz" },
      { search: "weiß", replace: "grau" },
    ];
    const result = applyPatchesAsTrackChanges(state, patches);
    expect(result).not.toBeNull();
    expect(result!.applied).toHaveLength(2);
  });

  it("wendet nur Patches an, die gefunden werden", () => {
    const state = makeState("Der Hund ist braun.");
    const patches: TextPatch[] = [
      { search: "braun", replace: "schwarz" },
      { search: "nicht da", replace: "neu" },
    ];
    const result = applyPatchesAsTrackChanges(state, patches);
    expect(result).not.toBeNull();
    expect(result!.applied).toHaveLength(1);
  });

  it("gibt null zurück wenn kein Patch griff", () => {
    const state = makeState("Der Hund ist braun.");
    const patches: TextPatch[] = [
      { search: "nicht da", replace: "neu" },
    ];
    expect(applyPatchesAsTrackChanges(state, patches)).toBeNull();
  });
});

describe("acceptTrackChange", () => {
  it("entfernt die Marks bei Akzeptieren", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const applied = applyPatchAsTrackChange(state, patch)!;
    // Positionen dynamisch aus dem angewandten Dokument berechnen
    const deleteType = schema.marks.tcDelete;
    const insertType = schema.marks.tcInsert;
    let deleteFrom = -1, deleteTo = -1, insertFrom = -1, insertTo = -1;
    applied.state.doc.descendants((node, pos) => {
      if (node.marks.some((m) => m.type === deleteType)) {
        if (deleteFrom === -1) deleteFrom = pos;
        deleteTo = pos + node.nodeSize;
      }
      if (node.marks.some((m) => m.type === insertType)) {
        if (insertFrom === -1) insertFrom = pos;
        insertTo = pos + node.nodeSize;
      }
      return true;
    });
    const change: AppliedTrackChange = {
      patch,
      from: deleteFrom,
      to: deleteTo,
      insertFrom,
      insertTo,
    };
    const newState = acceptTrackChange(applied.state, change);
    let hasDelete = false;
    let hasInsert = false;
    newState.doc.descendants((node) => {
      if (node.marks.some((m) => m.type === deleteType)) hasDelete = true;
      if (node.marks.some((m) => m.type === insertType)) hasInsert = true;
      return true;
    });
    expect(hasDelete).toBe(false);
    expect(hasInsert).toBe(false);
  });
});

describe("rejectTrackChange", () => {
  it("entfernt den neuen Text bei Ablehnen", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const applied = applyPatchAsTrackChange(state, patch)!;
    const change: AppliedTrackChange = {
      patch,
      from: 15,
      to: 20,
      insertFrom: 20,
      insertTo: 27,
    };
    const newState = rejectTrackChange(applied.state, change);
    // Der neue Text ("schwarz") sollte entfernt sein
    const text = newState.doc.textContent;
    expect(text).not.toContain("schwarz");
  });

  it("behält den alten Text bei Ablehnen", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const applied = applyPatchAsTrackChange(state, patch)!;
    const change: AppliedTrackChange = {
      patch,
      from: 15,
      to: 20,
      insertFrom: 20,
      insertTo: 27,
    };
    const newState = rejectTrackChange(applied.state, change);
    const text = newState.doc.textContent;
    expect(text).toContain("braun");
  });
});
