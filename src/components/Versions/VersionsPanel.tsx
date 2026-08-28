// Literarische Evolution: Versionen als Timeline mit semantischen Markierungen.
// Interaktive SVG-Timeline, Versions-Export (JSON/MD), KI-Vergleich,
// Diff-View (zwei Versionen nebeneinander), Rollback und Vergleichs-Export (PDF mit Markup).
import { useState, useEffect, useMemo } from "react";
import { listVersions, createVersion } from "@/services/version";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";
import { downloadData } from "@/services/characters/characterExport";
import { TimelineCanvas } from "@/components/Timeline/TimelineCanvas";
import { useEditorStore } from "@/store/editorStore";
import { CompareView, downloadComparePdf, type CompareVersionMeta } from "@/components/Compare";

const VERSION_TYPES = ["Rohfassung", "Verdichtung", "Bruch", "neue Richtung", "bereinigt", "radikalisiert"];

const TYPE_COLORS: Record<string, string> = {
  "Rohfassung": "#94a3b8",
  "Verdichtung": "#8b5cf6",
  "Bruch": "#ef4444",
  "neue Richtung": "#3b82f6",
  "bereinigt": "#10b981",
  "radikalisiert": "#f59e0b",
};

export function VersionsPanel({ chapterId, content }: { chapterId: string; content: string }) {
  const [versions, setVersions] = useState(listVersions(chapterId));
  const [label, setLabel] = useState("");
  const [vtype, setVtype] = useState("Rohfassung");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"timeline" | "compare">("timeline");
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const setContent = useEditorStore((s) => s.setContent);

  useEffect(() => {
    setVersions(listVersions(chapterId));
    setSelected(null);
    setMode("timeline");
    setLeftId(null);
    setRightId(null);
  }, [chapterId]);

  // Beim ersten Laden / nach Versionswechsel: Default-Paar = letzte zwei Versionen
  useEffect(() => {
    if (versions.length >= 2) {
      setLeftId((cur) => cur ?? versions[versions.length - 2].id);
      setRightId((cur) => cur ?? versions[versions.length - 1].id);
    }
  }, [versions]);

  async function saveVersion() {
    if (!content.trim()) return;
    await createVersion(chapterId, label || new Date().toLocaleString("de"), content, vtype);
    setVersions(listVersions(chapterId));
    setLabel("");
  }

  async function compare() {
    if (versions.length < 2) return;
    setBusy(true);
    const a = versions[versions.length - 1];
    const b = versions[versions.length - 2];
    const res = await runKIAction(
      DEFAULT_SETTINGS,
      {
        action: "zusammenfassen",
        selection: `Version A (${a.versionType}):\n${a.content}\n\nVersion B (${b.versionType}):\n${b.content}\n\nFrage: Was ist zwischen Version A und B literarisch passiert? Ton, Verdichtung, Bildhaftigkeit.`,
        context: "",
      },
      () => {},
    );
    alert(res.text);
    setBusy(false);
  }

  /** Rollback: Inhalt einer Version zurück in den Editor holen und als neuen
   *  Rollback-Eintrag sichern (nicht-destruktiv — die alte Version bleibt erhalten). */
  async function rollback(id: string) {
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    if (!window.confirm(`Version "${v.label}" wiederherstellen? Der aktuelle Editor-Inhalt wird ersetzt (als Rollback-Eintrag gesichert).`)) return;
    if (content.trim()) {
      await createVersion(chapterId, `Sicherung vor Rollback (${new Date().toLocaleString("de")})`, content, "Rohfassung");
    }
    setContent(v.content);
    await createVersion(chapterId, `Rollback → ${v.label}`, v.content, v.versionType);
    setVersions(listVersions(chapterId));
  }

  function doExport(format: "json" | "md") {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadData(JSON.stringify({ chapterId, versions }, null, 2), `versions-${stamp}.json`, "application/json");
    } else {
      const md = ["# Versionen", ""]
        .concat(versions.map((v) => `## ${v.label} (${v.versionType}, ${new Date(v.createdAt).toLocaleString("de")})\n\n${v.content}\n`))
        .join("\n");
      downloadData(md, `versions-${stamp}.md`, "text/markdown");
    }
  }

  const timelineItems = useMemo(
    () =>
      versions.map((v) => ({
        id: v.id,
        label: v.label,
        sub: v.versionType,
        detail: v.content.slice(0, 400) + (v.content.length > 400 ? "…" : ""),
        color: TYPE_COLORS[v.versionType],
      })),
    [versions],
  );

  const leftMeta: CompareVersionMeta | null = useMemo(
    () => versions.find((v) => v.id === leftId) ?? null,
    [versions, leftId],
  );
  const rightMeta: CompareVersionMeta | null = useMemo(
    () => versions.find((v) => v.id === rightId) ?? null,
    [versions, rightId],
  );

  return (
    <div className="versions-panel">
      <div className="versions-toolbar">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label…" />
        <select value={vtype} onChange={(e) => setVtype(e.target.value)}>
          {VERSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={saveVersion}>Version sichern</button>
        <button onClick={compare} disabled={busy || versions.length < 2}>KI-Vergleich</button>
        <span className="versions-mode-switch">
          <button className={mode === "timeline" ? "active" : ""} onClick={() => setMode("timeline")}>Timeline</button>
          <button
            className={mode === "compare" ? "active" : ""}
            onClick={() => setMode("compare")}
            disabled={versions.length < 2}
            data-testid="btn-diff-view"
          >
            Diff-View
          </button>
        </span>
      </div>

      {mode === "compare" && leftMeta && rightMeta && (
        <div className="compare-panel">
          <div className="compare-toolbar">
            <label>A:
              <select value={leftId ?? ""} onChange={(e) => setLeftId(e.target.value)}>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <label>B:
              <select value={rightId ?? ""} onChange={(e) => setRightId(e.target.value)}>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <button
              data-testid="btn-compare-pdf"
              onClick={() => downloadComparePdf(leftMeta.label, rightMeta.label, leftMeta.content, rightMeta.content, chapterId)}
            >
              PDF mit Markup
            </button>
          </div>
          <CompareView left={leftMeta} right={rightMeta} />
        </div>
      )}

      {mode === "timeline" && versions.length > 0 && (
        <TimelineCanvas
          items={timelineItems}
          selectedId={selected}
          onSelect={setSelected}
          height={200}
        />
      )}

      <div className="versions-export">
        <span>Export:</span>
        <button onClick={() => doExport("json")} disabled={!versions.length}>JSON</button>
        <button onClick={() => doExport("md")} disabled={!versions.length}>Markdown</button>
      </div>

      <div className="versions-timeline">
        {versions.map((v, i) => (
          <div key={v.id} className="version-item" style={{ outline: v.id === selected ? "1px solid #8b5cf6" : "none" }}>
            <div className="version-marker">{i + 1}</div>
            <div className="version-content">
              <strong>{v.label}</strong> <span className="vtype">{v.versionType}</span>
              <pre>{v.content.slice(0, 200)}…</pre>
              <div className="version-actions">
                <button className="version-rollback" onClick={() => rollback(v.id)} data-testid={`rollback-${v.id}`}>
                  ⟲ Zurücksetzen
                </button>
                <button onClick={() => { setLeftId(v.id); setMode("compare"); }}>
                  Als A vergleichen
                </button>
                <button onClick={() => { setRightId(v.id); setMode("compare"); }}>
                  Als B vergleichen
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
