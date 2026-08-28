// Diff-View: zwei Kapitel-Versionen nebeneinander mit hervorgehobenen Änderungen.
import { useMemo } from "react";
import { diffLines, diffStats } from "./diff";
import "./compare.css";

export interface CompareSelection {
  leftId: string;
  rightId: string;
}

export interface CompareVersionMeta {
  id: string;
  label: string;
  versionType: string;
  createdAt: number;
  content: string;
}

export function CompareView({ left, right }: { left: CompareVersionMeta; right: CompareVersionMeta }) {
  const lines = useMemo(() => diffLines(left.content, right.content), [left.content, right.content]);
  const stats = useMemo(() => diffStats(lines), [lines]);

  // Zwei synchronisierte Spalten: links Version A, rechts Version B.
  // "changed"-Zeilen erscheinen in beiden Spalten (mit Inline-Markup),
  // "delete" nur links, "insert" nur rechts — die Gegenstelle bleibt leer.
  const rows = useMemo(() => {
    const leftRows: Array<{ op: string; segments: any[]; no?: number; ghost?: boolean }> = [];
    const rightRows: Array<{ op: string; segments: any[]; no?: number; ghost?: boolean }> = [];
    for (const l of lines) {
      if (l.op === "equal") {
        leftRows.push({ op: "equal", segments: l.segments, no: l.leftNo });
        rightRows.push({ op: "equal", segments: l.segments, no: l.rightNo });
      } else if (l.op === "changed") {
        leftRows.push({ op: "changed", segments: l.segments, no: l.leftNo });
        rightRows.push({ op: "changed", segments: l.segments, no: l.rightNo });
      } else if (l.op === "delete") {
        leftRows.push({ op: "delete", segments: l.segments, no: l.leftNo });
        rightRows.push({ op: "ghost", segments: [], ghost: true });
      } else {
        leftRows.push({ op: "ghost", segments: [], ghost: true });
        rightRows.push({ op: "insert", segments: l.segments, no: l.rightNo });
      }
    }
    return leftRows.map((lr, i) => ({ left: lr, right: rightRows[i] }));
  }, [lines]);

  return (
    <div className="compare-view" data-testid="compare-view">
      <div className="compare-header">
        <div className="compare-meta">
          <strong>A:</strong> {left.label} <span className="vtype">{left.versionType}</span>
          {" → "}
          <strong>B:</strong> {right.label} <span className="vtype">{right.versionType}</span>
        </div>
        <div className="compare-stats" data-testid="compare-stats">
          <span className="stat-added">+{stats.added} Wörter</span>
          <span className="stat-deleted">−{stats.deleted} Wörter</span>
          <span className="stat-changed">{stats.changedLines} geänderte Zeilen</span>
        </div>
      </div>
      <div className="compare-columns">
        <div className="compare-col" data-side="a">
          <div className="compare-col-title">{left.label}</div>
          {rows.map((r, i) => (
            <DiffRow key={i} row={r.left} side="a" />
          ))}
        </div>
        <div className="compare-col" data-side="b">
          <div className="compare-col-title">{right.label}</div>
          {rows.map((r, i) => (
            <DiffRow key={i} row={r.right} side="b" />
          ))}
        </div>
      </div>
      <div className="compare-legend">
        <span className="legend-del">durchgestrichen/rot = gelöscht</span>
        <span className="legend-add">grün = hinzugefügt</span>
        <span className="legend-chg">gelb = geändert</span>
      </div>
    </div>
  );
}

function DiffRow({ row, side }: { row: { op: string; segments: any[]; no?: number; ghost?: boolean }; side: "a" | "b" }) {
  if (row.ghost) return <div className={`diff-row diff-ghost diff-${side}-ghost`}>&nbsp;</div>;
  const cls =
    row.op === "equal"
      ? "diff-equal"
      : row.op === "delete"
        ? side === "a"
          ? "diff-del"
          : "diff-del-target"
        : row.op === "insert"
          ? side === "b"
            ? "diff-add"
            : "diff-add-target"
          : "diff-changed";
  return (
    <div className={`diff-row ${cls}`}>
      <span className="diff-no">{row.no ?? ""}</span>
      <span className="diff-text">
        {row.segments.map((s, i) => (
          <span
            key={i}
            className={
              s.op === "equal"
                ? "seg-equal"
                : s.op === "delete"
                  ? side === "a"
                    ? "seg-del"
                    : "seg-del-inline"
                  : s.op === "insert"
                    ? side === "b"
                      ? "seg-add"
                      : "seg-add-inline"
                    : "seg-chg"
            }
          >
            {s.text}
          </span>
        ))}
      </span>
    </div>
  );
}
