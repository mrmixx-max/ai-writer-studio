// „Frage an das Projekt“ — KI-Antwort auf Basis des Wissensindex.
//
// Zwei Produktregeln sichtbar umgesetzt:
//   1. Der Kontext ist vor dem Senden einsehbar (Knopf „Kontext ansehen“).
//   2. Ohne Modell gibt es die rohen Fundstellen statt eines Fehlers.

import type { AskResult, ProjectQuestionKind } from "@/services/knowledge/ask";

interface Props {
  question: string;
  onQuestionChange: (q: string) => void;
  result: AskResult | null;
  preview: string | null;
  busy: boolean;
  hasIndex: boolean;
  onAsk: () => void;
  onPreview: () => void;
  onQuickAsk: (kind: ProjectQuestionKind, subject: string) => void;
}

/** Vorgefertigte Fragen, die ohne Tippen zum Ergebnis führen. */
const QUICK: Array<{ kind: ProjectQuestionKind; label: string; needsSubject: boolean }> = [
  { kind: "conflicts", label: "Offene Konflikte", needsSubject: false },
  { kind: "about", label: "Was weiss das Projekt über…", needsSubject: true },
  { kind: "mentions", label: "Wo wird … erwähnt", needsSubject: true },
];

export function AskPanel({
  question,
  onQuestionChange,
  result,
  preview,
  busy,
  hasIndex,
  onAsk,
  onPreview,
  onQuickAsk,
}: Props) {
  function handleQuick(kind: ProjectQuestionKind, needsSubject: boolean) {
    if (!needsSubject) {
      onQuickAsk(kind, "");
      return;
    }
    // Betreff aus dem Eingabefeld nehmen, wenn er dort steht — sonst nachfragen.
    const subject = question.trim() || window.prompt("Name der Figur, des Orts oder des Begriffs?") || "";
    if (subject) onQuickAsk(kind, subject);
  }

  return (
    <div className="kw-section">
      <div className="kw-h">Frage an das Projekt</div>

      <div className="kw-quick">
        {QUICK.map((q) => (
          <button
            key={q.kind}
            className="kw-chip"
            onClick={() => handleQuick(q.kind, q.needsSubject)}
            disabled={busy || !hasIndex}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="kw-searchbar">
        <input
          className="kw-input"
          type="text"
          value={question}
          placeholder="Was weiß das Projekt über…?"
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy && question.trim()) onAsk();
          }}
          disabled={!hasIndex}
        />
        <button
          className="kw-btn primary"
          onClick={onAsk}
          disabled={busy || !question.trim() || !hasIndex}
        >
          {busy ? "…" : "Fragen"}
        </button>
      </div>

      <div className="kw-btnrow">
        <button
          className="kw-btn tiny"
          onClick={onPreview}
          disabled={busy || !question.trim() || !hasIndex}
          title="Zeigt die Textstellen, die an das Modell gehen würden"
        >
          Kontext ansehen
        </button>
      </div>

      {preview && <div className="kw-preview">{preview}</div>}

      {result && (
        <>
          {result.notice && (
            <div className={`kw-notice ${result.llmUnavailable ? "warn" : ""}`}>
              {result.notice}
            </div>
          )}

          <div className="kw-answer">
            {result.answer}

            {result.sources.length > 0 && (
              <div className="kw-answer-src">
                <strong style={{ fontWeight: 400 }}>Quellen</strong>
                <br />
                {result.sources.map((s, i) => (
                  <div key={i}>
                    [{i + 1}] {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
