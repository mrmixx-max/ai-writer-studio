// HelpPanel: durchsuchbares Kurzhilfe-Overlay (Sprint 10, Agent 4).
//
// Standalone-Komponente — verändert KEINE bestehenden Panels.
// Nutzt nur helpIndex.ts (DE-Einträge + EN-Fallback).
import { useMemo, useRef, useState } from "react";
import {
  HELP_ENTRIES,
  helpBody,
  helpTitle,
  searchHelp,
} from "./helpIndex";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface HelpPanelProps {
  /** Sprachcode, z. B. "de" oder "en". Default "de". */
  lang?: string;
  /** Titel der Panel-Überschrift. */
  heading?: string;
  /** Wird beim Schließen aufgerufen (falls Overlay mit ✕ genutzt wird). */
  onClose?: () => void;
  /** Initial geöffneter Eintrag (ID). */
  initialOpenId?: string | null;
}

export function HelpPanel({
  lang = "de",
  heading = "Hilfe",
  onClose,
  initialOpenId = null,
}: HelpPanelProps) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const panelRef = useRef<HTMLElement>(null);
  // Overlay-Modus = onClose gesetzt: Fokus-Falle + ESC + Fokus-Restore.
  // Eingebettet (ohne onClose) bleibt das Panel eine passive Section.
  const overlay = onClose !== undefined;
  useFocusTrap(panelRef, onClose, { enabled: overlay });

  const results = useMemo(() => searchHelp(query), [query]);
  const isEn = lang.startsWith("en");

  return (
    <section
      ref={panelRef}
      className="help-panel"
      aria-label={heading}
      {...(overlay ? { role: "dialog", "aria-modal": true } : {})}
    >
      <div className="help-panel-head">
        <h3>{heading}</h3>
        {onClose && (
          <button type="button" onClick={onClose} title="Hilfe schließen" aria-label="Hilfe schließen">
            ✕
          </button>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isEn ? "Search help…" : "Hilfe durchsuchen…"}
        aria-label={isEn ? "Search help" : "Hilfe durchsuchen"}
      />

      {results.length === 0 ? (
        <p className="help-panel-empty">
          {isEn ? "No help found." : "Keine Hilfe gefunden."}
        </p>
      ) : (
        <ul className="help-panel-list">
          {results.map((e) => {
            const open = openId === e.id;
            return (
              <li key={e.id} className="help-panel-item">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.id)}
                  aria-expanded={open}
                >
                  {helpTitle(e, lang)}
                </button>
                {open && (
                  <p className="help-panel-body">{helpBody(e, lang)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="help-panel-count">
        {results.length}/{HELP_ENTRIES.length}
      </p>
    </section>
  );
}

export default HelpPanel;
