// RelationshipChemistry (WP 52.1): Beziehungs-Chemie- & Funken-Matrix.
//
// Banter-Index, Schlagabtausch-Quote, Phasen-Tracker und Spannungs-Abfall-Warnung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useMemo, useState } from "react";
import {
  analyzeRelationshipChemistry,
  detectTensionDrop,
  trackPhaseProgression,
  type DialogueLine,
  type ChapterScene,
} from "@/services/dramaturgy/relationshipChemistry";

export interface RelationshipChemistryProps {
  className?: string;
}

const DEFAULT_DIALOGUE: DialogueLine[] = [
  { speaker: "A", text: "Du bist unmöglich.", chapter: 1 },
  { speaker: "B", text: "Und du bist unausstehlich.", chapter: 1 },
  { speaker: "A", text: "Das ist kein Kompliment.", chapter: 1 },
  { speaker: "B", text: "Es war keins.", chapter: 1 },
  { speaker: "A", text: "Ich hasse dich.", chapter: 2 },
  { speaker: "B", text: "Ich weiß.", chapter: 2 },
  { speaker: "A", text: "Aber ich vertraue dir.", chapter: 3 },
  { speaker: "B", text: "Das ist das Schlimmste.", chapter: 3 },
];

const DEFAULT_CHAPTERS: ChapterScene[] = [
  { chapter: 1, characterA: "A", characterB: "B", hasLoadedScene: true },
  { chapter: 2, characterA: "A", characterB: "B", hasLoadedScene: true },
  { chapter: 3, characterA: "A", characterB: "B", hasLoadedScene: false },
  { chapter: 4, characterA: "A", characterB: "B", hasLoadedScene: false },
  { chapter: 5, characterA: "A", characterB: "B", hasLoadedScene: false },
  { chapter: 6, characterA: "A", characterB: "B", hasLoadedScene: false },
  { chapter: 7, characterA: "A", characterB: "B", hasLoadedScene: false },
  { chapter: 8, characterA: "A", characterB: "B", hasLoadedScene: true },
];

export function RelationshipChemistry({ className }: RelationshipChemistryProps) {
  const [dialogue] = useState(DEFAULT_DIALOGUE);
  const [chapters] = useState(DEFAULT_CHAPTERS);

  const chemistry = useMemo(() => analyzeRelationshipChemistry(dialogue), [dialogue]);
  const tensionDrop = useMemo(() => detectTensionDrop(chapters), [chapters]);
  const phaseProgression = useMemo(() => trackPhaseProgression(chapters), [chapters]);


  return (
    <div
      className={className}
      data-testid="relationship-chemistry"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💞 Beziehungs-Chemie
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {dialogue.length} Dialogzeilen · {chapters.length} Kapitel · Phase: {chemistry.phase}
      </div>

      {/* Metriken */}
      <div data-testid="chemistry-metrics" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>METRIKEN</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Banter-Index</div>
            <div data-testid="chemistry-banter" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
              {chemistry.banterIndex}
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Schlagabtausch</div>
            <div data-testid="chemistry-ratio" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
              {(chemistry.banterRatio * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Unterbrechungen</div>
            <div data-testid="chemistry-interruptions" style={{ fontSize: 18, fontWeight: 700, color: "var(--warn)" }}>
              {chemistry.interruptions}
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Neckereien</div>
            <div data-testid="chemistry-teasing" style={{ fontSize: 18, fontWeight: 700, color: "var(--warn)" }}>
              {chemistry.teasingCount}
            </div>
          </div>
        </div>
      </div>

      {/* Phasen-Tracker */}
      <div data-testid="chemistry-phase" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>PHASEN-TRACKER</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {["hostility", "reluctant-respect", "vulnerability", "devotion"].map((phase) => (
            <div
              key={phase}
              data-testid={`chemistry-phase-${phase}`}
              style={{
                flex: 1,
                padding: "6px 4px",
                textAlign: "center",
                fontSize: 9,
                borderRadius: 3,
                background: chemistry.phase === phase ? "var(--accent)" : "transparent",
                color: chemistry.phase === phase ? "var(--bg)" : "var(--muted)",
                border: `1px solid ${chemistry.phase === phase ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {phase}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Fortschritt: {(phaseProgression.progress * 100).toFixed(0)}%
          {phaseProgression.nextPhase && (
            <span style={{ color: "var(--accent)" }}> → Nächste: {phaseProgression.nextPhase}</span>
          )}
        </div>
      </div>

      {/* Spannungs-Abfall-Warnung */}
      {tensionDrop && (
        <div
          data-testid="chemistry-tension-drop"
          style={{
            border: "1px solid var(--error)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
            color: "var(--error)",
          }}
        >
          ⚠ Spannungs-Abfall: Kapitel {tensionDrop.startChapter}–{tensionDrop.endChapter}: {tensionDrop.reason}
        </div>
      )}

      {!tensionDrop && (
        <div data-testid="chemistry-no-drop" style={{ fontSize: 12, color: "var(--success)", marginBottom: 14 }}>
          ✓ Kein Spannungs-Abfall.
        </div>
      )}

      {/* Dialog-Vorschau */}
      <div data-testid="chemistry-dialogue" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>DIALOG</div>
        <div style={{ maxHeight: 200, overflow: "auto" }}>
          {dialogue.map((line, i) => (
            <div
              key={i}
              data-testid={`chemistry-line-${i}`}
              style={{
                display: "flex",
                gap: 8,
                padding: "3px 8px",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: 20 }}>
                {line.speaker}:
              </span>
              <span style={{ flex: 1 }}>{line.text}</span>
              <span style={{ color: "var(--muted)", fontSize: 9 }}>Kap. {line.chapter}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
