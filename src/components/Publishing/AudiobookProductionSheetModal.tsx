// AudiobookProductionSheetModal (WP 73.2)
//
// Interaktiver Regiebogen für Hörbuch-Produktion nach ACX/Audible-Standards.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createSampleProductionSheet,
  computeQCScore,
  allCriticalChecksPassed,
  allChecksPassed,
  countPassedChecks,
  formatProductionSheet,
} from "@/services/publishing/audiobookProductionSheet";

export interface AudiobookProductionSheetModalProps {
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

export function AudiobookProductionSheetModal({ className }: AudiobookProductionSheetModalProps) {
  const [selectedChapter, setSelectedChapter] = useState<number>(1);

  const sheet = useMemo(() => createSampleProductionSheet(), []);
  const qcScore = useMemo(() => computeQCScore(sheet), [sheet]);
  const criticalPassed = useMemo(() => allCriticalChecksPassed(sheet), [sheet]);
  const allPassed = useMemo(() => allChecksPassed(sheet), [sheet]);
  const passedCount = useMemo(() => countPassedChecks(sheet), [sheet]);

  const chapter = sheet.chapters.find((c) => c.number === selectedChapter) ?? null;

  return (
    <div
      className={className}
      data-testid="audiobook-production-sheet-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎧 Master-Hörbuch-Studio-Regiebogen
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {sheet.chapters.length} Kapitel · {sheet.totalWordCount} Wörter · {sheet.totalDurationMin} Minuten
      </div>

      {/* Titel + Autor */}
      <div
        data-testid="sheet-header"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PRODUKTION</div>
        <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>{sheet.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Autor: {sheet.author}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Sprecher: {sheet.narrator.name}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          Stimmbeschreibung: {sheet.narrator.voiceDescription}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Pacing: {sheet.narrator.pacingWpm} WPM</div>
      </div>

      {/* Kapitel-Auswahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Kapitel auswählen
        <select
          data-testid="chapter-select"
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(Number(e.target.value))}
          style={inputStyle}
        >
          {sheet.chapters.map((ch) => (
            <option key={ch.number} value={ch.number}>
              §{ch.number}: {ch.title}
            </option>
          ))}
        </select>
      </label>

      {/* Kapitel-Details */}
      {chapter && (
        <div
          data-testid="chapter-details"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>KAPITEL</div>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>
            §{chapter.number}: {chapter.title}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{chapter.wordCount} Wörter</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Geschätzte Dauer: {chapter.estimatedDurationMin} Minuten
          </div>
          {chapter.notes && (
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Notizen: {chapter.notes}</div>
          )}
        </div>
      )}

      {/* QC-Checkliste */}
      <div
        data-testid="qc-checklist"
        style={{
          border: `1px solid ${allPassed ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          QC-CHECKLISTE ({passedCount}/{sheet.qcChecks.length})
        </div>
        {sheet.qcChecks.map((qc) => (
          <div
            key={qc.id}
            data-testid={`qc-check-${qc.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 3,
              fontSize: 10,
            }}
          >
            <span
              style={{
                color: qc.passed ? "var(--success)" : "var(--error)",
              }}
            >
              {qc.passed ? "✓" : "✗"} {qc.label}
            </span>
            <span style={{ color: "var(--muted)" }}>({qc.severity})</span>
          </div>
        ))}
        <div
          data-testid="qc-score"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: qcScore >= 80 ? "var(--success)" : qcScore >= 60 ? "var(--warn)" : "var(--error)",
          }}
        >
          QC-Score: {qcScore}%
        </div>
        <div
          data-testid="qc-critical"
          style={{
            fontSize: 10,
            color: criticalPassed ? "var(--success)" : "var(--error)",
            marginTop: 4,
          }}
        >
          {criticalPassed ? "✓ Alle kritischen Checks bestanden" : "⚠ Kritische Checks fehlen"}
        </div>
      </div>

      {/* ACX-Metadaten */}
      <div
        data-testid="acx-metadata"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ACX-METADATEN</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Titel: {sheet.acxMetadata.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Autor: {sheet.acxMetadata.author}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Sprecher: {sheet.acxMetadata.narrator}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Laufzeit: {sheet.acxMetadata.runtime}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Sprache: {sheet.acxMetadata.language}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Genre: {sheet.acxMetadata.genre}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          Keywords: {sheet.acxMetadata.keywords.join(", ")}
        </div>
      </div>

      {/* Vollständiger Bericht */}
      <details data-testid="sheet-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Regiebogen
        </summary>
        <pre
          data-testid="sheet-report-text"
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
          {formatProductionSheet(sheet)}
        </pre>
      </details>
    </div>
  );
}
