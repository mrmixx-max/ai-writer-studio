// BilingualPanel: DE↔EN-Übersetzungs-Panel für den BookWriter (Sprint 15, Agent 2).
//
// Standalone-Panel — bewusst KEINE Abhängigkeit zu BookWriterPanel,
// BookWriterDashboard oder ContinuityPanel (weder Import noch Änderung dort).
// Es übersetzt ein einzelnes Kapitel über
// `@/services/bookwriter/translatorService` (`translateChapter`, Markup bleibt
// erhalten) und zeigt Original + Übersetzung nebeneinander.
//
// Der LLM-Call läuft über die injizierbare `chat`-Funktion (LLMChatFn-Mock in
// Tests, Provider-Adapter in Produktion) — ohne `chat` arbeitet das Panel
// offline (Translate-Button deaktiviert mit Hinweis).

import { useState } from "react";
import {
  translateChapter,
  type LLMChatFn,
  type TranslationChapter,
  type TranslationResult,
} from "@/services/bookwriter/translatorService";
import "./bookwriter.css";

export type BilingualTarget = "Deutsch" | "Englisch";

export interface BilingualPanelProps {
  /** Zu übersetzendes Kapitel (gelesen, nicht verändert). */
  chapter: TranslationChapter;
  /** Quellsprache für den Prompt (Default: "Deutsch"). */
  sourceLanguage?: string;
  /** Start-Zielsprache (Default: "Englisch"). */
  initialTarget?: BilingualTarget;
  /** Injizierbare Chat-Funktion (Mock in Tests, Provider-Adapter in Produktion). */
  chat?: LLMChatFn;
  /** Wird beim Klick auf "Übernehmen" mit dem Übersetzungsergebnis aufgerufen. */
  onApply?: (result: TranslationResult) => void;
  className?: string;
}

const TARGET_OPTIONS: BilingualTarget[] = ["Deutsch", "Englisch"];

export function BilingualPanel({
  chapter,
  sourceLanguage = "Deutsch",
  initialTarget = "Englisch",
  chat,
  onApply,
  className,
}: BilingualPanelProps) {
  const [target, setTarget] = useState<BilingualTarget>(initialTarget);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!chat || translating) return;
    setTranslating(true);
    setError(null);
    try {
      const res = await translateChapter(
        chapter,
        chat,
        { targetLanguage: target, sourceLanguage },
      );
      setResult(res);
    } catch (e) {
      setError(`Übersetzung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleApply = () => {
    if (!result || !onApply) return;
    onApply(result);
  };

  return (
    <div
      className={className ?? "bilingual-panel"}
      data-testid="bilingual-panel"
    >
      <h3>🌐 Bilingual (DE↔EN)</h3>
      <p className="ws-muted">
        Kapitel „{chapter.title}“ — {sourceLanguage} → {target}
      </p>

      <label htmlFor="bilingual-lang-select">Zielsprache</label>
      <select
        id="bilingual-lang-select"
        data-testid="bilingual-lang-select"
        value={target}
        onChange={(e) => {
          setTarget(e.target.value as BilingualTarget);
          setResult(null);
        }}
      >
        {TARGET_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>
            {lang === "Deutsch" ? "Deutsch (DE)" : "Englisch (EN)"}
          </option>
        ))}
      </select>

      <button
        className="ws-btn"
        data-testid="bilingual-translate-btn"
        onClick={handleTranslate}
        disabled={!chat || translating}
      >
        {translating ? "Übersetzt …" : "Translate Chapter"}
      </button>
      {!chat && (
        <p className="ws-muted" data-testid="bilingual-offline-note">
          Kein Übersetzungs-Service verbunden — `chat` injizieren.
        </p>
      )}
      {error && (
        <p className="ws-muted" data-testid="bilingual-error">
          {error}
        </p>
      )}

      <div data-testid="bilingual-preview" className="bilingual-preview">
        <div data-testid="bilingual-original">
          <h4>Original</h4>
          <p><strong>{chapter.title}</strong></p>
          <pre className="ws-pre">{chapter.content}</pre>
        </div>
        <div data-testid="bilingual-translated">
          <h4>Übersetzung ({target})</h4>
          {result ? (
            <>
              <p><strong>{result.translatedTitle}</strong></p>
              <pre className="ws-pre">{result.content}</pre>
              {!result.markupIntact && (
                <p className="ws-muted">Hinweis: Markup weicht vom Original ab.</p>
              )}
            </>
          ) : (
            <p className="ws-muted">Noch keine Übersetzung — „Translate Chapter“ klicken.</p>
          )}
        </div>
      </div>

      <button
        className="ws-btn"
        data-testid="bilingual-apply-btn"
        onClick={handleApply}
        disabled={!result || !onApply}
      >
        Apply
      </button>
    </div>
  );
}
