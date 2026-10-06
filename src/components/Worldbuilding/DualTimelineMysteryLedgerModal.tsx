// DualTimelineMysteryLedgerModal (WP 72.2)
//
// Interaktive Darstellung der doppelten Zeitachse und des Indizien-Hauptbuchs.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createSampleLedger,
  getEventsByTimeline,
  getEvidenceByTimeline,
  computeChainStrength,
  findStrongestChain,
  findPrimeSuspect,
  hasContradictoryAlibi,
  formatLedgerReport,
  type Timeline,
} from "@/services/worldbuilding/dualTimelineMysteryLedger";

export interface DualTimelineMysteryLedgerModalProps {
  className?: string;
}

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

export function DualTimelineMysteryLedgerModal({ className }: DualTimelineMysteryLedgerModalProps) {
  const [activeTimeline, setActiveTimeline] = useState<Timeline>("past");
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>("");

  const ledger = useMemo(() => createSampleLedger(), []);
  const events = useMemo(() => getEventsByTimeline(ledger, activeTimeline), [ledger, activeTimeline]);
  const evidence = useMemo(() => getEvidenceByTimeline(ledger, activeTimeline), [ledger, activeTimeline]);
  const primeSuspect = useMemo(() => findPrimeSuspect(ledger), [ledger]);
  const strongestChain = useMemo(() => findStrongestChain(ledger), [ledger]);

  const selectedSuspect = selectedSuspectId
    ? ledger.suspects.find((s) => s.id === selectedSuspectId) ?? null
    : null;

  return (
    <div
      className={className}
      data-testid="dual-timeline-mystery-ledger-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔍 Dual-Timeline-Krimi & Indizien-Hauptbuch
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {ledger.events.length} Ereignisse · {ledger.evidence.length} Indizien · {ledger.suspects.length} Verdächtige
      </div>

      {/* Zeitachse-Auswahl */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["past", "present"] as Timeline[]).map((tl) => (
          <button
            key={tl}
            data-testid={`timeline-tab-${tl}`}
            onClick={() => setActiveTimeline(tl)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: activeTimeline === tl ? "var(--accent)" : "var(--panel)",
              color: activeTimeline === tl ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {tl === "past" ? "Vergangenheit" : "Gegenwart"}
          </button>
        ))}
      </div>

      {/* Ereignisse */}
      <div
        data-testid="timeline-events"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          EREIGNISSE ({activeTimeline === "past" ? "Vergangenheit" : "Gegenwart"})
        </div>
        {events.length === 0 ? (
          <div data-testid="timeline-no-events" style={{ color: "var(--muted)" }}>
            Keine Ereignisse auf dieser Zeitachse.
          </div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} data-testid={`timeline-event-${ev.id}`} style={{ marginBottom: 6 }}>
              <div style={{ color: "var(--accent)", fontWeight: 700 }}>
                §{ev.chapter}: {ev.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{ev.description}</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>
                Beteiligt: {ev.involvedCharacters.join(", ")}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Indizien */}
      <div
        data-testid="timeline-evidence"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>INDIZIEN</div>
        {evidence.length === 0 ? (
          <div data-testid="timeline-no-evidence" style={{ color: "var(--muted)" }}>
            Keine Indizien auf dieser Zeitachse.
          </div>
        ) : (
          evidence.map((ev) => (
            <div key={ev.id} data-testid={`timeline-evidence-${ev.id}`} style={{ marginBottom: 6 }}>
              <div style={{ color: "var(--accent)", fontWeight: 700 }}>
                {ev.name} ({ev.credibility}%)
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{ev.description}</div>
            </div>
          ))
        )}
      </div>

      {/* Verdächtige */}
      <div
        data-testid="timeline-suspects"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>VERDÄCHTIGE</div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          Verdächtigen auswählen
          <select
            data-testid="suspect-select"
            value={selectedSuspectId}
            onChange={(e) => setSelectedSuspectId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Auswählen —</option>
            {ledger.suspects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {selectedSuspect && (
          <div data-testid="suspect-details" style={{ marginTop: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{selectedSuspect.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Motiv: {selectedSuspect.motive}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Alibi: {selectedSuspect.alibi} ({selectedSuspect.alibiStrength}%)
            </div>
            <div
              data-testid="suspect-alibi-warning"
              style={{
                fontSize: 10,
                color: hasContradictoryAlibi(ledger, selectedSuspect.id) ? "var(--error)" : "var(--success)",
                marginTop: 4,
              }}
            >
              {hasContradictoryAlibi(ledger, selectedSuspect.id)
                ? "⚠ Widersprüchliches Alibi"
                : "✓ Alibi konsistent"}
            </div>
          </div>
        )}
      </div>

      {/* Hauptverdächtiger + Beweiskette */}
      {primeSuspect && (
        <div
          data-testid="prime-suspect"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>HAUPTVERDÄCHTIGER</div>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>{primeSuspect.name}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>Motiv: {primeSuspect.motive}</div>
        </div>
      )}

      {strongestChain && (
        <div
          data-testid="strongest-chain"
          style={{
            border: "1px solid var(--success)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>STERKSTE BEWEISKETTE</div>
          <div style={{ color: "var(--success)", fontWeight: 700 }}>{strongestChain.name}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Stärke: {computeChainStrength(ledger, strongestChain)}%
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{strongestChain.conclusion}</div>
        </div>
      )}

      {/* Bericht */}
      <details data-testid="ledger-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="ledger-report-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatLedgerReport(ledger)}
        </pre>
      </details>
    </div>
  );
}
