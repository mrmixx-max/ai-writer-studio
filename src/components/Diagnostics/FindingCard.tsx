// Ein einzelner Befund mit Erklärung und Aktionen.
//
// Die drei Aktionen entsprechen deiner Anforderung: ignorieren, als bewusst
// markieren, Verbesserungsvorschlag erzeugen. Der Sprung zur Textstelle ist
// nur möglich, wenn der Befund eine Position hat — projektweite Befunde
// (Zeitlinie, Begriffsdrift) haben keine.

import { memo } from "react";
import type { Finding } from "@/services/diagnostics/runner";

interface Props {
  finding: Finding;
  /** Sprung zur Textstelle; fehlt, wenn keine Position vorliegt. */
  onJump: ((f: Finding) => void) | null;
  onIgnore: (f: Finding) => void;
  onAccept: (f: Finding) => void;
  onReopen: (f: Finding) => void;
  onSuggest: (f: Finding) => void;
  busy: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  character: "Figur",
  world: "Welt",
  timeline: "Zeitlinie",
  pov: "Perspektive",
  terminology: "Begriffe",
  style: "Stil",
};

const KIND_LABELS: Record<string, string> = {
  error: "Fehler",
  possible: "möglich",
  intentional: "bewusst",
};

export const FindingCard = memo(function FindingCard({
  finding: f,
  onJump,
  onIgnore,
  onAccept,
  onReopen,
  onSuggest,
  busy,
}: Props) {
  const resolved = f.status !== "open";

  return (
    <div className={`dg-finding ${f.severity}${resolved ? " resolved" : ""}`}>
      <div className="dg-f-head">
        <span className="dg-f-msg">{f.message}</span>
        <span className="dg-f-tags">
          <span className="dg-tag">{CATEGORY_LABELS[f.category] ?? f.category}</span>
          <span className={`dg-tag ${f.kind}`}>{KIND_LABELS[f.kind] ?? f.kind}</span>
          {/* Herkunft sichtbar machen: Regel oder Modell. */}
          {!f.ruleBased && <span className="dg-tag model">KI</span>}
        </span>
      </div>

      <div className="dg-f-where">
        {f.chapterTitle ? `Kapitel: ${f.chapterTitle}` : "projektweit"}
        {f.start !== null && ` · Position ${f.start}`}
        {f.status === "ignored" && " · ignoriert"}
        {f.status === "accepted" && " · als bewusst markiert"}
      </div>

      <div className="dg-f-expl">{f.explanation}</div>

      {f.snippet && <div className="dg-f-snippet selectable">{f.snippet}</div>}

      <div className="dg-f-acts">
        {onJump && f.start !== null && (
          <button className="dg-btn tiny" onClick={() => onJump(f)} disabled={busy}>
            zur Stelle
          </button>
        )}

        {resolved ? (
          <button className="dg-btn tiny" onClick={() => onReopen(f)} disabled={busy}>
            wieder öffnen
          </button>
        ) : (
          <>
            <button className="dg-btn tiny" onClick={() => onIgnore(f)} disabled={busy}>
              ignorieren
            </button>
            <button
              className="dg-btn tiny"
              onClick={() => onAccept(f)}
              disabled={busy}
              title="Der Befund ist eine bewusste literarische Entscheidung"
            >
              ist bewusst
            </button>
            <button
              className="dg-btn tiny"
              onClick={() => onSuggest(f)}
              disabled={busy}
              title="Verbesserungsvorschlag von der KI erzeugen"
            >
              Vorschlag
            </button>
          </>
        )}
      </div>
    </div>
  );
});
