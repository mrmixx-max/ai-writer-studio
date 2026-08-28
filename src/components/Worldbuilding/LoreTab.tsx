// Lore-Tab: Glossar-Editor für Begriffe, Artefakte, Mythen etc.
import { useEffect, useState } from "react";
import {
  listLore, createLoreEntry, saveLoreEntry, deleteLoreEntry,
  LORE_CATEGORIES, type LoreEntry,
} from "@/services/worldbuilding/lore";

export function LoreTab({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<LoreEntry[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(LORE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { refresh(); setSelected(null); }, [projectId]);
  function refresh() { setEntries(listLore(projectId)); }

  function select(e: LoreEntry) {
    setSelected(e.id);
    setName(e.name); setCategory(e.category); setDescription(e.description);
    setAliases(e.aliases.join(", ")); setNotes(e.notes);
  }

  async function save() {
    if (!name.trim()) return;
    const aliasList = aliases.split(",").map((a) => a.trim()).filter(Boolean);
    if (selected) {
      const existing = entries.find((e) => e.id === selected)!;
      await saveLoreEntry({ ...existing, name: name.trim(), category, description, aliases: aliasList, notes });
    } else {
      await createLoreEntry(projectId, { name, category, description, aliases: aliasList, notes });
    }
    setName(""); setDescription(""); setAliases(""); setNotes("");
    setSelected(null);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Eintrag löschen?")) return;
    await deleteLoreEntry(id);
    if (selected === id) setSelected(null);
    refresh();
  }

  const visible = filter ? entries.filter((e) => e.category === filter) : entries;
  const grouped = new Map<string, LoreEntry[]>();
  for (const e of visible) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push(e);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {LORE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Aliase (Komma-getrennt)" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <button onClick={save}>{selected ? "Aktualisieren" : "+ Eintrag"}</button>
      </div>
      <textarea rows={2} placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: 8 }} />
      <textarea rows={2} placeholder="Notizen" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 10 }} />

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button className={filter === "" ? "active" : ""} onClick={() => setFilter("")}>Alle ({entries.length})</button>
        {LORE_CATEGORIES.map((c) => (
          <button key={c} className={filter === c ? "active" : ""} onClick={() => setFilter(c)}>
            {c} ({entries.filter((e) => e.category === c).length})
          </button>
        ))}
      </div>

      {[...grouped.entries()].map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "4px 0" }}>{cat}</h4>
          <ul>
            {list.map((e) => (
              <li key={e.id} style={{ cursor: "pointer" }} onClick={() => select(e)}>
                <strong>{e.name}</strong>
                {e.aliases.length ? <em> (auch: {e.aliases.join(", ")})</em> : null}
                {e.description ? ` — ${e.description.slice(0, 80)}` : ""}{" "}
                <button onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>🗑</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!visible.length && <p><em>Keine Einträge.</em></p>}
    </div>
  );
}
