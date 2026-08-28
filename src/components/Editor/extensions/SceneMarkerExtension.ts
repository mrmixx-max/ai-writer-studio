// SceneMarkerExtension: Markiert Szenenübergänge im Text.
//
// Erkennt Muster wie:
//   *** (Schnitt)
//   ### Szene (Szenenüberschrift mit Hashes)
//   --- (horizontale Linie als Szenegrenze)
//   INT./EXT. ORTAG — Standard-Szenenheader (Screenplay-Format)
//
// Diese werden als visuell hervorgehobene Block- oder Inline-Elemente gerendert.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface SceneMarkerOptions {
  /** Zusätzliche benutzerdefinierte Muster als Regex-Strings. */
  customPatterns?: string[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneMarker: {
      /** Aktualisiert die Scene-Marker-Decorations. */
      refreshSceneMarkers: () => ReturnType;
    };
  }
}

// Standard-Muster für Szenenübergänge
// Exportiert für Unit-Tests.
export const SCENE_PATTERNS: { regex: RegExp; type: string }[] = [
  // *** (Schnitt-Markierung)
  { regex: /^\*\*\*\s*$/m, type: "cut" },
  // --- (horizontale Linie)
  { regex: /^---\s*$/m, type: "divider" },
  // ### Szene oder ### irgendwas
  { regex: /^###\s+.+$/m, type: "scene-heading" },
  // INT./EXT. ... (Screenplay-Format)
  { regex: /^(INT\.|EXT\.|INT\.\/EXT\.)\s+.+—?\s*(DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS)?/im, type: "screenplay" },
  // ## SCHNITT: Beschreibung
  { regex: /^#{2,3}\s*(SCHNITT|FADE|CUT|DISSOLVE|ÜBERGANG)/im, type: "transition" },
];

/**
 * Erzeugt Block-Decorations für Szenenübergänge.
 * Exportiert für Unit-Tests.
 */
export function createSceneDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    for (const pattern of SCENE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(node.text);
      if (match) {
        const from = pos + match.index;
        const to = from + match[0].length;

        decorations.push(
          Decoration.inline(from, to, {
            class: `scene-marker scene-marker--${pattern.type}`,
            "data-scene-type": pattern.type,
          })
        );
        break; // Nur eine Markierung pro Textstelle
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const SceneMarkerExtension = Extension.create<SceneMarkerOptions>({
  name: "sceneMarker",

  addOptions() {
    return {
      customPatterns: [],
    };
  },

  addCommands() {
    return {
      refreshSceneMarkers:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta("sceneMarkerRefresh", true);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("sceneMarkerDecorations");

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, state) {
            return createSceneDecorations(state.doc);
          },
          apply(tr, oldSet) {
            if (
              tr.docChanged ||
              tr.getMeta("sceneMarkerRefresh")
            ) {
              return createSceneDecorations(tr.doc);
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
