// CharacterTagExtension: Markiert @CharakterName als Inline-Mark mit Tooltip.
//
// Erkennt das Muster @Wort im Text und wendet einen speziellen Mark an,
// der als hervorgehobener Span gerendert wird. Bei Hover erscheint ein
// Tooltip mit Charakter-Infos (wenn vorhanden).

import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface CharacterInfo {
  name: string;
  role?: string;
  age?: string;
  traits?: string;
  notes?: string;
}

export interface CharacterTagOptions {
  /** Callback zum Abrufen von Charakter-Infos für einen Namen. */
  getCharacterInfo?: (name: string) => CharacterInfo | null;
  /** HTML-Attribute für den Span. */
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    characterTag: {
      /** Setzt den CharacterTag-Mark für die aktuelle Auswahl. */
      setCharacterTag: (name: string) => ReturnType;
      /** Entfernt den CharacterTag-Mark. */
      unsetCharacterTag: () => ReturnType;
      /** Erkennt @-Muster im Text und wendet Marks an. */
      detectCharacterTags: () => ReturnType;
    };
  }
}

/**
 * Regex für @CharakterName: @ gefolgt von Großbuchstaben + Rest.
 * Unterstützt "Vorname Nachname" mit Leerzeichen.
 */
const CHARACTER_TAG_PATTERN =
  /@([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ]+(?:\s+[A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ]+)*)/g;

/**
 * Erzeugt Decorations für alle @CharakterName-Vorkommen im Dokument.
 * Exportiert für Unit-Tests.
 */
export function createCharacterDecorations(
  doc: ProseMirrorNode,
  getCharacterInfo?: (name: string) => CharacterInfo | null
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    CHARACTER_TAG_PATTERN.lastIndex = 0;
    while ((match = CHARACTER_TAG_PATTERN.exec(node.text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      const name = match[1];
      const info = getCharacterInfo?.(name) ?? null;

      const tooltipText = info
        ? `${name}${info.role ? ` — ${info.role}` : ""}${info.age ? `, ${info.age}` : ""}`
        : name;

      decorations.push(
        Decoration.inline(
          from,
          to,
          {
            class: "character-tag",
            "data-character-name": name,
            "data-tooltip": tooltipText,
          },
          { inclusiveStart: false, inclusiveEnd: false }
        )
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const CharacterTagExtension = Mark.create<CharacterTagOptions>({
  name: "characterTag",

  addOptions() {
    return {
      getCharacterInfo: undefined,
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: "span[data-character-name]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const charName = HTMLAttributes["data-character-name"] || "";
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, {
        class: "character-tag",
        "data-character-name": charName,
        "data-tooltip": `Charakter: ${charName}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCharacterTag:
        (name) =>
        ({ commands }) => {
          return commands.setMark(this.name, { "data-character-name": name });
        },
      unsetCharacterTag:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      detectCharacterTags:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta("characterTagDetect", true);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("characterTagDecorations");
    const { getCharacterInfo } = this.options;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, state) {
            return createCharacterDecorations(state.doc, getCharacterInfo);
          },
          apply(tr, oldSet) {
            if (tr.docChanged || tr.getMeta("characterTagDetect")) {
              return createCharacterDecorations(tr.doc, getCharacterInfo);
            }
            return oldSet.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export { CHARACTER_TAG_PATTERN };
