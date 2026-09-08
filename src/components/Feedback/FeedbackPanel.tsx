// KI-Review-Panel (Sprint 23, Agent 2): Fokus-Auswahl, Ton-Auswahl,
// Review-Start (mit Timer + Abbrechen), Score + Vorschläge mit Übernehmen.
// Bloomberg-Terminal-Stil (Inline-Styles — kein neues CSS-Asset nötig).
// Der Review-Client ist per Prop injizierbar (Tests/Storybook), Default: reviewText.
import { useRef, useState } from "react";
import {
  reviewText,
  getAvailableFocusAreas,
  applySuggestion,
  applyAllSuggestions,
  type ReviewRequest,
  type ReviewFeedback,
  type ReviewFocus,
  type ReviewTone,
} from "@/services/feedback/feedback";

const TONES: { id: ReviewTone; label: string }[] = [
  { id: "professional", label: "Professionell" },
  { id: "casual", label: "Locker" },
  { id: "academic", label: "Akademisch" },
  { id: "creative", label: "Kreativ" },
];

const FOCUS_LABELS_DE: Record<ReviewFocus, string> = {
  structure: "Struktur",
  clarity: "Klarheit",
  tone: "Ton",
  pacing: "Tempo",
  dialogue: "Dialog",
  description: "Beschreibung",
  grammar: "Grammatik",
  consistency: "Konsistenz",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ff5555",
  medium: "#ffb000",
  low: "#5fff87",
};

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

export interface FeedbackPanelProps {
  initialText?: string;
  review?: (req: ReviewRequest, opts?: { signal?: AbortSignal }) => Promise<ReviewFeedback>;
}

export function FeedbackPanel({ initialText = "", review = reviewText }: FeedbackPanelProps) {
  const [text, setText] = useState(initialText);
  const [focusAreas, setFocusAreas] = useState<ReviewFocus[]>(getAvailableFocusAreas());
  const [tone, setTone] = useState<ReviewTone>("professional");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ReviewFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  function toggleFocus(f: ReviewFocus) {
    setFocusAreas((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function start() {
    if (busy || !text.trim()) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setResult(null);
    setApplied(new Set());
    const t0 = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    try {
      const res = await review({ text, focusAreas, tone }, { signal: ctrl.signal });
      setResult(res);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Review fehlgeschlagen.");
      }
    } finally {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      abortRef.current = null;
      setBusy(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function applyOne(id: string) {
    const s = result?.suggestions.find((x) => x.id === id);
    if (!s) return;
    setText((t) => applySuggestion(t, s));
    setApplied((prev) => new Set(prev).add(id));
  }

  function applyAll() {
    if (!result) return;
    setText((t) => applyAllSuggestions(t, result.suggestions));
    setApplied(new Set(result.suggestions.map((s) => s.id)));
  }

  return (
    <div data-testid="feedback-panel" style={TERM}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>🔍 KI-REVIEW ▸ LLM-gestützte Verbesserungsvorschläge</div>

      <label htmlFor="feedback-text" style={{ display: "block", marginBottom: 4, color: "#5fff87" }}>
        TEXT
      </label>
      <textarea
        id="feedback-text"
        data-testid="feedback-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Text hier einfügen oder aktuellen Text analysieren…"
        style={{ width: "100%", background: "#11161f", color: "#e6e6e6", border: "1px solid #2a3340", borderRadius: 4, padding: 8, fontFamily: "inherit", fontSize: 13 }}
      />

      <fieldset style={{ border: "1px solid #2a3340", borderRadius: 4, marginTop: 8, padding: 8 }}>
        <legend style={{ color: "#5fff87", padding: "0 4px" }}>FOKUS</legend>
        <div data-testid="feedback-focus-group" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {getAvailableFocusAreas().map((f) => (
            <label key={f} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                data-testid={`feedback-focus-${f}`}
                checked={focusAreas.includes(f)}
                onChange={() => toggleFocus(f)}
              />
              {FOCUS_LABELS_DE[f]}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <label htmlFor="feedback-tone" style={{ color: "#5fff87" }}>TON</label>
        <select
          id="feedback-tone"
          data-testid="feedback-tone-select"
          value={tone}
          onChange={(e) => setTone(e.target.value as ReviewTone)}
          style={{ background: "#11161f", color: "#ffb000", border: "1px solid #2a3340", borderRadius: 4, padding: 4 }}
        >
          {TONES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button
          data-testid="feedback-start"
          onClick={start}
          disabled={busy || !text.trim()}
          style={{ background: "#ffb000", color: "#0a0e14", fontWeight: "bold", border: "none", borderRadius: 4, padding: "6px 14px", cursor: busy || !text.trim() ? "not-allowed" : "pointer", opacity: busy || !text.trim() ? 0.5 : 1 }}
        >
          {busy ? `ANALYSIERE… ${elapsed}s` : "▶ REVIEW STARTEN"}
        </button>
        {busy && (
          <button
            data-testid="feedback-cancel"
            onClick={cancel}
            style={{ background: "transparent", color: "#ff5555", border: "1px solid #ff5555", borderRadius: 4, padding: "5px 12px", cursor: "pointer" }}
          >
            ✕ Abbrechen
          </button>
        )}
      </div>

      {error && <div role="alert" style={{ color: "#ff5555", marginTop: 8 }}>⚠ {error}</div>}

      {result && (
        <div data-testid="feedback-result" style={{ marginTop: 12, borderTop: "1px solid #2a3340", paddingTop: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span data-testid="feedback-score" style={{ fontSize: 28, fontWeight: "bold", color: result.overallScore >= 70 ? "#5fff87" : result.overallScore >= 40 ? "#ffb000" : "#ff5555" }}>
              {result.overallScore}/100
            </span>
            <span data-testid="feedback-summary" style={{ color: "#e6e6e6" }}>{result.summary}</span>
          </div>

          {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {result.strengths.length > 0 && (
                <div><div style={{ color: "#5fff87" }}>+ STÄRKEN</div><ul>{result.strengths.map((s, i) => <li key={i} style={{ color: "#e6e6e6" }}>{s}</li>)}</ul></div>
              )}
              {result.weaknesses.length > 0 && (
                <div><div style={{ color: "#ff5555" }}>− SCHWÄCHEN</div><ul>{result.weaknesses.map((s, i) => <li key={i} style={{ color: "#e6e6e6" }}>{s}</li>)}</ul></div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ color: "#5fff87" }}>VORSCHLÄGE ({result.suggestions.length})</div>
            {result.suggestions.length > 0 && (
              <button data-testid="feedback-apply-all" onClick={applyAll} style={{ background: "transparent", color: "#ffb000", border: "1px solid #ffb000", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
                ⤓ Alle übernehmen
              </button>
            )}
          </div>
          {result.suggestions.length === 0 && <div style={{ color: "#e6e6e6" }}>Keine Vorschläge — Text ist in den gewählten Fokus-Bereichen solide.</div>}
          <ul data-testid="feedback-suggestions" style={{ listStyle: "none", padding: 0 }}>
            {result.suggestions.map((s) => (
              <li key={s.id} data-testid={`feedback-suggestion-${s.id}`} style={{ border: "1px solid #2a3340", borderRadius: 4, padding: 8, marginTop: 6, background: "#11161f" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ background: PRIORITY_COLOR[s.priority] ?? "#ffb000", color: "#0a0e14", borderRadius: 3, padding: "0 6px", fontSize: 11, fontWeight: "bold" }}>{s.priority.toUpperCase()}</span>
                  <span style={{ color: "#5fff87", fontSize: 11 }}>{FOCUS_LABELS_DE[s.focus]}{typeof s.line === "number" ? ` · Zeile ${s.line}` : ""}</span>
                </div>
                <div style={{ color: "#ff8888", textDecoration: "line-through" }}>− {s.original}</div>
                <div style={{ color: "#5fff87" }}>+ {s.suggestion}</div>
                {s.reason && <div style={{ color: "#8b98a9", fontSize: 12, marginTop: 2 }}>💡 {s.reason}</div>}
                <button
                  data-testid={`feedback-apply-${s.id}`}
                  onClick={() => applyOne(s.id)}
                  disabled={applied.has(s.id)}
                  style={{ marginTop: 6, background: applied.has(s.id) ? "transparent" : "#ffb000", color: applied.has(s.id) ? "#5fff87" : "#0a0e14", border: applied.has(s.id) ? "1px solid #5fff87" : "none", borderRadius: 4, padding: "4px 10px", cursor: applied.has(s.id) ? "default" : "pointer" }}
                >
                  {applied.has(s.id) ? "✓ Übernommen" : "Übernehmen"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
