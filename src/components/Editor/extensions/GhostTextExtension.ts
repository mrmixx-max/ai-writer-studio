// Ghost-Text-Vorschau und Tab-Erweiterung (WP2.2).
//
// Ablauf für den Autor:
//   1. Cursor setzen, Tab drücken.
//   2. Vorschlag erscheint ausgegraut als Vorschau.
//   3. Tab übernimmt, Escape verwirft, Weiterschreiben verwirft ebenfalls.
//
// Warum Tab und nicht eine Schaltfläche: Der Autor schreibt im Fluss. Ein
// Mausgriff zum Vorschlags-Knopf würde ihn aus dem Text reißen. Tab ist die
// Geste, die aus Code-Editoren vertraut ist.
//
// Wichtig: Tab darf seine normale Funktion (Einrückung) nicht verlieren,
// wenn kein Vorschlag ansteht. Deshalb prüft der Handler zuerst, ob eine
// Vorschau existiert.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

export const ghostTextPluginKey = new PluginKey("ghostText");

/** Zustand der Vorschau im Editor. */
export interface GhostTextState {
  /** Der Vorschlag, oder null wenn keiner ansteht. */
  suggestion: string | null;
  /** Position, an der eingefügt würde. */
  pos: number | null;
  /** true, während ein Vorschlag angefordert wird (verhindert Doppelanfragen). */
  loading: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ghostText: {
      /** Setzt einen Vorschlag an der aktuellen Cursorposition. */
      setGhostSuggestion: (suggestion: string) => ReturnType;
      /** Entfernt die Vorschau. */
      clearGhostSuggestion: () => ReturnType;
    };
  }
}

/**
 * TipTap-Extension für die Ghost-Text-Vorschau.
 *
 * Die Vorschau ist eine Dekoration, KEIN Dokumentinhalt. Das ist der
 * entscheidende Punkt: Solange der Autor nicht bestätigt, ist der Vorschlag
 * nicht Teil des Manuskripts — er kann nicht versehentlich gespeichert werden.
 */
export const GhostTextExtension = Extension.create({
  name: "ghostText",

  addOptions() {
    return {
      /** Callback, der den Vorschlag holt. Gibt null, wenn keiner entsteht. */
      suggest: null as ((context: string) => Promise<string | null>) | null,
    };
  },

  addCommands() {
    return {
      setGhostSuggestion:
        (suggestion: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(ghostTextPluginKey, {
              type: "set",
              suggestion,
              pos: tr.selection.from,
            });
          }
          return true;
        },
      clearGhostSuggestion:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(ghostTextPluginKey, { type: "clear" });
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: ghostTextPluginKey,
        state: {
          init(): GhostTextState {
            return { suggestion: null, pos: null, loading: false };
          },
          apply(tr, value: GhostTextState): GhostTextState {
            const meta = tr.getMeta(ghostTextPluginKey) as
              | { type: "set"; suggestion: string; pos: number }
              | { type: "clear" }
              | { type: "loading"; loading: boolean }
              | undefined;

            if (meta?.type === "set") {
              return { suggestion: meta.suggestion, pos: meta.pos, loading: false };
            }
            if (meta?.type === "clear") {
              return { suggestion: null, pos: null, loading: false };
            }
            if (meta?.type === "loading") {
              return { ...value, loading: meta.loading };
            }
            // Jede Dokumentänderung verwirft die Vorschau: Sie bezog sich auf
            // einen Textzustand, der nicht mehr gilt.
            if (tr.docChanged) {
              return { suggestion: null, pos: null, loading: false };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const s = ghostTextPluginKey.getState(state) as GhostTextState | undefined;
            if (!s?.suggestion || s.pos === null) return DecorationSet.empty;
            const widget = Decoration.widget(
              s.pos,
              () => {
                const span = document.createElement("span");
                span.className = "ghost-text";
                span.setAttribute("aria-hidden", "true");
                span.textContent = s.suggestion ?? "";
                return span;
              },
              { side: 1 },
            );
            return DecorationSet.create(state.doc, [widget]);
          },

          handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
            const s = ghostTextPluginKey.getState(view.state) as GhostTextState | undefined;

            // Escape verwirft eine anstehende Vorschau.
            if (event.key === "Escape" && s?.suggestion) {
              view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, { type: "clear" }));
              return true;
            }

            if (event.key !== "Tab") return false;

            // 1) Vorschau anstehend → übernehmen.
            if (s?.suggestion) {
              const pos = s.pos ?? view.state.selection.from;
              const tr = view.state.tr.insertText(s.suggestion, pos);
              tr.setMeta(ghostTextPluginKey, { type: "clear" });
              view.dispatch(tr);
              return true;
            }

            // 2) Kein Vorschlag, aber einer wird geladen → Tab schlucken,
            //    sonst würde er den Cursor einrücken und die Anfrage verwerfen.
            if (s?.loading) return true;

            // 3) Nichts anstehend → Vorschlag anfordern. Die normale
            //    Tab-Funktion bleibt damit erhalten, wenn kein Anbieter
            //    konfiguriert ist.
            const suggest = options.suggest as ((context: string) => Promise<string | null>) | null;
            if (!suggest) return false;

            const context = view.state.doc.textBetween(0, view.state.selection.from, "\n\n");
            if (!context.trim()) return false;

            view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, { type: "loading", loading: true }));
            void suggest(context)
              .then((suggestion) => {
                if (!suggestion) {
                  view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, { type: "loading", loading: false }));
                  return;
                }
                const tr = view.state.tr.setMeta(ghostTextPluginKey, {
                  type: "set",
                  suggestion,
                  pos: view.state.selection.from,
                });
                view.dispatch(tr);
              })
              .catch(() => {
                view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, { type: "loading", loading: false }));
              });
            return true;
          },
        },
      }),
    ];
  },
});
