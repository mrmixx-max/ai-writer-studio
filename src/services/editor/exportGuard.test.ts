// Tests für den Export-Guard.
//
// Kernaussage: Vor dem Export wird geprüft, ob noch offene Track-Changes
// existieren. Wenn ja, wird der Autor gewarnt — nicht blockiert, aber
// aufgefordert, die Änderungen zu überprüfen.

import { describe, it, expect } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { checkExportGuard } from "./exportGuard";
import { applyPatchAsTrackChange } from "./editorialTrackChanges";
import type { TextPatch } from "@/services/llm/textPatch";

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
      attrs: { "data-reason": { default: null } },
      toDOM: () => ["del", { class: "tc-delete" }, 0],
    },
    tcInsert: {
      attrs: { "data-reason": { default: null } },
      toDOM: () => ["ins", { class: "tc-insert" }, 0],
    },
  },
});

function makeState(text: string): EditorState {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text(text)]),
  ]);
  return EditorState.create({ doc, schema });
}

describe("checkExportGuard", () => {
  it("erlaubt Export wenn keine Track-Changes existieren", () => {
    const state = makeState("Der Hund ist braun.");
    const result = checkExportGuard(state);
    expect(result.allowed).toBe(true);
    expect(result.openChanges).toBe(0);
    expect(result.message).toBeNull();
  });

  it("blockiert Export wenn Track-Changes offen sind", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const applied = applyPatchAsTrackChange(state, patch)!;
    const result = checkExportGuard(applied.state);
    expect(result.allowed).toBe(false);
    expect(result.openChanges).toBeGreaterThan(0);
    expect(result.message).toContain("Lektoratsänderungen");
  });

  it("zählt die offenen Track-Changes korrekt", () => {
    const state = makeState("Der Hund ist braun.");
    const patch: TextPatch = { search: "braun", replace: "schwarz" };
    const applied = applyPatchAsTrackChange(state, patch)!;
    const result = checkExportGuard(applied.state);
    // Ein Patch erzeugt 2 Marks (tcDelete + tcInsert)
    expect(result.openChanges).toBe(2);
  });
});
