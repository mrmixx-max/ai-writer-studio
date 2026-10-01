// Live-Konsistenz-Anzeige (WP3.1).
//
// Zeigt Widersprüche diskret am Rand an — nicht als Dialog, nicht als Modal.
// Der Autor soll beim Schreiben nicht unterbrochen werden; er soll die
// Möglichkeit haben, hinzusehen. Ein Widerspruch ist ein Hinweis, keine
// Blockade: Es kann eine gewollte Veränderung sein.

import { useEffect, useState, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { checkTextLive, filterIntentionalChanges, type LiveFinding } from "@/services/editor/liveConsistency";
import { getLogger } from "@/services/logger";

const log = getLogger("editor/liveConsistencyPanel");

export interface LiveConsistencyPanelProps {
  /** Text, der geprüft wird (der reine Kapiteltext). */
  text: string;
  /** Prüfung ausschalten (z. B. im Fokusmodus). */
  enabled?: boolean;
}

/** Prüfintervall: Der Wächter läuft nicht bei jedem Tastendruck. */
export const LIVE_CHECK_DEBOUNCE_MS = 2500;

/**
 * Randbereich mit Konsistenz-Hinweisen.
 *
 * Die Prüfung läuft entprellt im Hintergrund: Bei jedem Tastendruck zu prüfen
 * würde den Wächter selbst zur Bremse machen. 2,5 s nach dem letzten
 * Tastendruck ist er schnell genug, um beim Schreiben relevant zu sein, und
 * selten genug, um nicht zu stören.
 */
export function LiveConsistencyPanel({ text, enabled = true }: LiveConsistencyPanelProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [findings, setFindings] = useState<LiveFinding[]>([]);
  const [expanded, setExpanded] = useState(true);

  const runCheck = useCallback(() => {
    if (!enabled || !activeProjectId || !text.trim()) {
      setFindings([]);
      return;
    }
    try {
      const result = checkTextLive(text, activeProjectId);
      setFindings(filterIntentionalChanges(result.findings));
    } catch (e: unknown) {
      // Ein fehlgeschlagener Wächter darf das Schreiben nicht stören.
      log.warn(`Konsistenzprüfung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      setFindings([]);
    }
  }, [text, activeProjectId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(runCheck, LIVE_CHECK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [runCheck, enabled]);

  if (!enabled || findings.length === 0) return null;

  return (
    <aside className="live-consistency" aria-label="Konsistenz-Hinweise">
      <button
        type="button"
        className="live-consistency-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        {findings.length === 1 ? "1 Hinweis" : `${findings.length} Hinweise`}
      </button>

      {expanded && (
        <ul className="live-consistency-list">
          {findings.map((f, i) => (
            <li key={`${f.characterId}-${f.category}-${i}`} className="live-consistency-item">
              <span className="lc-character">{f.characterName}</span>
              <span className="lc-detail">
                {f.categoryLabel}: {f.expected} laut Figurendaten, „{f.found}" im Text
              </span>
              <span className="lc-excerpt" title={f.excerpt}>
                {f.excerpt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** Speist den zu prüfenden Text aus dem Editor-Store. */
export function useLiveCheckText(): string {
  // Nur den Inhalt abonnieren, nicht den ganzen Store.
  const content = useEditorStore((s) => s.content);
  return content;
}
