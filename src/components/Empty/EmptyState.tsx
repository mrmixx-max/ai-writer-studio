// Wiederverwendbare Bausteine für leere Zustände.
//
// Grundsatz: Ein leerer Bereich erklärt, was er ist, und nennt genau einen
// nächsten Schritt. Keine Ausrufezeichen, keine Illustrationen.

import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  text: string;
  /** Knöpfe oder Links. */
  children?: ReactNode;
  /** Fußnote, z. B. Tastenkürzel. */
  hint?: ReactNode;
  /** Kompakte Variante für Seitenleisten. */
  compact?: boolean;
}

export function EmptyState({ title, text, children, hint, compact }: EmptyStateProps) {
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <div className="empty-inner">
        <div className="empty-rule" />
        <h2 className="empty-title">{title}</h2>
        <p className="empty-text">{text}</p>
        {children && <div className="empty-actions">{children}</div>}
        {hint && <div className="empty-hint">{hint}</div>}
      </div>
    </div>
  );
}

interface StepsProps {
  steps: Array<{ title: string; text: string }>;
}

/** Nummerierte Schrittliste für den echten Erststart. */
export function EmptySteps({ steps }: StepsProps) {
  return (
    <ol className="empty-steps">
      {steps.map((s, i) => (
        <li className="empty-step" key={s.title}>
          <span className="empty-step-num">{i + 1}</span>
          <span>
            <strong>{s.title}</strong>
            {" — "}
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
