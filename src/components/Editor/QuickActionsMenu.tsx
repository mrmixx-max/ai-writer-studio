// Bubble-Menü mit Schnellaktionen (WP2.2).
//
// Erscheint über einer Textauswahl und bietet die drei redaktionellen
// Schnellaktionen an. Nutzt TipTap 3 `BubbleMenu` — im Repo bisher nicht
// verwendet, deshalb hier gekapselt: Der Editor bleibt frei von der
// Menü-Detailkenntnis.

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { QUICK_ACTIONS, runQuickAction, type QuickActionId } from "@/services/editor/quickActions";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { completeOnce } from "@/services/llm";
import { getLogger } from "@/services/logger";

const log = getLogger("editor/quickActionsMenu");

export interface QuickActionsMenuProps {
  editor: Editor | null;
  /** Kapiteltitel für den Prompt-Kontext. */
  chapterTitle?: string;
}

/**
 * Menü über der Textauswahl.
 *
 * Ablauf beim Klick:
 *  1. Markierten Text und Bereich merken (die Auswahl geht beim Modellaufruf
 *     verloren, weil der Fokus wechselt).
 *  2. Aktion ausführen, Ergebnis in das Dokument einsetzen.
 *  3. Bei Fehler: Meldung anzeigen, Text unverändert lassen.
 *
 * Es wird NICHTS verändert, solange der Modellaufruf läuft — erst das
 * Ergebnis ersetzt die Auswahl. Ein Zwischenzustand würde bei einem Fehler
 * die Textstelle zerstören.
 */
export function QuickActionsMenu({ editor, chapterTitle }: QuickActionsMenuProps) {
  const { settings } = useActiveModel();
  const [busy, setBusy] = useState<QuickActionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!editor) return null;

  const handleAction = async (action: QuickActionId) => {
    const { from, to } = editor.state.selection;
    const passage = editor.state.doc.textBetween(from, to, "\n\n");
    if (!passage.trim()) return;

    setBusy(action);
    setError(null);

    try {
      const result = await runQuickAction(
        action,
        passage,
        (prompt) => completeOnce(settings, prompt),
        { title: chapterTitle, language: settings.language === "de" ? "Deutsch" : undefined },
      );
      // Nur bei Erfolg ersetzen. insertContentAt mit dem gemerkten Bereich
      // trifft die Stelle auch dann, wenn der Fokus zwischenzeitlich wechselte.
      editor.chain().focus().insertContentAt({ from, to }, result.text).run();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn(`Schnellaktion ${action} fehlgeschlagen: ${msg}`);
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ from, to }) => from !== to}
      options={{ placement: "top", offset: 8 }}
    >
      <div className="quick-actions-menu" role="toolbar" aria-label="Schnellaktionen">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="quick-action-btn"
            title={a.hint}
            disabled={busy !== null}
            onClick={() => { void handleAction(a.id); }}
          >
            {busy === a.id ? "…" : a.label}
          </button>
        ))}
        {error && (
          <span className="quick-action-error" role="alert" title={error}>
            Fehlgeschlagen
          </span>
        )}
      </div>
    </BubbleMenu>
  );
}
