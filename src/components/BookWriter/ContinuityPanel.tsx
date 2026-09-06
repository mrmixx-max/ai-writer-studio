// ContinuityPanel: Kontinuitäts-Ledger für den BookWriter (Sprint 10, Agent 1).
//
// Standalone-Panel — bewusst KEINE Abhängigkeit zum BookWriterPanel
// (weder Import noch Änderung dort). Es bezieht Ledger, Widersprüche und
// Kapitel-Brief rein aus `@/services/bookwriter/continuity` und rendert
// sie als Übersicht für lange Bücher (Charaktere, Orte, Begriffe, Zeit).
//
// Optionale LLM-Anreicherung über injizierbares `complete` (Mock in Tests,
// `createOllamaComplete()` in Produktion) — ohne `complete` arbeitet das
// Panel vollständig offline.

import { useMemo, useState } from "react";
import {
  buildChapterBrief,
  buildLedger,
  detectContradictions,
  enrichLedgerWithLlm,
  type ChapterInput,
  type CompleteFn,
  type EntityKind,
  type NextChapterInput,
} from "@/services/bookwriter/continuity";
import "./bookwriter.css";

export interface ContinuityPanelProps {
  /** Kapiteltexte (gelesen, nicht verändert). */
  chapters: ChapterInput[];
  /** Nächstes Kapitel für den Brief (optional). */
  nextChapter?: NextChapterInput;
  /** Bisherige Kapitel-Zusammenfassungen (optional). */
  prevSummaries?: string[];
  /** Injizierbare LLM-Funktion für die Anreicherung (optional, offline ohne). */
  complete?: CompleteFn;
  className?: string;
}

const KIND_LABEL: Record<EntityKind, string> = {
  character: "Charakter",
  place: "Ort",
  term: "Begriff",
  timeline: "Zeit",
};

export function ContinuityPanel({
  chapters,
  nextChapter,
  prevSummaries = [],
  complete,
  className,
}: ContinuityPanelProps) {
  const [enrichNote, setEnrichNote] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [extraRound, setExtraRound] = useState(0);

  const ledger = useMemo(
    () => buildLedger(chapters),
    [chapters, extraRound],
  );
  const contradictions = useMemo(
    () => detectContradictions(ledger, chapters),
    [ledger, chapters],
  );
  const brief = useMemo(
    () =>
      nextChapter
        ? buildChapterBrief(ledger, contradictions, nextChapter, prevSummaries)
        : null,
    [ledger, contradictions, nextChapter, prevSummaries],
  );

  const handleEnrich = async () => {
    if (!complete || chapters.length === 0 || enriching) return;
    setEnriching(true);
    setEnrichNote(null);
    try {
      let added = 0;
      for (let i = 0; i < chapters.length; i++) {
        const res = await enrichLedgerWithLlm(ledger, chapters[i].content, i, complete);
        added += res.added;
        // LLM-Notizen direkt ins gemerkte Ledger übernehmen (lokal, kein
        // Schreiben in bestehende Stores — Panel bleibt lesend).
        for (const e of res.ledger.entities) {
          const slot = ledger.entities.find((x) => x.name === e.name);
          if (slot && e.note && !slot.note) slot.note = e.note;
        }
      }
      setEnrichNote(
        added > 0
          ? `${added} LLM-Ergänzung(en) übernommen.`
          : "Keine neuen LLM-Entitäten gefunden.",
      );
      setExtraRound((r) => r + 1);
    } catch (e) {
      setEnrichNote(`Anreicherung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnriching(false);
    }
  };

  const errors = contradictions.filter((c) => c.severity === "error").length;

  return (
    <div
      className={className ?? "continuity-panel"}
      data-testid="continuity-panel"
    >
      <h3>📖 Kontinuität</h3>
      <p className="ws-muted">
        {ledger.entities.length} Entitäten aus {ledger.chapterCount} Kapiteln
        {contradictions.length > 0 && ` — ${contradictions.length} Hinweis(e), davon ${errors} Fehler`}
      </p>

      {complete && chapters.length > 0 && (
        <button
          className="ws-btn"
          onClick={handleEnrich}
          disabled={enriching}
          data-testid="continuity-enrich-btn"
        >
          {enriching ? "Reichert an …" : "Per LLM anreichern"}
        </button>
      )}
      {enrichNote && <p className="ws-muted" data-testid="continuity-enrich-note">{enrichNote}</p>}

      {ledger.entities.length === 0 ? (
        <p className="ws-muted">Noch keine Entitäten — Kapitel hinzufügen.</p>
      ) : (
        <table className="ws-table" data-testid="continuity-ledger-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Art</th>
              <th>Kapitel</th>
              <th>Varianten</th>
            </tr>
          </thead>
          <tbody>
            {ledger.entities.map((e) => (
              <tr key={e.name}>
                <td>{e.name}</td>
                <td>{KIND_LABEL[e.kind]}</td>
                <td>{e.chapters.map((c) => c + 1).join(", ")}</td>
                <td>{e.aliases.length > 0 ? e.aliases.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {contradictions.length > 0 && (
        <div data-testid="continuity-contradictions">
          <h4>⚠️ Widersprüche</h4>
          <ul>
            {contradictions.map((c, i) => (
              <li key={i} className={c.severity === "error" ? "issue-error" : "issue-warning"}>
                <strong>[{c.severity}] {c.type}</strong>
                {c.chapterIndex >= 0 && ` (Kapitel ${c.chapterIndex + 1})`}: {c.details}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief && (
        <div data-testid="continuity-brief">
          <h4>📝 Brief für Kapitel {brief.forChapter + 1}</h4>
          <pre className="ws-pre">{brief.promptBlock}</pre>
        </div>
      )}
    </div>
  );
}
