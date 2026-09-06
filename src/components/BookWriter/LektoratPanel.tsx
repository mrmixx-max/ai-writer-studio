// LektoratPanel: Style-Pass-Befunde für den BookWriter (Sprint 11, Agent 2).
//
// Standalone-Panel — bewusst KEINE Abhängigkeit zu BookWriterPanel oder
// ContinuityPanel (weder Import noch Änderung dort). Es bezieht Befunde rein
// aus `@/services/bookwriter/lektorat` und verwaltet Akzeptieren/Ablehnen in
// lokalem State. Optional: Umformulierung via injizierbares `complete`
// (Mock in Tests, `createOllamaComplete()` in Produktion) — ohne `complete`
// arbeitet das Panel vollständig offline.

import { useMemo, useState } from "react";
import {
  analyzeBook,
  countFindingsByType,
  rephraseWithLlm,
  type CompleteFn,
  type LektoratChapterInput,
  type LektoratFinding,
  type LektoratFindingType,
  type LektoratOptions,
} from "@/services/bookwriter/lektorat";
import "./bookwriter.css";

export interface LektoratPanelProps {
  /** Kapiteltexte (gelesen, nicht verändert). */
  chapters: LektoratChapterInput[];
  /** Optionale Analyse-Parameter (werden an `analyzeBook` gereicht). */
  options?: LektoratOptions;
  /** Injizierbare LLM-Funktion für Umformulierungen (optional, offline ohne). */
  complete?: CompleteFn;
  className?: string;
}

const TYPE_LABEL: Record<LektoratFindingType, string> = {
  repeated_word: "Wiederholung",
  sentence_variance: "Satzbau",
  passive_voice: "Passiv",
  dialogue_tag: "Dialog-Tag",
  filler_word: "Füllwort",
};

export function LektoratPanel({ chapters, options, complete, className }: LektoratPanelProps) {
  const findings = useMemo(() => analyzeBook(chapters, options), [chapters, options]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [rephrased, setRephrased] = useState<Record<string, string>>({});
  const [rephrasing, setRephrasing] = useState<string | null>(null);

  const keyOf = (f: LektoratFinding) => `${f.chapterId}:${f.type}:${f.position}`;
  const open = findings.filter(
    (f) => !accepted.includes(keyOf(f)) && !dismissed.includes(keyOf(f)),
  );
  const counts = countFindingsByType(open);

  const handleRephrase = async (f: LektoratFinding) => {
    if (!complete || rephrasing) return;
    const key = keyOf(f);
    setRephrasing(key);
    try {
      const chapter = chapters.find((c) => c.id === f.chapterId);
      const passage = chapter ? chapter.content.slice(f.position, f.position + 200) : "";
      const out = await rephraseWithLlm(f, passage, complete);
      setRephrased((prev) => ({ ...prev, [key]: out }));
    } finally {
      setRephrasing(null);
    }
  };

  return (
    <div className={className ?? "lektorat-panel"} data-testid="lektorat-panel">
      <h3>Lektorat</h3>
      <p className="ws-muted">
        {open.length} offene Befunde aus {chapters.length} Kapiteln
        {open.length > 0 &&
          ` (Wiederholung: ${counts.repeated_word}, Satzbau: ${counts.sentence_variance}, Passiv: ${counts.passive_voice}, Dialog-Tag: ${counts.dialogue_tag}, Füllwort: ${counts.filler_word})`}
      </p>

      {open.length === 0 && <p className="ws-muted">Keine Befunde — stilistisch sauber.</p>}

      <ul data-testid="lektorat-findings">
        {open.map((f) => {
          const key = keyOf(f);
          return (
            <li key={key} data-testid="lektorat-finding" data-type={f.type}>
              <strong>{TYPE_LABEL[f.type]}</strong> <span className="ws-muted">({f.chapterId}, Pos. {f.position})</span>
              <div>{f.suggestion}</div>
              <div className="ws-muted">{f.rationale}</div>
              {rephrased[key] && <div data-testid="lektorat-rephrase">{rephrased[key]}</div>}
              <button
                className="ws-btn"
                data-testid="lektorat-accept"
                onClick={() => setAccepted((a) => [...a, key])}
              >
                Übernehmen
              </button>
              <button
                className="ws-btn"
                data-testid="lektorat-dismiss"
                onClick={() => setDismissed((d) => [...d, key])}
              >
                Verwerfen
              </button>
              {complete && (
                <button
                  className="ws-btn"
                  data-testid="lektorat-rephrase-btn"
                  disabled={rephrasing === key}
                  onClick={() => void handleRephrase(f)}
                >
                  {rephrasing === key ? "Formuliert um …" : "Umformulieren"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
