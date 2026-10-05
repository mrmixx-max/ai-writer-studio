// SubtextConflictInjectorModal (WP 60.2)
//
// Reichert platte Dialoge mit verdeckter Agenda, doppeldeutigen Aussagen und
// verräterischer Körpersprache an.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  injectSubtext,
  generateMicroReaction,
  analyzeSubtextDensity,
  AGENDA_LABELS,
  type HiddenAgenda,
} from "@/services/ai/subtextConflictInjector";

export interface SubtextConflictInjectorModalProps {
  /** Vorbefüllter Dialog (eine Zeile je Beitrag, "Sprecher: Text"). */
  initialDialogue?: string;
  className?: string;
}

const SAMPLE_DIALOGUE = [
  "Mira: Ich war die ganze Nacht hier.",
  "Kessler: Das habe ich gehört.",
  "Mira: Du glaubst mir nicht.",
  "Kessler: Ich glaube, was ich sehe.",
].join("\n");

const AGENDAS: { value: HiddenAgenda; label: string }[] = [
  { value: "knows-lie", label: "Weiß von der Lüge" },
  { value: "secret-love", label: "Heimliche Liebe" },
  { value: "jealousy", label: "Eifersucht" },
  { value: "guilt", label: "Geheime Schuld" },
  { value: "distrust", label: "Misstrauen" },
];

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

export function SubtextConflictInjectorModal({
  initialDialogue = SAMPLE_DIALOGUE,
  className,
}: SubtextConflictInjectorModalProps) {
  const [dialogueText, setDialogueText] = useState(initialDialogue);
  const [agenda, setAgenda] = useState<HiddenAgenda>("knows-lie");
  const [carrier, setCarrier] = useState("Mira");

  const dialogue = useMemo(
    () =>
      dialogueText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const idx = line.indexOf(":");
          if (idx === -1) return { speaker: "A", text: line };
          return { speaker: line.slice(0, idx).trim(), text: line.slice(idx + 1).trim() };
        })
        .filter((l) => l.speaker.length > 0 && l.text.length > 0),
    [dialogueText],
  );

  const result = useMemo(
    () => injectSubtext(dialogue, { agenda, carrier }),
    [dialogue, agenda, carrier],
  );
  const density = useMemo(() => analyzeSubtextDensity(result.text), [result.text]);
  const reaction = useMemo(() => generateMicroReaction(agenda, carrier), [agenda, carrier]);

  return (
    <div
      className={className}
      data-testid="subtext-conflict-injector-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Subtext- & Konflikt-Injektor
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {result.injectedCount} Beiträge angereichert · Subtext-Dichte{" "}
        {Math.round(density.density * 100)}%
      </div>

      {/* Agenda */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          VERDECKTE AGENDA
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AGENDAS.map((a) => (
            <button
              key={a.value}
              data-testid={`subtext-agenda-${a.value}`}
              onClick={() => setAgenda(a.value)}
              aria-pressed={agenda === a.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: agenda === a.value ? "var(--accent)" : "var(--panel)",
                color: agenda === a.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trägerfigur */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Trägerfigur des Geheimnisses
        <input
          data-testid="subtext-carrier-input"
          type="text"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Dialog */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Dialog (Sprecher: Text)
        <textarea
          data-testid="subtext-dialogue-input"
          value={dialogueText}
          onChange={(e) => setDialogueText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)" }}
        />
      </label>

      {/* Mikro-Reaktion */}
      <div
        data-testid="subtext-reaction"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          VERRÄTERISCHE KÖRPERSPRACHE
        </div>
        <div style={{ color: "var(--warn)", fontStyle: "italic" }}>{reaction}</div>
      </div>

      {/* Angereicherter Dialog */}
      <div data-testid="subtext-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          ANGEREICHERTER DIALOG ({AGENDA_LABELS[agenda].toUpperCase()})
        </div>
        <div
          data-testid="subtext-output-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {result.text || "—"}
        </div>
      </div>

      {/* Beiträge einzeln */}
      <div data-testid="subtext-lines" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          BEITRÄGE IM DETAIL
        </div>
        {result.lines.map((l, i) => (
          <div
            key={i}
            data-testid={`subtext-line-${i}`}
            style={{
              fontSize: 11,
              paddingLeft: 8,
              borderLeft: `2px solid ${l.hasSubtext ? "var(--warn)" : "var(--border)"}`,
              marginBottom: 4,
            }}
          >
            <strong style={{ color: "var(--accent)" }}>{l.speaker}:</strong> {l.text}
            {l.hasSubtext && (
              <span
                data-testid={`subtext-flag-${i}`}
                style={{ color: "var(--warn)", fontSize: 10, marginLeft: 4 }}
              >
                [Subtext]
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Dichte */}
      <div
        data-testid="subtext-density"
        style={{
          border: `1px solid ${density.sufficient ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          fontSize: 11,
        }}
      >
        <div>
          Subtext-Dichte:{" "}
          <strong data-testid="subtext-density-value">{Math.round(density.density * 100)}%</strong>{" "}
          ({density.lineCount} Beiträge)
        </div>
        <div
          data-testid="subtext-density-verdict"
          style={{
            marginTop: 4,
            color: density.sufficient ? "var(--success)" : "var(--warn)",
            fontWeight: 700,
          }}
        >
          {density.sufficient
            ? "✓ Ausreichend Subtext — der Dialog trägt Doppelbedeutung"
            : "⚠ Zu wenig Subtext — der Dialog wirkt platt"}
        </div>
        {density.markers.length > 0 && (
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Marker: {density.markers.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
