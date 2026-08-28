// Unit-Tests für die Custom TipTap Extensions (CharacterTag, SceneMarker, ChapterOutline).
// Nutzt getSchema() statt eines DOM-Editors, damit die Tests im Node-Environment laufen.
import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import {
  CharacterTagExtension,
  createCharacterDecorations,
  CHARACTER_TAG_PATTERN,
} from "./CharacterTagExtension";
import {
  SceneMarkerExtension,
  SCENE_PATTERNS,
  createSceneDecorations,
} from "./SceneMarkerExtension";
import {
  ChapterOutlineExtension,
  extractHeadings,
} from "./ChapterOutlineExtension";

const schema = getSchema([
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  CharacterTagExtension,
  SceneMarkerExtension,
  ChapterOutlineExtension,
]);

function makeDoc(nodes: ProseMirrorNode[]): ProseMirrorNode {
  return schema.node("doc", null, nodes);
}
function p(text: string): ProseMirrorNode {
  return schema.node("paragraph", null, text ? [schema.text(text)] : []);
}
function heading(level: number, text: string): ProseMirrorNode {
  return schema.node(
    "heading",
    { level },
    text ? [schema.text(text)] : []
  );
}

interface DecoLike {
  class?: string;
  "data-character-name"?: string;
  "data-scene-type"?: string;
}

// DecorationSet.find() liefert Decoration[]; Inline-Decorations tragen ihre
// Attribute unter deco.type.attrs.
function inlineDecos(set: { find: () => unknown[] }): DecoLike[] {
  return set.find().map((d) => {
    const deco = d as unknown as { type: { attrs?: DecoLike } };
    return deco.type.attrs ?? {};
  });
}

describe("CharacterTagExtension", () => {
  it("registriert das characterTag-Mark im Schema", () => {
    expect(schema.marks.characterTag).toBeDefined();
  });

  it("erkennt @Name-Muster", () => {
    const matches = [..."Ein Dialog mit @Anna und @Karl Heinz.".matchAll(CHARACTER_TAG_PATTERN)];
    expect(matches.map((m) => m[1])).toEqual(["Anna", "Karl Heinz"]);
  });

  it("erkennt keine kleingeschriebenen Wörter", () => {
    const matches = [..."@klein @NochEin".matchAll(CHARACTER_TAG_PATTERN)];
    expect(matches.map((m) => m[1])).toEqual(["NochEin"]);
  });

  it("erzeugt Inline-Decorations für @Namen", () => {
    const doc = makeDoc([p("Hallo @Anna, wie geht es dir?")]);
    const decos = inlineDecos(createCharacterDecorations(doc, () => null));
    expect(decos).toHaveLength(1);
    expect(decos[0].class).toContain("character-tag");
    expect(decos[0]["data-character-name"]).toBe("Anna");
  });

  it("erzeugt mehrere Decorations für mehrere Tags", () => {
    const doc = makeDoc([p("@Anna trifft @Ben und @Cara.")]);
    const decos = inlineDecos(createCharacterDecorations(doc, () => null));
    expect(decos).toHaveLength(3);
  });

  it("erzeugt keine Decorations ohne @-Tags", () => {
    const doc = makeDoc([p("Ganz normaler Text.")]);
    expect(inlineDecos(createCharacterDecorations(doc, () => null))).toHaveLength(0);
  });
});

describe("SceneMarkerExtension", () => {
  it("definiert Szenen-Muster", () => {
    expect(SCENE_PATTERNS.length).toBeGreaterThan(0);
  });

  const cases: { text: string; type: string }[] = [
    { text: "***", type: "cut" },
    { text: "---", type: "divider" },
    { text: "### Szene: Im Wald", type: "scene-heading" },
    { text: "INT. BÜRO — NIGHT", type: "screenplay" },
    { text: "## SCHNITT: Nacht", type: "transition" },
  ];

  for (const { text, type } of cases) {
    it(`markiert "${text}" als ${type}`, () => {
      const doc = makeDoc([p(text)]);
      const decos = inlineDecos(createSceneDecorations(doc));
      expect(decos).toHaveLength(1);
      expect(decos[0]["data-scene-type"]).toBe(type);
    });
  }

  it("markiert normalen Text nicht", () => {
    const doc = makeDoc([p("Ganz normaler Absatz ohne Marker.")]);
    expect(inlineDecos(createSceneDecorations(doc))).toHaveLength(0);
  });
});

describe("ChapterOutlineExtension", () => {
  it("extrahiert Headings mit Level, Text und Position", () => {
    const doc = makeDoc([
      heading(1, "Kapitel Eins"),
      p("Text."),
      heading(2, "Erster Abschnitt"),
      heading(3, "Detail"),
    ]);
    const items = extractHeadings(doc);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ level: 1, text: "Kapitel Eins" });
    expect(items[1]).toMatchObject({ level: 2, text: "Erster Abschnitt" });
    expect(items[2]).toMatchObject({ level: 3, text: "Detail" });
    expect(typeof items[0].pos).toBe("number");
  });

  it("ignoriert leere Headings", () => {
    const doc = makeDoc([heading(1, ""), p("Normal.")]);
    expect(extractHeadings(doc)).toHaveLength(0);
  });

  it("liefert [] für ein Dokument ohne Headings", () => {
    const doc = makeDoc([p("nur Text")]);
    expect(extractHeadings(doc)).toEqual([]);
  });
});
