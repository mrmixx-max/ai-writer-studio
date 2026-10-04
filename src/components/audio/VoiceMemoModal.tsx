// VoiceMemoModal (WP 43.1): Audio-Walkman & Diktat-Smart-Tagger.
//
// Nimmt Sprachmemos auf (oder nimmt eingefügten Transkript-Text entgegen),
// analysiert den Inhalt lokal und schlägt Ziele vor: Kapitel-Randnotiz,
// Figurenprofil oder Recherche-Codex.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createVoiceMemo,
  analyzeMemoContent,
  formatMemoForChapter,
  formatMemoForCharacter,
  formatMemoForCodex,
  type VoiceMemo,
  type MemoContext,
  type MemoTarget,
} from "@/services/audio/voiceMemoCompanion";

export interface VoiceMemoModalProps {
  open: boolean;
  onClose: () => void;
  context: MemoContext;
  /** Wird beim Übernehmen eines Vorschlags gerufen. */
  onApply?: (target: MemoTarget, formatted: string) => void;
}

const KIND_LABEL: Record<MemoTarget["kind"], string> = {
  chapter: "Kapitel-Randnotiz",
  character: "Figurenprofil",
  codex: "Recherche-Codex",
};

export function VoiceMemoModal({ open, onClose, context, onApply }: VoiceMemoModalProps) {
  const [transcript, setTranscript] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [recording, setRecording] = useState(false);
  const [memo, setMemo] = useState<VoiceMemo | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const targets = useMemo(() => {
    if (!memo) return [];
    return analyzeMemoContent(memo, context);
  }, [memo, context]);

  const handleRecord = useCallback(() => {
    setRecording(true);
    // Aufnahme-Simulation: In der Desktop-App übernimmt MediaRecorder;
    // hier wird nur der Zustand geführt.
    window.setTimeout(() => setRecording(false), 400);
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!transcript.trim()) return;
    const m = createVoiceMemo(transcript, durationSec);
    setMemo(m);
    setApplied(null);
  }, [transcript, durationSec]);

  const handleApply = useCallback(
    (target: MemoTarget) => {
      if (!memo) return;
      let formatted = "";
      if (target.kind === "chapter") formatted = formatMemoForChapter(memo);
      else if (target.kind === "character") formatted = formatMemoForCharacter(memo, target.targetLabel);
      else formatted = formatMemoForCodex(memo);
      onApply?.(target, formatted);
      setApplied(target.targetLabel);
    },
    [memo, onApply],
  );

  if (!open) return null;

  return (
    <div
      data-testid="voice-memo-modal"
      className="modal-backdrop"
      onClick={onClose}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 18,
          width: "min(600px, 92vw)",
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--accent)" }}>🎙️ Sprachmemo</h3>
          <button
            data-testid="voice-memo-close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--muted)",
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Schließen
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button
            data-testid="voice-memo-record"
            onClick={handleRecord}
            style={{
              background: recording ? "var(--error)" : "transparent",
              color: recording ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {recording ? "● Aufnahme läuft" : "⏺ Aufnehmen"}
          </button>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Dauer:
            <input
              data-testid="voice-memo-duration"
              type="number"
              min={1}
              max={3600}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value) || 30)}
              style={{
                width: 64,
                marginLeft: 6,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "3px 5px",
                fontSize: 11,
              }}
            />
            s
          </label>
        </div>

        <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          TRANSKRIPT (offline diktiert oder eingefügt)
        </label>
        <textarea
          data-testid="voice-memo-transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Figur Sarah sollte ein Geheimnis vor David haben …"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 110,
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        <button
          data-testid="voice-memo-analyze"
          onClick={handleAnalyze}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            margin: "10px 0",
          }}
        >
          Vorschläge analysieren
        </button>

        {memo && (
          <div data-testid="voice-memo-targets">
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
              VORSCHLÄGE ({targets.length})
            </div>
            {targets.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Keine passenden Ziele gefunden.
              </div>
            )}
            {targets.map((t, i) => (
              <div
                key={`${t.kind}-${t.targetId}-${i}`}
                data-testid={`voice-memo-target-${i}`}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "var(--fg)" }}>
                    {KIND_LABEL[t.kind]}: <strong>{t.targetLabel}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {t.reason} · Konfidenz {(t.confidence * 100).toFixed(0)} %
                  </div>
                </div>
                <button
                  data-testid={`voice-memo-apply-${i}`}
                  onClick={() => handleApply(t)}
                  style={{
                    background: "transparent",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: 4,
                    padding: "4px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Übernehmen
                </button>
              </div>
            ))}
            {applied && (
              <div
                data-testid="voice-memo-applied"
                style={{ fontSize: 11, color: "var(--success)", marginTop: 6 }}
              >
                ✓ Angewendet auf „{applied}“
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
