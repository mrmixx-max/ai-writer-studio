// FlashbackMemoryWeaverModal (WP 58.2)
//
// Erzeugt den Drei-Phasen-Flashback (Gleiten → Vergangenheit → Snap-Back),
// findet sensorische Trigger im Text und bewertet die Übergangsqualität.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  weaveFlashback,
  detectFlashbackTriggers,
  analyzeFlashbackFlow,
  SENSE_LABELS,
  type TriggerSense,
} from "@/services/ai/flashbackMemoryWeaver";

export interface FlashbackMemoryWeaverModalProps {
  /** Vorbefüllte Erinnerung. */
  initialMemory?: string;
  className?: string;
}

const SENSES: { value: TriggerSense; label: string }[] = [
  { value: "auditory", label: "Klang" },
  { value: "smell", label: "Geruch" },
  { value: "taste", label: "Geschmack" },
  { value: "touch", label: "Berührung" },
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

const SAMPLE_PRESENT =
  "Die Glocke läutete zweimal, und der Tee schmeckte bitter. Dann kam der Schuss.";

export function FlashbackMemoryWeaverModal({
  initialMemory = "",
  className,
}: FlashbackMemoryWeaverModalProps) {
  const [sense, setSense] = useState<TriggerSense>("auditory");
  const [character, setCharacter] = useState("Mira");
  const [trigger, setTrigger] = useState("eine Kirchenglocke, die zweimal schlug");
  const [memory, setMemory] = useState(initialMemory);
  const [danger, setDanger] = useState("Der Angreifer stand in der Tür");
  const [presentText, setPresentText] = useState(SAMPLE_PRESENT);

  const flashback = useMemo(
    () => weaveFlashback({ sense, character, trigger, memory, presentDanger: danger }),
    [sense, character, trigger, memory, danger],
  );
  const flow = useMemo(() => analyzeFlashbackFlow(flashback.text), [flashback.text]);
  const scan = useMemo(() => detectFlashbackTriggers(presentText), [presentText]);

  return (
    <div
      className={className}
      data-testid="flashback-memory-weaver-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⏳ Flashback-Weaver
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Über einen Sinnesreiz in die Erinnerung gleiten — und abrupt zurück.
      </div>

      {/* Sinneskanal */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SINNESKANAL</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SENSES.map((s) => (
            <button
              key={s.value}
              data-testid={`flashback-sense-${s.value}`}
              onClick={() => setSense(s.value)}
              aria-pressed={sense === s.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: sense === s.value ? "var(--accent)" : "var(--panel)",
                color: sense === s.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Eingaben */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Figur
          <input
            data-testid="flashback-character-input"
            type="text"
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 200 }}>
          Sinnesreiz (Trigger)
          <input
            data-testid="flashback-trigger-input"
            type="text"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Akute Gefahr (Gegenwart)
        <input
          data-testid="flashback-danger-input"
          type="text"
          value={danger}
          onChange={(e) => setDanger(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Erinnerungsinhalt (optional)
        <textarea
          data-testid="flashback-memory-input"
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Drei Phasen */}
      <div data-testid="flashback-phases" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DREI-PHASEN-ÜBERGANG
        </div>
        {flashback.segments.map((seg) => (
          <div
            key={seg.phase}
            data-testid={`flashback-phase-${seg.phase}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 10,
              marginBottom: 6,
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 4 }}>
              {seg.label.toUpperCase()}
            </div>
            {seg.text}
          </div>
        ))}
      </div>

      {/* Übergangsqualität */}
      <div
        data-testid="flashback-flow"
        style={{
          border: `1px solid ${flow.quality > 0.5 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          ÜBERGANGSQUALITÄT
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>
            Gleiten: <strong data-testid="flashback-slip-quality">{Math.round(flow.slipQuality * 100)}%</strong>
          </span>
          <span>
            Snap-Back: <strong data-testid="flashback-snap-quality">{Math.round(flow.snapQuality * 100)}%</strong>
          </span>
          <span>
            Gesamt: <strong data-testid="flashback-quality">{Math.round(flow.quality * 100)}%</strong>
          </span>
        </div>
      </div>

      {/* Trigger-Erkennung */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          TRIGGER-ERKENNUNG IM TEXT
        </div>
        <textarea
          data-testid="flashback-scan-input"
          value={presentText}
          onChange={(e) => setPresentText(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div
          data-testid="flashback-scan"
          style={{ marginTop: 8, fontSize: 11 }}
        >
          <div>
            Gefundene Reize:{" "}
            <strong data-testid="flashback-scan-total">{scan.total}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {(["auditory", "smell", "taste", "touch"] as TriggerSense[]).map((s) => (
              <span
                key={s}
                data-testid={`flashback-scan-${s}`}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 10,
                  border: `1px solid ${scan.senseCounts[s] > 0 ? "var(--accent)" : "var(--border)"}`,
                  color: scan.senseCounts[s] > 0 ? "var(--accent)" : "var(--muted)",
                }}
              >
                {SENSE_LABELS[s].split(" ")[0]}: {scan.senseCounts[s]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
