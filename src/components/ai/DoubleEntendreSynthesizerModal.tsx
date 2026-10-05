// DoubleEntendreSynthesizerModal (WP 64.1)
//
// Interaktive Dechiffrier-Ansicht: Beim Überfahren der Dialogzeilen
// blendet sich die entschlüsselte wahre Absicht ein.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  synthesizeDoubleEntendre,
  decipherLine,
  analyzeLayering,
  formatSurfaceOnly,
  formatDeciphered,
  TOPIC_LABELS,
  INTENT_LABELS,
  type SurfaceTopic,
  type HiddenIntent,
} from "@/services/ai/doubleEntendreSynthesizer";

export interface DoubleEntendreSynthesizerModalProps {
  className?: string;
}

const TOPICS: SurfaceTopic[] = ["garden", "wine", "chess", "weather", "music"];
const INTENTS: HiddenIntent[] = ["accusation", "threat", "blackmail", "warning", "alliance-offer"];

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function DoubleEntendreSynthesizerModal({ className }: DoubleEntendreSynthesizerModalProps) {
  const [topic, setTopic] = useState<SurfaceTopic>("garden");
  const [intent, setIntent] = useState<HiddenIntent>("accusation");
  const [speaker, setSpeaker] = useState("Die Gräfin");
  const [listener, setListener] = useState("der Botschafter");
  const [secret, setSecret] = useState("Ich weiß, dass du den Kronprinzen vergiftet hast");
  const [turns, setTurns] = useState(6);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const dialogue = useMemo(
    () => synthesizeDoubleEntendre({ topic, intent, speaker, listener, secret, turns }),
    [topic, intent, speaker, listener, secret, turns],
  );

  const analysis = useMemo(() => analyzeLayering(dialogue), [dialogue]);

  return (
    <div
      className={className}
      data-testid="double-entendre-synthesizer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Doppelbödigkeits- & Intrigen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {dialogue.lineCount} Redebeiträge · {dialogue.topicLabel} · {dialogue.intentLabel}
      </div>

      {/* Steuerung */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Oberfläche
          <select
            data-testid="entendre-topic-select"
            value={topic}
            onChange={(e) => setTopic(e.target.value as SurfaceTopic)}
            style={inputStyle}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Absicht
          <select
            data-testid="entendre-intent-select"
            value={intent}
            onChange={(e) => setIntent(e.target.value as HiddenIntent)}
            style={inputStyle}
          >
            {INTENTS.map((i) => (
              <option key={i} value={i}>
                {INTENT_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Sprecher
          <input
            data-testid="entendre-speaker-input"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Gesprächspartner
          <input
            data-testid="entendre-listener-input"
            value={listener}
            onChange={(e) => setListener(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Geheimer Subtext
        <input
          data-testid="entendre-secret-input"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 14 }}>
        Redebeiträge: {turns}
        <input
          data-testid="entendre-turns-input"
          type="range"
          min={2}
          max={10}
          value={turns}
          onChange={(e) => setTurns(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      {/* Dialog mit Dechiffrierung */}
      <div data-testid="entendre-dialogue" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DIALOG — Fahre über eine Zeile, um die wahre Absicht zu entschlüsseln
        </div>
        {dialogue.lines.map((line) => {
          const deciphered = decipherLine(line.surface);
          const isHovered = hoveredLine === line.index;
          return (
            <div
              key={line.index}
              data-testid={`entendre-line-${line.index}`}
              onMouseEnter={() => setHoveredLine(line.index)}
              onMouseLeave={() => setHoveredLine(null)}
              style={{
                border: `1px solid ${isHovered ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                {line.speaker.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>„{line.surface}."</div>
              {line.stageDirection && (
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>
                  ({line.stageDirection})
                </div>
              )}
              {isHovered && (
                <div
                  data-testid={`entendre-deciphered-${line.index}`}
                  style={{
                    marginTop: 6,
                    padding: 6,
                    background: "var(--panel)",
                    borderRadius: 3,
                    fontSize: 11,
                    borderLeft: "3px solid var(--error)",
                  }}
                >
                  <strong style={{ color: "var(--error)" }}>▸ Gemeint:</strong> {line.subtext}
                  {deciphered.intent && (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      Erkannt: {INTENT_LABELS[deciphered.intent]}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analyse */}
      <div
        data-testid="entendre-analysis"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          DOPPELBÖDIGKEITS-ANALYSE
        </div>
        <div>
          Doppelbödigkeit:{" "}
          <strong data-testid="entendre-layering-rate">
            {Math.round(analysis.layeringRate * 100)}%
          </strong>{" "}
          · Ø Oberflächenlänge:{" "}
          <strong data-testid="entendre-avg-length">{analysis.averageSurfaceLength}</strong> Wörter
        </div>
        <div
          data-testid="entendre-sufficiently-layered"
          style={{
            marginTop: 4,
            color: analysis.sufficientlyLayered ? "var(--success)" : "var(--warn)",
            fontWeight: 700,
          }}
        >
          {analysis.sufficientlyLayered
            ? "✓ Ausreichend doppelbödig"
            : "⚠ Zu wenig Doppelbödigkeit"}
        </div>
      </div>

      {/* Vollständige Texte */}
      <details data-testid="entendre-full-text">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Dialog (Oberfläche)
        </summary>
        <pre
          data-testid="entendre-surface-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {formatSurfaceOnly(dialogue)}
        </pre>
      </details>

      <details data-testid="entendre-deciphered-text" style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Dialog (entschlüsselt)
        </summary>
        <pre
          data-testid="entendre-deciphered-full"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {formatDeciphered(dialogue)}
        </pre>
      </details>
    </div>
  );
}
