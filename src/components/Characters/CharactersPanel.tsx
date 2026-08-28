// Figuren-Panel: CRUD, Beziehungsgraph, Beziehungs-Editor, Export (JSON/CSV/MD).
import { useEffect, useState } from "react";
import {
  listCharacters, saveCharacter, deleteCharacter, type Character,
} from "@/services/characters/characters";
import {
  listRelationships, saveRelationship, deleteRelationship, type CharacterRelationship,
} from "@/services/characters/relationships";
import {
  buildCharacterBundle, charactersToJson, charactersToCsv, charactersToMarkdown, downloadData,
} from "@/services/characters/characterExport";
import { RelationshipGraph } from "./RelationshipGraph";

const REL_TYPES = ["Freundschaft", "Feindschaft", "Familie", "Liebe", "Mentor", "Rivale", "Verbündet", "Verrat"];

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function CharactersPanel({ projectId }: { projectId: string }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");
  const [traits, setTraits] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relType, setRelType] = useState(REL_TYPES[0]);
  const [relDesc, setRelDesc] = useState("");

  useEffect(() => { refresh(); }, [projectId]);

  function refresh() {
    setCharacters(listCharacters(projectId));
    setRelationships(listRelationships(projectId));
  }

  async function addCharacter() {
    if (!name.trim()) return;
    await saveCharacter({
      id: uid("char"), projectId, name: name.trim(), aliases: [],
      age, role, traits, notes: "",
    });
    setName(""); setAge(""); setRole(""); setTraits("");
    refresh();
  }

  async function removeCharacter(id: string) {
    if (!confirm("Figur löschen?")) return;
    await deleteCharacter(id);
    if (selected === id) setSelected(null);
    // Hängende Beziehungen aufräumen.
    for (const rel of relationships.filter((r) => r.fromCharId === id || r.toCharId === id)) {
      await deleteRelationship(rel.id);
    }
    refresh();
  }

  async function addRelationship() {
    if (!selected || !relTo || relTo === selected) return;
    await saveRelationship({
      id: uid("rel"), projectId, fromCharId: selected, toCharId: relTo,
      relType, description: relDesc,
    });
    setRelDesc("");
    refresh();
  }

  function doExport(format: "json" | "csv" | "md") {
    const bundle = buildCharacterBundle(projectId, characters, relationships);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") downloadData(charactersToJson(bundle), `characters-${stamp}.json`, "application/json");
    else if (format === "csv") downloadData(charactersToCsv(bundle), `characters-${stamp}.csv`, "text/csv");
    else downloadData(charactersToMarkdown(bundle), `characters-${stamp}.md`, "text/markdown");
  }

  const selChar = characters.find((c) => c.id === selected) ?? null;
  const others = characters.filter((c) => c.id !== selected);

  return (
    <div className="characters-panel">
      <h3>Figuren ({characters.length})</h3>

      <RelationshipGraph
        characters={characters}
        relationships={relationships}
        selectedId={selected}
        onSelect={setSelected}
      />

      {selChar && (
        <div className="character-detail">
          <strong>{selChar.name}</strong>
          {selChar.role && <span> — {selChar.role}</span>}
          {selChar.age && <span> ({selChar.age})</span>}
          {selChar.traits && <p>{selChar.traits}</p>}
          <button onClick={() => removeCharacter(selChar.id)}>🗑 Löschen</button>
        </div>
      )}

      <div className="character-form">
        <h4>Figur anlegen</h4>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name…" />
        <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Alter" style={{ maxWidth: 80 }} />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rolle…" />
        <input value={traits} onChange={(e) => setTraits(e.target.value)} placeholder="Merkmale…" />
        <button onClick={addCharacter} disabled={!name.trim()}>Hinzufügen</button>
      </div>

      {selChar && others.length > 0 && (
        <div className="relationship-form">
          <h4>Beziehung: {selChar.name} → …</h4>
          <select value={relTo} onChange={(e) => setRelTo(e.target.value)}>
            <option value="">Zielfigur…</option>
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={relType} onChange={(e) => setRelType(e.target.value)}>
            {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={relDesc} onChange={(e) => setRelDesc(e.target.value)} placeholder="Beschreibung…" />
          <button onClick={addRelationship} disabled={!relTo}>Verknüpfen</button>
          {relationships
            .filter((r) => r.fromCharId === selChar.id || r.toCharId === selChar.id)
            .map((r) => {
              const other = characters.find((c) => c.id === (r.fromCharId === selChar.id ? r.toCharId : r.fromCharId));
              return (
                <div key={r.id} className="relationship-row">
                  <span>
                    {r.fromCharId === selChar.id ? "→" : "←"} {other?.name ?? "?"}
                    {r.relType ? ` (${r.relType})` : ""}{r.description ? `: ${r.description}` : ""}
                  </span>
                  <button onClick={async () => { await deleteRelationship(r.id); refresh(); }}>✕</button>
                </div>
              );
            })}
        </div>
      )}

      <div className="character-export">
        <h4>Export</h4>
        <button onClick={() => doExport("json")}>JSON</button>
        <button onClick={() => doExport("csv")}>CSV</button>
        <button onClick={() => doExport("md")}>Markdown</button>
      </div>
    </div>
  );
}
