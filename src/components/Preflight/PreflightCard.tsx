// Eine Preflight-Befundkarte.
//
// Unterschied zur Diagnostik-Karte: Preflight-Befunde haben einen Formatbezug
// und oft einen Strukturhinweis statt eines Textausschnitts — etwa
// "Kapitel 3 von 12, 0 Wörter" bei einem leeren Kapitel.

import { memo } from "react";
import type { PreflightFinding } from "@/types/preflight";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  KIND_LABELS,
  FORMAT_LABELS,
} from "@/types/preflight";

interface Props {
  finding: PreflightFinding;
  /** Sprung zur Textstelle; null, wenn der Befund keine hat. */
  onJump: ((f: PreflightFinding) => void) | null;
  onIgnore: (f: PreflightFinding) => void;
  onAccept: (f: PreflightFinding) => void;
  onReopen: (f: PreflightFinding) => void;
  onSuggest: (f: PreflightFinding) => void;
  /** Regel dauerhaft für dieses Projekt abschalten. */
  onDisableRule: (f: PreflightFinding) => void;
  busy: boolean;
}

export const PreflightCard = memo(function PreflightCard({
  finding: f,
  onJump,
  onIgnore,
  onAccept,
  onReopen,
  onSuggest,
  onDisableRule,
  busy,
}: Props) {
  const resolved = f.status !== "open";

  return (
    <div className={`dg-finding ${f.severity === "blocker" ? "high" : f.severity === "warning" ? "medium" : "low"}${resolved ? " resolved" : ""}`}>
      <div className="dg-f-head">
        <span className="dg-f-msg">{f.title}</span>
        <span className="dg-f-tags">
          <span className="dg-tag">{CATEGORY_LABELS[f.category]}</span>
          <span className={`dg-tag${f.severity === "blocker" ? " error" : ""}`}>
            {SEVERITY_LABELS[f.severity]}
          </span>
          {f.kind === "intentional" && (
            <span className="dg-tag intentional">{KIND_LABELS.intentional}</span>
          )}
        </span>
      </div>

      <div className="dg-f-where">
        {f.chapterTitle ? `Kapitel: ${f.chapterTitle}` : "projektweit"}
        {/* Formatbezug sichtbar machen: Leer heißt "gilt für alle". */}
        {f.affectedFormats.length > 0 && (
          <> · {f.affectedFormats.map((x) => FORMAT_LABELS[x]).join(", ")}</>
        )}
        {f.affectedFormats.length === 0 && " · alle Formate"}
        {f.status === "ignored" && " · ignoriert"}
        {f.status === "accepted" && " · bewusst so gelassen"}
      </div>

      <div className="dg-f-expl">{f.explanation}</div>

      {f.recommendation && (
        <div className="dg-f-expl" style={{ color: "var(--fg)" }}>
          <strong style={{ fontWeight: 400 }}>Empfehlung:</strong> {f.recommendation}
        </div>
      )}

      {/* Textausschnitt, wenn vorhanden — sonst der Strukturhinweis. */}
      {f.excerpt ? (
        <div className="dg-f-snippet selectable">{f.excerpt}</div>
      ) : f.structureHint ? (
        <div className="dg-f-snippet selectable">{f.structureHint}</div>
      ) : null}

      <div className="dg-f-acts">
        {onJump && f.chapterId && (
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
              title="Der Befund ist eine bewusste Entscheidung und soll so bleiben"
            >
              bewusst so
            </button>
            <button className="dg-btn tiny" onClick={() => onSuggest(f)} disabled={busy}>
              Vorschlag
            </button>
            <button
              className="dg-btn tiny"
              onClick={() => onDisableRule(f)}
              disabled={busy}
              title={`Regel „${f.ruleId}“ für dieses Projekt dauerhaft abschalten`}
            >
              Regel aus
            </button>
          </>
        )}
      </div>
    </div>
  );
});
