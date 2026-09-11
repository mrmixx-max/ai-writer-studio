// ConsistencyPanel (Sprint 26, Agent 1): Widersprüche in Charakteren,
// Handlung, Zeitleisten und Emotionen anzeigen.
// Bloomberg-Terminal-Stil (Inline-Styles, keine neuen Dependencies).
import { useState, useCallback } from "react";
import {
  generateConsistencyReport,
  type ConsistencyReport,
  type ConsistencyIssue,
} from "@/services/consistency/consistencyChecker";
import type { Character } from "@/services/character/characterManager";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const RED = "#ff4444";
const YELLOW = "#ffaa00";
const GREEN = "#44ff88";

const SEVERITY_COLORS = {
  high: RED,
  medium: YELLOW,
  low: GREEN,
};

const SEVERITY_LABELS = {
  high: "HOCH",
  medium: "MITTEL",
  low: "NIEDRIG",
};

const TYPE_LABELS = {
  character: "CHARAKTER",
  timeline: "ZEITLEISTE",
  plot: "HANDLUNG",
  emotion: "EMOTION",
};

export function ConsistencyPanel() {
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setBusy(true);
    try {
      // Demo-Daten für den Test
      const characters: Character[] = [
        { id: "1", name: "Max", age: 30, backstory: "Ein mutiger Held", relationships: [] },
        { id: "2", name: "Max", age: 25, backstory: "Ein anderer Max", relationships: [] },
        { id: "3", name: "", age: -5, relationships: [] },
      ];
      const chapters = [
        { id: "c1", title: "Anfang", content: "Es war einmal ein dunkler Wald. Die Angst war allgegenwärtig." },
        { id: "c2", title: "Mitte", content: "Kurzes Kapitel." },
      ];
      const timeline = [
        { id: "t1", date: "2024-01-15", title: "Start" },
        { id: "t2", date: "2024-01-15", title: "Doppelt" },
        { id: "t3", date: "invalid", title: "Ungültig" },
      ];

      const rep = generateConsistencyReport({ characters, chapters, timeline });
      setReport(rep);
    } finally {
      setBusy(false);
    }
  }, []);

  const filteredIssues = report?.issues.filter(
    (i) => !filterSeverity || i.severity === filterSeverity
  ) ?? [];

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        🔍 KONSISTENZ-CHECK
      </h2>

      <button
        onClick={handleCheck}
        disabled={busy}
        style={{
          padding: "8px 20px",
          background: busy ? DIM : AMBER,
          color: "#000",
          border: "none",
          cursor: busy ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {busy ? "LÄUFT..." : "PRÜFEN"}
      </button>

      {report && (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>GESAMT</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{report.summary.total}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${RED}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>HOCH</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>{report.summary.high}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${YELLOW}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>MITTEL</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: YELLOW }}>{report.summary.medium}</div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${GREEN}`, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: DIM, fontSize: 10 }}>NIEDRIG</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GREEN }}>{report.summary.low}</div>
            </div>
          </div>

          {/* Filter */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            <button
              onClick={() => setFilterSeverity(null)}
              style={{
                padding: "4px 10px",
                background: !filterSeverity ? AMBER : PANEL,
                color: !filterSeverity ? "#000" : TEXT,
                border: `1px solid ${!filterSeverity ? AMBER : BORDER}`,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              ALLE
            </button>
            {(["high", "medium", "low"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                style={{
                  padding: "4px 10px",
                  background: filterSeverity === s ? AMBER : PANEL,
                  color: filterSeverity === s ? "#000" : TEXT,
                  border: `1px solid ${filterSeverity === s ? AMBER : BORDER}`,
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {SEVERITY_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Issues */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredIssues.map((issue: ConsistencyIssue) => (
              <div
                key={issue.id}
                style={{
                  background: PANEL,
                  border: `1px solid ${SEVERITY_COLORS[issue.severity]}`,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: SEVERITY_COLORS[issue.severity], fontSize: 11, fontWeight: 700 }}>
                    {SEVERITY_LABELS[issue.severity]}
                  </span>
                  <span style={{ color: DIM, fontSize: 10 }}>
                    {TYPE_LABELS[issue.type]}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{issue.message}</div>
                {issue.details && (
                  <div style={{ color: DIM, fontSize: 11, marginTop: 4 }}>{issue.details}</div>
                )}
              </div>
            ))}
            {filteredIssues.length === 0 && (
              <div style={{ color: GREEN, textAlign: "center", padding: 20 }}>
                ✓ Keine Probleme gefunden
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
