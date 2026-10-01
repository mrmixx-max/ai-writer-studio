// CorkboardPanel: Korkwand mit Kapitel-Karten als Drag-and-Drop-Grid (WP 5.1).
//
// Zeigt jedes Kapitel als Karte (Titel, Logline, POV-Charakter, Ort,
// Status-Badge) in einem Raster. Das Grid-Layout stammt aus
// `getCorkboardLayout`, das Reordering aus `reorderChapters`; jeder Zug wird
// vorher mit `validateCorkboardMove` geprüft. Drag & Drop nutzt die nativen
// HTML5-Events (keine Zusatz-Dependency).
//
// Standalone-Panel, lokal und deterministisch, kein LLM nötig.
// Dark Theme: bg #0a0e14, panel #11161f, border #232b3a,
// amber #ffb000, cyan #00e5ff, text #d5dbe5, dim #8a93a6.

import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  getCorkboardLayout,
  reorderChapters,
  validateCorkboardMove,
  type BookChapterIndex,
} from "@/services/plot/corkboard";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const GREEN = "#25c26e";

export interface CorkboardPanelProps {
  /** Kapitel der Korkwand (gelesen, nie mutiert). */
  chapters: BookChapterIndex[];
  /** Spalten des Rasters (Default: 3). */
  columns?: number;
  /** Callback nach einem gültigen Drop mit der neu geordneten Liste. */
  onReorder?: (chapters: BookChapterIndex[]) => void;
  /** Callback bei Klick auf eine Karte. */
  onChapterClick?: (chapter: BookChapterIndex) => void;
  className?: string;
}

interface StatusBadge {
  label: string;
  color: string;
}

/** Anzeige-Label und Farbe je Kapitel-Status. */
function statusBadge(status: BookChapterIndex["status"]): StatusBadge {
  switch (status) {
    case "completed":
      return { label: "Fertig", color: GREEN };
    case "revision":
      return { label: "Überarbeitung", color: CYAN };
    default:
      return { label: "Entwurf", color: AMBER };
  }
}

/** Liest den Quellindex aus dem DataTransfer (Fallback, falls State fehlt). */
function readDragIndex(event: DragEvent<HTMLElement>): number | null {
  const transfer = event.dataTransfer as DataTransfer | undefined;
  if (!transfer || typeof transfer.getData !== "function") return null;
  try {
    const raw = transfer.getData("text/plain");
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    /* DataTransfer ohne getData (z. B. Test-Double) */
    return null;
  }
}

/** Schreibt den Quellindex in den DataTransfer (defensiv). */
function writeDragIndex(event: DragEvent<HTMLElement>, index: number): void {
  const transfer = event.dataTransfer as DataTransfer | undefined;
  if (!transfer) return;
  transfer.effectAllowed = "move";
  if (typeof transfer.setData !== "function") return;
  try {
    transfer.setData("text/plain", String(index));
  } catch {
    /* DataTransfer ohne setData (z. B. Test-Double) */
  }
}

export function CorkboardPanel({
  chapters,
  columns = 3,
  onReorder,
  onChapterClick,
  className,
}: CorkboardPanelProps) {
  // Interner Spiegel der Kapitel: erlaubt Reordering auch ohne kontrollierten
  // Parent (uncontrolled), synchronisiert sich bei neuen Props.
  const [items, setItems] = useState<BookChapterIndex[]>(chapters);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setItems(chapters);
  }, [chapters]);

  const layout = useMemo(
    () => getCorkboardLayout(items, columns),
    [items, columns],
  );

  /** Position (row/col, 0-basiert) je Kapitel-ID aus dem Grid-Layout. */
  const positionById = useMemo(() => {
    const map = new Map<string, { row: number; col: number }>();
    for (const position of layout.positions) {
      map.set(position.id, { row: position.row, col: position.col });
    }
    return map;
  }, [layout]);

  const handleDragStart = (event: DragEvent<HTMLElement>, index: number) => {
    setDragIndex(index);
    writeDragIndex(event, index);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    const transfer = event.dataTransfer as DataTransfer | undefined;
    if (transfer) transfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    const from = dragIndex ?? readDragIndex(event);

    if (from !== null && validateCorkboardMove(items, from, index)) {
      const next = reorderChapters(items, from, index);
      setItems(next);
      onReorder?.(next);
    }

    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div
      className={className ?? "corkboard-panel"}
      data-testid="corkboard-panel"
      style={{
        background: PANEL,
        color: TEXT,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
        }}
      >
        <h3 style={{ color: AMBER, margin: 0, fontSize: 16, fontWeight: 700 }}>
          🗂️ Korkwand
        </h3>
        <span
          data-testid="corkboard-count"
          style={{ color: DIM, fontSize: 12 }}
        >
          {items.length} Kapitel · {layout.columns} Spalten
        </span>
      </div>

      {items.length === 0 ? (
        <p
          data-testid="corkboard-empty"
          style={{ color: DIM, margin: 0, fontSize: 13 }}
        >
          Keine Kapitel vorhanden — lege Kapitel an, um sie hier zu ordnen.
        </p>
      ) : (
        <div
          data-testid="corkboard-grid"
          role="list"
          aria-label="Kapitel-Korkwand"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {items.map((chapter, index) => {
            const badge = statusBadge(chapter.status);
            const position = positionById.get(chapter.id);
            const isDragging = dragIndex === index;
            const isOver = overIndex === index && dragIndex !== index;

            return (
              <div
                key={chapter.id}
                role="listitem"
                draggable
                data-testid={`corkboard-card-${chapter.id}`}
                data-index={index}
                data-status={chapter.status}
                aria-grabbed={isDragging}
                aria-label={`Kapitel ${chapter.title}`}
                onClick={() => onChapterClick?.(chapter)}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={handleDragEnd}
                style={{
                  gridRow: position ? position.row + 1 : undefined,
                  gridColumn: position ? position.col + 1 : undefined,
                  background: BG,
                  border: `1px solid ${isOver ? AMBER : BORDER}`,
                  borderLeft: `3px solid ${badge.color}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  cursor: "grab",
                  opacity: isDragging ? 0.5 : 1,
                  transition: "border-color 0.12s ease, opacity 0.12s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    data-testid={`corkboard-card-title-${chapter.id}`}
                    style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}
                  >
                    {chapter.title}
                  </span>
                  <span
                    data-testid={`corkboard-status-${chapter.id}`}
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
                  data-testid={`corkboard-card-logline-${chapter.id}`}
                  style={{
                    color: DIM,
                    fontSize: 12,
                    margin: "0 0 8px",
                    lineHeight: 1.4,
                  }}
                >
                  {chapter.logline}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 11,
                    flexWrap: "wrap",
                  }}
                >
                  <span data-testid={`corkboard-card-pov-${chapter.id}`}>
                    <span style={{ color: DIM }}>POV: </span>
                    <span style={{ color: CYAN }}>{chapter.povCharacter}</span>
                  </span>
                  <span data-testid={`corkboard-card-location-${chapter.id}`}>
                    <span style={{ color: DIM }}>Ort: </span>
                    <span style={{ color: TEXT }}>{chapter.location}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CorkboardPanel;
