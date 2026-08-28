// ChapterOutlineExtension: Verfolgt Überschriften im Dokument und stellt
// sie für die Sidebar-Komponente bereit.
//
// Die Extension selbst erzeugt keine Decorations, sondern hält den
// aktuellen Outline-Zustand (Liste der Headings) im Editor-Storage.
// Die React-Komponente `ChapterOutlinePanel` liest diesen Zustand aus.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

export interface ChapterOutlineOptions {
  /** Callback, wenn sich die Gliederung ändert. */
  onUpdate?: (items: OutlineItem[]) => void;
}

// PluginKey für den Outline-State
const outlinePluginKey = new PluginKey("chapterOutline");

/**
 * Extrahiert alle Headings aus dem Dokument.
 * Exportiert für Unit-Tests.
 */
export function extractHeadings(doc: ProseMirrorNode): OutlineItem[] {
  const items: OutlineItem[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level || 1;
      const text = node.textContent.trim();
      if (text) {
        items.push({ level, text, pos });
      }
    }
  });

  return items;
}

export const ChapterOutlineExtension = Extension.create<ChapterOutlineOptions>({
  name: "chapterOutline",

  addOptions() {
    return {
      onUpdate: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onUpdate } = this.options;

    return [
      new Plugin({
        key: outlinePluginKey,
        state: {
          init(_, state) {
            const items = extractHeadings(state.doc);
            // Callback asynchron aufrufen, um Endlosschleife zu vermeiden
            if (onUpdate) {
              queueMicrotask(() => onUpdate(items));
            }
            return items;
          },
          apply(tr, items, _oldState, newState) {
            if (tr.docChanged) {
              const newItems = extractHeadings(newState.doc);
              // Nur bei Änderung Callback ausführen
              if (onUpdate && !arraysEqual(items, newItems)) {
                queueMicrotask(() => onUpdate(newItems));
              }
              return newItems;
            }
            return items;
          },
        },
      }),
    ];
  },
});

function arraysEqual(a: OutlineItem[], b: OutlineItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].level !== b[i].level || a[i].text !== b[i].text || a[i].pos !== b[i].pos) {
      return false;
    }
  }
  return true;
}

/** Hilfsfunktion: Outline aus dem Editor-Instanz lesen. */
export function getOutlineFromEditor(editor: any): OutlineItem[] {
  const pluginState = outlinePluginKey.getState(editor.state);
  return pluginState || [];
}
