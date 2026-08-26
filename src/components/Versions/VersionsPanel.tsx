// Literarische Evolution: Versionen als Timeline mit semantischen Markierungen.
import { useState, useEffect } from "react";
import { listVersions, createVersion } from "@/services/version";
import { runKIAction } from "@/services/ki";
import { DEFAULT_SETTINGS } from "@/types/config";

const VERSION_TYPES = ["Rohfassung", "Verdichtung", "Bruch", "neue Richtung", "bereinigt", "radikalisiert"];

export function VersionsPanel({ chapterId, content }: { chapterId: string; content: string }) {
  const [versions, setVersions] = useState(listVersions(chapterId));
  const [label, setLabel] = useState("");
  const [vtype, setVtype] = useState("Rohfassung");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setVersions(listVersions(chapterId)); }, [chapterId]);

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

  return (
    <div className="versions-panel">
      <div className="versions-toolbar">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label…" />
        <select value={vtype} onChange={(e) => setVtype(e.target.value)}>
          {VERSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={saveVersion}>Version sichern</button>
        <button onClick={compare} disabled={busy || versions.length < 2}>Vergleichen</button>
      </div>
      <div className="versions-timeline">
        {versions.map((v, i) => (
          <div key={v.id} className="version-item">
            <div className="version-marker">{i + 1}</div>
            <div className="version-content">
              <strong>{v.label}</strong> <span className="vtype">{v.versionType}</span>
              <pre>{v.content.slice(0, 200)}…</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
