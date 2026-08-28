// Versionsvergleich: Diff-Ansicht zwischen zwei literarischen Versionen.
import { useEffect, useMemo, useState } from "react";
import { listVersions } from "@/services/version";
import type { LiteraryVersion } from "@/types/project";
import { tiptapToText } from "@/services/editor/count";
import { diffWords, diffLines, diffStats, similarity } from "@/services/collaboration/diff";
import type { DiffSegment } from "@/types/collaboration";

interface VersionDiffProps {
  chapterId: string;
  refreshKey?: number;
}

export function VersionDiff({ chapterId, refreshKey = 0 }: VersionDiffProps) {
  const [versions, setVersions] = useState<LiteraryVersion[]>([]);
  const [baseId, setBaseId] = useState<string>("");
  const [compareId, setCompareId] = useState<string>("");
  const [view, setView] = useState<"words" | "lines">("words");

  useEffect(() => {
    const v = listVersions(chapterId);
    setVersions(v);
    if (v.length >= 2) {
      setBaseId(v[v.length - 2].id);
      setCompareId(v[v.length - 1].id);
    } else if (v.length === 1) {
      setCompareId(v[0].id);
    }
  }, [chapterId, refreshKey]);

  const baseText = useMemo(() => {
    const v = versions.find((x) => x.id === baseId);
    return v ? tiptapToText(v.content) : "";
  }, [versions, baseId]);

  const compareText = useMemo(() => {
    const v = versions.find((x) => x.id === compareId);
    return v ? tiptapToText(v.content) : "";
  }, [versions, compareId]);

  const segments: DiffSegment[] = useMemo(() => {
    if (!baseId || !compareId) return [];
    return view === "words" ? diffWords(baseText, compareText) : diffLines(baseText, compareText);
  }, [baseId, compareId, baseText, compareText, view]);

  const stats = useMemo(() => diffStats(segments), [segments]);
  const sim = useMemo(() => (baseId && compareId ? similarity(baseText, compareText) : null), [baseId, compareId, baseText, compareText]);

  if (versions.length < 2) {
    return <div className="collab-panel"><div className="collab-empty">Für einen Vergleich werden mindestens zwei Versionen benötigt.</div></div>;
  }

  return (
    <div className="collab-panel">
      <div className="diff-controls">
        <select className="collab-select" value={baseId} onChange={(e) => setBaseId(e.target.value)} aria-label="Basisversion">
          {versions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <span className="diff-arrow">→</span>
        <select className="collab-select" value={compareId} onChange={(e) => setCompareId(e.target.value)} aria-label="Vergleichsversion">
          {versions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <button
          className={"collab-btn small" + (view === "words" ? " active" : "")}
          onClick={() => setView("words")}
        >
          Wörter
        </button>
        <button
          className={"collab-btn small" + (view === "lines" ? " active" : "")}
          onClick={() => setView("lines")}
        >
          Absätze
        </button>
      </div>

      <div className="diff-stats">
        <span className="stat ins">＋{stats.inserted}</span>
        <span className="stat del">－{stats.deleted}</span>
        <span className="stat eq">{stats.unchanged} unverändert</span>
        {sim !== null && <span className="stat">Ähnlichkeit {Math.round(sim * 100)} %</span>}
      </div>

      <div className="diff-view">
        {segments.map((s, i) => {
          if (s.type === "equal") return <span key={i}>{s.text}</span>;
          if (s.type === "insert") return <ins key={i} className="tc-insert">{s.text}</ins>;
          return <del key={i} className="tc-delete">{s.text}</del>;
        })}
      </div>
    </div>
  );
}
