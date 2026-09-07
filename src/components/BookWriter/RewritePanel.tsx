// RewritePanel: Rewrite-Vorschläge mit Vorher/Nachher-Vergleich (Sprint 17, Agent 5).
//
// Standalone-Panel — bewusst KEINE Abhängigkeit zu QualityDashboard,
// LektoratPanel, BookWriterPanel oder ContinuityPanel (weder Import noch
// Änderung dort). Rein präsentational: Befunde kommen über Props, die
// Umformulierung läuft über injizierbares `rewrite` (Mock in Tests) —
// ohne `rewrite` zeigt das Panel die mitgelieferten Vorschläge offline.
// Akzeptieren/Ablehnen verwaltet das Panel in lokalem State und meldet
// zusätzlich über `onAccept`/`onReject` nach außen.

import { useMemo, useState } from "react";
import "./bookwriter.css";

export type RewriteTone = "neutral" | "sachlich" | "lebendig" | "formal";
export type RewriteLength = "kürzer" | "gleich" | "ausführlicher";

export interface RewriteFinding {
  /** Stabile ID, z.B. "f1". */
  id: string;
  chapterId: string;
  /** Kurzbeschreibung des Befunds, z.B. "Füllwörter". */
  message: string;
  /** Originaltext (vorher). */
  before: string;
  /** Optionaler Startvorschlag (nachher) — offline ohne `rewrite` nutzbar. */
  suggestion?: string;
}

export interface RewriteOptions {
  tone: RewriteTone;
  length: RewriteLength;
}

export type RewriteFn = (
  finding: RewriteFinding,
  options: RewriteOptions,
) => Promise<string>;

export interface RewritePanelProps {
  findings: RewriteFinding[];
  /** Injizierbare Rewrite-Funktion (optional, offline ohne). */
  rewrite?: RewriteFn;
  initialTone?: RewriteTone;
  initialLength?: RewriteLength;
  onAccept?: (id: string, text: string) => void;
  onReject?: (id: string) => void;
  className?: string;
}

export const REWRITE_TONES: RewriteTone[] = [
  "neutral",
  "sachlich",
  "lebendig",
  "formal",
];

export const REWRITE_LENGTHS: RewriteLength[] = [
  "kürzer",
  "gleich",
  "ausführlicher",
];

export function RewritePanel({
  findings,
  rewrite,
  initialTone = "neutral",
  initialLength = "gleich",
  onAccept,
  onReject,
  className,
}: RewritePanelProps) {
  const [tone, setTone] = useState<RewriteTone>(initialTone);
  const [length, setLength] = useState<RewriteLength>(initialLength);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      findings.filter((f) => f.suggestion).map((f) => [f.id, f.suggestion as string]),
    ),
  );
  const [rewriting, setRewriting] = useState<string | null>(null);

  const open = useMemo(
    () =>
      findings.filter(
        (f) => !accepted.includes(f.id) && !rejected.includes(f.id),
      ),
    [findings, accepted, rejected],
  );
  const resolved = findings.length - open.length;

  const handleRewrite = async (finding: RewriteFinding) => {
    if (!rewrite || rewriting) return;
    setRewriting(finding.id);
    try {
      const out = await rewrite(finding, { tone, length });
      setPreviews((prev) => ({ ...prev, [finding.id]: out }));
    } finally {
      setRewriting(null);
    }
  };

  const handleAccept = (finding: RewriteFinding) => {
    setAccepted((prev) => (prev.includes(finding.id) ? prev : [...prev, finding.id]));
    onAccept?.(finding.id, previews[finding.id] ?? finding.before);
  };

  const handleReject = (finding: RewriteFinding) => {
    setRejected((prev) => (prev.includes(finding.id) ? prev : [...prev, finding.id]));
    onReject?.(finding.id);
  };

  return (
    <div className={className ?? "rewrite-panel"} data-testid="rewrite-panel">
      <h3>Rewrite</h3>

      {findings.length === 0 ? (
        <p className="ws-muted" data-testid="rewrite-empty">
          Keine Befunde — nichts umzuformulieren.
        </p>
      ) : (
        <>
          <p className="ws-muted" data-testid="rewrite-progress">
            {resolved} von {findings.length} erledigt
          </p>
          <div
            data-testid="rewrite-progress-bar"
            data-resolved={resolved}
            data-total={findings.length}
            style={{
              width: `${findings.length > 0 ? Math.round((resolved / findings.length) * 100) : 0}%`,
              height: 8,
              background: "#2e7d32",
            }}
          />

          <label>
            Ton
            <select
              data-testid="rewrite-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as RewriteTone)}
            >
              {REWRITE_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Länge
            <select
              data-testid="rewrite-length"
              value={length}
              onChange={(e) => setLength(e.target.value as RewriteLength)}
            >
              {REWRITE_LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          {open.length === 0 ? (
            <p className="ws-muted" data-testid="rewrite-done">
              Alle Befunde bearbeitet.
            </p>
          ) : (
            <ul data-testid="rewrite-findings">
              {open.map((f) => (
                <li key={f.id} data-testid="rewrite-finding" data-finding={f.id}>
                  <strong>{f.message}</strong>{" "}
                  <span className="ws-muted">({f.chapterId})</span>
                  <div data-testid="rewrite-before">{f.before}</div>
                  {previews[f.id] ? (
                    <div data-testid="rewrite-after">{previews[f.id]}</div>
                  ) : (
                    <p className="ws-muted" data-testid="rewrite-no-preview">
                      Noch keine Umformulierung — Option wählen und neu
                      formulieren.
                    </p>
                  )}
                  {rewrite && (
                    <button
                      className="ws-btn"
                      data-testid="rewrite-regenerate"
                      disabled={rewriting === f.id}
                      onClick={() => void handleRewrite(f)}
                    >
                      {rewriting === f.id ? "Formuliert um …" : "Neu formulieren"}
                    </button>
                  )}
                  <button
                    className="ws-btn"
                    data-testid="rewrite-accept"
                    onClick={() => handleAccept(f)}
                  >
                    Übernehmen
                  </button>
                  <button
                    className="ws-btn"
                    data-testid="rewrite-reject"
                    onClick={() => handleReject(f)}
                  >
                    Verwerfen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
