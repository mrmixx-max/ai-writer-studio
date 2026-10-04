// LiveAudienceTelemetry (WP 48.1): Live-Bühnen-Dashboard & Publikums-Q&A.
//
// Akustik-Pegelwächter, Regie-Impulse und Live-Q&A-Kanal mit QR-Code.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createTelemetrySession,
  measureAudioLevel,
  generateDirectorCue,
  submitQuestion,
  getTopQuestions,
  generateQRLink,
  type TelemetryConfig,
} from "@/services/stage/liveAudienceTelemetry";

export interface LiveAudienceTelemetryProps {
  className?: string;
  authorName?: string;
  eventName?: string;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  authorName: "Erik Gieske",
  eventName: "Live-Lesung Buchmesse",
  maxQuestions: 50,
};

export function LiveAudienceTelemetry({
  className,
  authorName = DEFAULT_CONFIG.authorName,
  eventName = DEFAULT_CONFIG.eventName,
}: LiveAudienceTelemetryProps) {
  const [config] = useState({ ...DEFAULT_CONFIG, authorName, eventName });
  const [session, setSession] = useState(() => createTelemetrySession(config));
  const [decibels, setDecibels] = useState(55);
  const [question, setQuestion] = useState("");
  const [questionAuthor, setQuestionAuthor] = useState("");
  const [cue, setCue] = useState<ReturnType<typeof generateDirectorCue>>(null);
  const [qrLink, setQrLink] = useState("");

  const audioResult = useMemo(() => measureAudioLevel(session, decibels), [session, decibels]);
  const topQuestions = useMemo(() => getTopQuestions(session, 10), [session]);

  const handleMeasure = useCallback(() => {
    const result = measureAudioLevel(session, decibels);
    const newCue = generateDirectorCue(session);
    setCue(newCue);
    return result;
  }, [session, decibels]);

  const handleSubmitQuestion = useCallback(() => {
    if (!question.trim()) return;
    const q = submitQuestion(session, question.trim(), questionAuthor.trim() || "Anonym");
    setSession({ ...session, questions: [...session.questions, q] });
    setQuestion("");
    setQuestionAuthor("");
  }, [session, question, questionAuthor]);

  const handleGenerateQR = useCallback(() => {
    setQrLink(generateQRLink(session, "http://192.168.1.100:3000"));
  }, [session]);

  return (
    <div
      className={className}
      data-testid="live-audience-telemetry"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎤 Live-Bühnen-Dashboard
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {session.authorName} · {session.eventName} · {session.questions.length} Fragen
      </div>

      {/* Akustik-Pegelwächter */}
      <div data-testid="telemetry-audio" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>AKUSTIK-PEGEWÄCHTER</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            data-testid="telemetry-decibels"
            type="range"
            min={20}
            max={100}
            value={decibels}
            onChange={(e) => setDecibels(Number(e.target.value))}
            style={{ flex: 1, maxWidth: 300 }}
          />
          <span
            data-testid="telemetry-db-value"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color:
                audioResult.status === "optimal"
                  ? "var(--success)"
                  : audioResult.status === "too-quiet"
                    ? "var(--warn)"
                    : "var(--error)",
            }}
          >
            {decibels} dB
          </span>
        </div>
        <div
          data-testid="telemetry-audio-status"
          style={{
            fontSize: 11,
            color:
              audioResult.status === "optimal"
                ? "var(--success)"
                : audioResult.status === "too-quiet"
                  ? "var(--warn)"
                  : "var(--error)",
          }}
        >
          {audioResult.message}
        </div>
        <button
          data-testid="telemetry-measure"
          onClick={handleMeasure}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Messen
        </button>
      </div>

      {/* Regie-Impuls */}
      {cue && (
        <div
          data-testid="telemetry-cue"
          style={{
            border: "1px solid var(--warn)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 12,
          }}
        >
          <strong style={{ color: "var(--warn)" }}>[{cue.message}]</strong>
          <span style={{ color: "var(--muted)", marginLeft: 8 }}>
            Priorität: {cue.priority}
          </span>
        </div>
      )}

      {/* Q&A-Kanal */}
      <div data-testid="telemetry-qa" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>LIVE-Q&A</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            data-testid="telemetry-question-author"
            placeholder="Name (optional)"
            value={questionAuthor}
            onChange={(e) => setQuestionAuthor(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <input
            data-testid="telemetry-question-input"
            placeholder="Ihre Frage..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{
              flex: 2,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <button
            data-testid="telemetry-question-submit"
            onClick={handleSubmitQuestion}
            disabled={!question.trim()}
            style={{
              background: question.trim() ? "var(--accent)" : "transparent",
              color: question.trim() ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: question.trim() ? "pointer" : "not-allowed",
            }}
          >
            Senden
          </button>
        </div>

        {/* Top-Fragen */}
        {topQuestions.length > 0 && (
          <div data-testid="telemetry-top-questions">
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TOP-FRAGEN</div>
            {topQuestions.map((q) => (
              <div
                key={q.id}
                data-testid={`telemetry-question-${q.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                }}
              >
                <span>{q.text}</span>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>▲ {q.upvotes}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR-Code */}
      <div data-testid="telemetry-qr" style={{ marginBottom: 12 }}>
        <button
          data-testid="telemetry-qr-generate"
          onClick={handleGenerateQR}
          style={{
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "5px 12px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          QR-Code für Zuschauer generieren
        </button>
        {qrLink && (
          <div
            data-testid="telemetry-qr-link"
            style={{
              marginTop: 6,
              fontSize: 10,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {qrLink}
          </div>
        )}
      </div>
    </div>
  );
}
