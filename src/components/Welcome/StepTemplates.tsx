// Schritt 4: Vorlagen wählen (optional).
//
// Der Nutzer kann eine Buch-Vorlage, beliebig viele Figuren-Vorlagen
// und eine Plot-Vorlage ankreuzen. Alles optional — der Schritt lässt
// sich komplett leer lassen.

import { useState } from "react";
import { bookTemplates, characterTemplates, plotTemplates } from "@/services/templates";
import type { TemplateSelection } from "@/services/templates";

interface Props {
  selection: TemplateSelection;
  onChange: (s: TemplateSelection) => void;
}

export function StepTemplates({ selection, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleBook(id: string) {
    onChange({ ...selection, book: selection.book === id ? undefined : id });
  }
  function toggleCharacter(id: string) {
    const cur = selection.characters ?? [];
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    onChange({ ...selection, characters: next.length ? next : undefined });
  }
  function togglePlot(id: string) {
    onChange({ ...selection, plot: selection.plot === id ? undefined : id });
  }

  return (
    <>
      <div className="welcome-step-label">Schritt 4 von 5</div>
      <h2 className="welcome-step-title">Mit einer Vorlage starten?</h2>
      <p className="welcome-step-intro">
        Vorlagen legen Kapitel, Figurenprofile oder ein Struktur-Gerüst an.
        Alles bleibt frei editierbar — und alles ist optional.
      </p>

      <fieldset className="welcome-template-group">
        <legend>Buch</legend>
        {bookTemplates.map((t) => (
          <label key={t.id} className="welcome-option">
            <input
              type="radio"
              name="tpl-book"
              checked={selection.book === t.id}
              onChange={() => toggleBook(t.id)}
            />
            <span>
              <span className="welcome-option-title">
                {t.name} · {t.chapters.length} Kapitel · ca.{" "}
                {(t.targetWords / 1000).toFixed(0)}k Wörter
              </span>
              <span className="welcome-option-desc">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="welcome-template-group">
        <legend>Figuren</legend>
        {characterTemplates.map((t) => (
          <label key={t.id} className="welcome-option">
            <input
              type="checkbox"
              checked={selection.characters?.includes(t.id) ?? false}
              onChange={() => toggleCharacter(t.id)}
            />
            <span>
              <span className="welcome-option-title">{t.archetype}</span>
              <span className="welcome-option-desc">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="welcome-template-group">
        <legend>Plot</legend>
        {plotTemplates.map((t) => (
          <label key={t.id} className="welcome-option">
            <input
              type="radio"
              name="tpl-plot"
              checked={selection.plot === t.id}
              onChange={() => togglePlot(t.id)}
            />
            <span>
              <span className="welcome-option-title">
                {t.name} · {t.beats.length} Stationen
              </span>
              <span className="welcome-option-desc">{t.description}</span>
              {expanded === t.id ? null : (
                <button
                  type="button"
                  className="wbtn wbtn-quiet"
                  style={{ marginTop: 4 }}
                  onClick={(e) => {
                    e.preventDefault();
                    setExpanded(t.id);
                  }}
                >
                  Stationen zeigen
                </button>
              )}
              {expanded === t.id && (
                <ul>
                  {t.beats.map((b) => (
                    <li key={b.title}>
                      <strong>{b.title}</strong> — {b.description}
                    </li>
                  ))}
                </ul>
              )}
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
