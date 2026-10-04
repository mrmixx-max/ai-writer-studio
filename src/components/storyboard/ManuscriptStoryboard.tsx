// ManuscriptStoryboard (WP 42.1): Interaktive Manuskript-Korkwand.
//
// Jedes Kapitel ist eine Karteikarte mit Titel, Teaser, Status, Wortzahl und
// Akt-Zuordnung. Karten lassen sich per Drag & Drop umsortieren und Akten
// zuweisen; die neue Reihenfolge wird per Callback an die Datenbank gemeldet.
//
// Design-Token-only (var(--bg) etc.) — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";

export type ChapterStatus = "draft" | "editing" | "done";

export type ActLabel =
  | "Akt 1"
  | "Wendepunkt"
  | "Akt 2A"
  | "Midpoint"
  | "Akt 2B"
  | "Klimax"
  | "Resolution";

export const ACT_LABELS: ActLabel[] = [
  "Akt 1",
  "Wendepunkt",
  "Akt 2A",
  "Midpoint",
  "Akt 2B",
  "Klimax",
  "Resolution",
];

export interface StoryboardChapter {
  id: string;
  title: string;
  /** Teaser/Zusammenfassung (optional). */
  teaser?: string;
  status: ChapterStatus;
  wordCount: number;
  /** Farb-Label (CSS-Farbe oder Token). */
  color?: string;
  /** Akt-Zuordnung. */
  act?: ActLabel;
}

export interface ManuscriptStoryboardProps {
  chapters: StoryboardChapter[];
  /** Wird nach Umsortieren mit der neuen ID-Reihenfolge gerufen. */
  onReorder?: (orderedIds: string[]) => void;
  /** Wird beim Ändern der Akt-Zuordnung gerufen. */
  onAssignAct?: (chapterId: string, act: ActLabel) => void;
  className?: string;
}

const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: "Entwurf",
  editing: "Lektorat",
  done: "Fertig",
};

/** Verschiebt ein Element von `from` nach `to` (unveränderlich). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Gruppiert Kapitel nach Akt-Zuordnung, unzugeordnete zuletzt. */
export function groupByAct(
  chapters: StoryboardChapter[],
): { act: ActLabel | "Ohne Akt"; chapters: StoryboardChapter[] }[] {
  const groups: { act: ActLabel | "Ohne Akt"; chapters: StoryboardChapter[] }[] = [];
  for (const act of ACT_LABELS) {
    const inAct = chapters.filter((c) => c.act === act);
    if (inAct.length > 0) groups.push({ act, chapters: inAct });
  }
  const unassigned = chapters.filter((c) => !c.act);
  if (unassigned.length > 0) groups.push({ act: "Ohne Akt", chapters: unassigned });
  return groups;
}

/** Erzeugt einen kurzen Teaser aus dem Kapiteltext. */
export function makeTeaser(content: string, maxLen = 110): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return flat.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

export function ManuscriptStoryboard({
  chapters,
  onReorder,
  onAssignAct,
  className,
}: ManuscriptStoryboardProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [grouped, setGrouped] = useState(false);

  const totalWords = useMemo(
    () => chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0),
    [chapters],
  );

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      const next = moveItem(chapters, dragIndex, targetIndex);
      onReorder?.(next.map((c) => c.id));
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [chapters, dragIndex, onReorder],
  );

  const renderCard = (chapter: StoryboardChapter, index: number) => {
    const isDragging = dragIndex === index;
    const isOver = dragOverIndex === index;
    return (
      <div
        key={chapter.id}
        data-testid={`storyboard-card-${chapter.id}`}
        draggable
        onDragStart={() => setDragIndex(index)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverIndex(index);
        }}
        onDragLeave={() => setDragOverIndex((v) => (v === index ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(index);
        }}
        onDragEnd={() => {
          setDragIndex(null);
          setDragOverIndex(null);
        }}
        style={{
          background: "var(--bg)",
          border: `1px solid ${isOver ? "var(--accent)" : "var(--border)"}`,
          borderLeft: `4px solid ${chapter.color ?? "var(--accent)"}`,
          borderRadius: 4,
          padding: 10,
          cursor: "grab",
          opacity: isDragging ? 0.45 : 1,
          minWidth: 200,
          flex: "1 1 220px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ color: "var(--fg)", fontSize: 12 }}>
            {index + 1}. {chapter.title}
          </strong>
          <span
            data-testid={`storyboard-status-${chapter.id}`}
            style={{
              fontSize: 9,
              color: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "1px 5px",
              whiteSpace: "nowrap",
            }}
          >
            {STATUS_LABEL[chapter.status]}
          </span>
        </div>

        {chapter.teaser && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
            {chapter.teaser}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
            gap: 6,
          }}
        >
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            {chapter.wordCount.toLocaleString("de-DE")} W.
          </span>
          <select
            data-testid={`storyboard-act-${chapter.id}`}
            value={chapter.act ?? ""}
            onChange={(e) => onAssignAct?.(chapter.id, e.target.value as ActLabel)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              fontSize: 10,
              padding: "2px 4px",
            }}
          >
            <option value="">Ohne Akt</option>
            {ACT_LABELS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div
      className={className}
      data-testid="manuscript-storyboard"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 14, height: "100%", overflow: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--accent)" }}>🗂️ Korkwand</h3>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {chapters.length} Kapitel · {totalWords.toLocaleString("de-DE")} Wörter
          </div>
        </div>
        <button
          data-testid="storyboard-toggle-grouping"
          onClick={() => setGrouped((v) => !v)}
          style={{
            background: grouped ? "var(--accent)" : "transparent",
            color: grouped ? "var(--bg)" : "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "4px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {grouped ? "Ungruppiert" : "Nach Akten"}
        </button>
      </div>

      {chapters.length === 0 && (
        <div data-testid="storyboard-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Keine Kapitel vorhanden.
        </div>
      )}

      {!grouped && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {chapters.map((c, i) => renderCard(c, i))}
        </div>
      )}

      {grouped &&
        groupByAct(chapters).map((group) => (
          <div key={group.act} style={{ marginBottom: 16 }}>
            <div
              data-testid={`storyboard-act-group-${group.act}`}
              style={{
                fontSize: 11,
                color: "var(--accent)",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 3,
                marginBottom: 8,
              }}
            >
              {group.act} · {group.chapters.length} Kapitel
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {group.chapters.map((c) => renderCard(c, chapters.indexOf(c)))}
            </div>
          </div>
        ))}
    </div>
  );
}
