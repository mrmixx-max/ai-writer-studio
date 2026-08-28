// World-Bible Tab: Weltname, Prämisse, Regeln, Geschichte.
import { useEffect, useState } from "react";
import {
  getWorldBible, saveWorldBible, addWorldRule, deleteWorldRule,
  addHistoryEvent, deleteHistoryEvent, type WorldBible,
} from "@/services/worldbuilding/worldbible";
import { worldbuildingToMarkdown, downloadWorldbuildingFile } from "@/services/worldbuilding/worldbuildingExport";
import { listLocations } from "@/services/worldbuilding/locations";
import { listLore } from "@/services/worldbuilding/lore";

const RULE_CATEGORIES = ["Allgemein", "Magie", "Technologie", "Gesellschaft", "Natur", "Politik"];

export function WorldBibleTab({ projectId }: { projectId: string }) {
  const [bible, setBible] = useState<WorldBible | null>(null);
  const [name, setName] = useState("");
  const [premise, setPremise] = useState("");
  const [notes, setNotes] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [ruleCat, setRuleCat] = useState(RULE_CATEGORIES[0]);
  const [evYear, setEvYear] = useState("");
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const b = getWorldBible(projectId);
    setBible(b);
    setName(b?.name ?? ""); setPremise(b?.premise ?? ""); setNotes(b?.notes ?? "");
    setDirty(false);
  }, [projectId]);

  async function save() {
    await saveWorldBible(projectId, { name, premise, notes });
    setBible(getWorldBible(projectId));
    setDirty(false); setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function exportMd() {
    const b = getWorldBible(projectId);
    downloadWorldbuildingFile(
      worldbuildingToMarkdown({
        project: { id: projectId, exportedAt: new Date().toISOString() },
        bible: b, locations: listLocations(projectId), lore: listLore(projectId),
      }),
      "world-bible.md", "text/markdown",
    );
  }

  if (!bible) return <div className="mode-placeholder">Lade Welt-Bible…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input placeholder="Weltname" value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }} />
        <button onClick={save} disabled={!dirty}>{saved ? "✓ Gespeichert" : "Speichern"}</button>
        <button onClick={exportMd}>⬇ Markdown-Export</button>
      </div>

      <label>Prämisse</label>
      <textarea rows={3} placeholder="Was macht diese Welt besonders?"
        value={premise} onChange={(e) => { setPremise(e.target.value); setDirty(true); }} />

      <h4>Regeln</h4>
      <ul>
        {bible.rules.map((r) => (
          <li key={r.id}>
            <strong>{r.category}:</strong> {r.text}{" "}
            <button onClick={() => { deleteWorldRule(projectId, r.id).then(() => setBible(getWorldBible(projectId))); }}>🗑</button>
          </li>
        ))}
        {!bible.rules.length && <li><em>Noch keine Regeln.</em></li>}
      </ul>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <select value={ruleCat} onChange={(e) => setRuleCat(e.target.value)}>
          {RULE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input style={{ flex: 1 }} placeholder="Neue Regel…" value={ruleText}
          onChange={(e) => setRuleText(e.target.value)} />
        <button onClick={async () => {
          if (!ruleText.trim()) return;
          await addWorldRule(projectId, ruleText, ruleCat);
          setRuleText(""); setBible(getWorldBible(projectId));
        }}>+ Regel</button>
      </div>

      <h4>Geschichte</h4>
      <ul>
        {[...bible.history].sort((a, b) => a.year.localeCompare(b.year)).map((e) => (
          <li key={e.id}>
            <strong>{e.year} — {e.title}</strong>{e.description ? `: ${e.description}` : ""}{" "}
            <button onClick={() => { deleteHistoryEvent(projectId, e.id).then(() => setBible(getWorldBible(projectId))); }}>🗑</button>
          </li>
        ))}
        {!bible.history.length && <li><em>Noch keine Ereignisse.</em></li>}
      </ul>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input style={{ width: 90 }} placeholder="Jahr" value={evYear} onChange={(e) => setEvYear(e.target.value)} />
        <input placeholder="Titel" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
        <input style={{ flex: 1 }} placeholder="Beschreibung" value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
        <button onClick={async () => {
          if (!evTitle.trim()) return;
          await addHistoryEvent(projectId, evYear, evTitle, evDesc);
          setEvYear(""); setEvTitle(""); setEvDesc("");
          setBible(getWorldBible(projectId));
        }}>+ Ereignis</button>
      </div>

      <label>Notizen</label>
      <textarea rows={3} value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} />
    </div>
  );
}
