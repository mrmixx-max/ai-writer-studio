// Beispiel-Plugin: Word-Count-Badge.
//
// Registriert ein Badge in der Statusleiste, das die geschätzte Lesedauer
// anzeigt. Dient zugleich als Vorlage für eigene Plugins:
// Hooks, Events und Badges kommen alle einmal vor.

import type { PluginDefinition } from "../types";

/** Grobe Lesedauer-Schätzung: 220 Wörter pro Minute. */
function estimateReadingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}

export const wordCountBadgePlugin: PluginDefinition = {
  manifest: {
    id: "word-count-badge",
    name: "Word-Count-Badge",
    version: "0.1.0",
    description: "Zeigt die geschätzte Lesedauer als Badge in der Statusleiste.",
    author: "AI Writer Studio",
    apiVersion: "0.1.0",
  },
  activate(ctx) {
    ctx.log.info("Word-Count-Badge aktiv");

    ctx.registerBadge("reading-time", ({ wordCount }) => (
      <span
        className="plugin-badge"
        title="Geschätzte Lesedauer bei 220 Wörtern pro Minute"
      >
        ≈ {estimateReadingMinutes(wordCount)} Min. Lesezeit
      </span>
    ));

    // Editor-Hook demonstrieren: Inhalt durchreichen und ein Event absetzen.
    ctx.onHook("editor:content-change", (value) => {
      const json = typeof value === "string" ? value : "";
      let paragraphs = 0;
      try {
        const doc = JSON.parse(json) as { content?: unknown[] };
        paragraphs = doc.content?.length ?? 0;
      } catch {
        /* Inhalt ist kein Tiptap-JSON — ignorieren */
      }
      ctx.emitEvent("wordcount:changed", { paragraphs });
      return value;
    });

    ctx.onEvent("wordcount:changed", (payload) => {
      ctx.log.info(`Absätze: ${(payload as { paragraphs?: number })?.paragraphs ?? 0}`);
    });
  },
  deactivate() {
    // Hier müssten langlaufende Ressourcen (Timer, Subscriptions außerhalb
    // des Kontexts) freigegeben werden — Badges/Hooks räumt der Manager ab.
    console.info("[word-count-badge] deaktiviert");
  },
};
