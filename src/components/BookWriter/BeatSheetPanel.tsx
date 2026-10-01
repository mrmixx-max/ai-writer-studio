// BeatSheetPanel: Beat-Sheet-Vorlagen als Beat-Liste (WP 5.1).
//
// Zeigt die Struktur-Vorlagen Save the Cat, Heldenreise und Drei-Akt als
// geordnete Liste von Beats (Name, Description, Status) und blendet die
// Abdeckung der aktuellen Kapitel ein.
//
// Datenquellen:
//   - `getBeatTemplate`      → Beats der gewählten Vorlage
//   - `validateBeatCoverage` → Abdeckungsquote, fehlende Beats, Statusverteilung
//
// Standalone-Panel, lokal und deterministisch, kein LLM nötig.
// Dark Theme: bg #0a0e14, panel #11161f, border #232b3a,
// amber #ffb000, cyan #00e5ff, text #d5dbe5, dim #8a93a6.

import { useMemo, useState } from "react";
import {
  applyBeatTemplate,
  getBeatTemplate,
  validateBeatCoverage,
  type Beat,
  type BeatStatus,
  type BeatTemplate,
  type BeatTemplateType,
} from "@/services/plot/beatSheet";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const GREEN = "#25c26e";

/** Reihenfolge der angebotenen Vorlagen im Selektor. */
const TEMPLATE_TYPES: BeatTemplateType[] = [
  "save-the-cat",
  "hero-journey",
  "three-act",
];

export interface BeatSheetPanelProps {
  /** Kapitel des Buchs — Basis für die Abdeckungsprüfung. */
  chapters?: BookChapterInput[];
  /** Startvorlage (Default: "save-the-cat"). */
  templateType?: BeatTemplateType;
  /** Callback beim Wechsel der Vorlage. */
  onTemplateChange?: (type: BeatTemplateType) => void;
  className?: string;
}

interface StatusBadge {
  label: string;
  color: string;
}

/** Anzeige-Label und Farbe je Beat-Status. */
function statusBadge(status: BeatStatus): StatusBadge {
  switch (status) {
    case "completed":
      return { label: "Fertig", color: GREEN };
    case "draft":
      return { label: "Entwurf", color: CYAN };
    default:
      return { label: "Offen", color: AMBER };
  }
}

export function BeatSheetPanel({
  chapters = [],
  templateType = "save-the-cat",
  onTemplateChange,
  className,
}: BeatSheetPanelProps) {
  const [activeType, setActiveType] = useState<BeatTemplateType>(templateType);

  const templates = useMemo(
    () => TEMPLATE_TYPES.map((type) => getBeatTemplate(type)),
    [],
  );

  const template: BeatTemplate = useMemo(
    () => templates.find((t) => t.type === activeType) ?? getBeatTemplate(activeType),
    [templates, activeType],
  );

  const coverage = useMemo(
    () => validateBeatCoverage(chapters, template),
    [chapters, template],
  );

  /**
   * Status je Beat. `validateBeatCoverage` liefert nur die Aggregat-Verteilung,
   * daher wird der Einzelstatus über `applyBeatTemplate` (Kapitel → Beats)
   * aufgelöst. Beats ohne Kapitelzuordnung bleiben "pending".
   */
  const beatStatusById = useMemo(() => {
    const map = new Map<string, BeatStatus>();
    if (chapters.length > 0) {
      for (const assignment of applyBeatTemplate(chapters, template)) {
        for (const beat of assignment.beats) {
          map.set(beat.id, beat.status);
        }
      }
    }
    return map;
  }, [chapters, template]);

  const handleSelect = (type: BeatTemplateType) => {
    setActiveType(type);
    onTemplateChange?.(type);
  };

  const coveragePercent = Math.round(coverage.coverage * 100);

  return (
    <div
      className={className ?? "beat-sheet-panel"}
      data-testid="beat-sheet-panel"
      style={{
        background: PANEL,
        color: TEXT,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3 style={{ color: AMBER, margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
        🎬 Beat-Sheet
      </h3>

      <div
        data-testid="beat-template-selector"
        role="tablist"
        aria-label="Beat-Sheet-Vorlage"
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        {templates.map((item) => {
          const isActive = item.type === activeType;
          return (
            <button
              key={item.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`beat-template-${item.type}`}
              onClick={() => handleSelect(item.type)}
              style={{
                background: isActive ? AMBER : BG,
                color: isActive ? BG : TEXT,
                border: `1px solid ${isActive ? AMBER : BORDER}`,
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      <p
        data-testid="beat-template-description"
        style={{ color: DIM, fontSize: 12, margin: "0 0 12px" }}
      >
        {template.description}
      </p>

      <div data-testid="beat-coverage-summary" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            marginBottom: 4,
          }}
        >
          <span style={{ color: DIM }}>
            Abdeckung: {coverage.covered}/{coverage.total} Beats ({coveragePercent}%)
          </span>
          <span
            data-testid="beat-coverage-state"
            style={{ color: coverage.complete ? GREEN : AMBER, fontWeight: 700 }}
          >
            {coverage.complete ? "vollständig" : `${coverage.missing.length} offen`}
          </span>
        </div>
        <div
          data-testid="beat-coverage-bar"
          role="progressbar"
          aria-valuenow={coveragePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            background: BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            height: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${coveragePercent}%`,
              height: "100%",
              background: coverage.complete ? GREEN : AMBER,
            }}
          />
        </div>
        <div
          style={{ display: "flex", gap: 12, fontSize: 11, color: DIM, marginTop: 6 }}
        >
          <span data-testid="beat-status-count-pending">
            Offen: {coverage.byStatus.pending}
          </span>
          <span data-testid="beat-status-count-draft">
            Entwurf: {coverage.byStatus.draft}
          </span>
          <span data-testid="beat-status-count-completed">
            Fertig: {coverage.byStatus.completed}
          </span>
        </div>
      </div>

      {template.beats.length === 0 ? (
        <p data-testid="beat-empty" style={{ color: DIM, margin: 0, fontSize: 13 }}>
          Diese Vorlage enthält keine Beats.
        </p>
      ) : (
        <ol
          data-testid="beat-list"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {template.beats.map((beat: Beat, index) => {
            const status = beatStatusById.get(beat.id) ?? "pending";
            const badge = statusBadge(status);

            return (
              <li
                key={beat.id}
                data-testid={`beat-item-${beat.id}`}
                data-status={status}
                style={{
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${badge.color}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <span
                    data-testid={`beat-name-${beat.id}`}
                    style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}
                  >
                    <span style={{ color: DIM, marginRight: 6 }}>{index + 1}.</span>
                    {beat.name}
                  </span>
                  <span
                    data-testid={`beat-status-${beat.id}`}
                    style={{
                      color: badge.color,
                      border: `1px solid ${badge.color}`,
                      borderRadius: 10,
                      padding: "1px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <p
                  data-testid={`beat-description-${beat.id}`}
                  style={{ color: DIM, fontSize: 12, margin: 0, lineHeight: 1.4 }}
                >
                  {beat.description}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default BeatSheetPanel;
