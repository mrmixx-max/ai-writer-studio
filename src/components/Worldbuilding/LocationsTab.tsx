// Orte-Tab: CRUD mit Koordinaten, SVG-Kartenvorschau + Karten-Export.
import { useEffect, useState } from "react";
import {
  listLocations, createLocation, saveLocation, deleteLocation, type Location,
} from "@/services/worldbuilding/locations";
import { locationsToSvg, downloadWorldbuildingFile } from "@/services/worldbuilding/worldbuildingExport";

const LOC_TYPES = ["Stadt", "Dorf", "Landschaft", "Gebäude", "Ruine", "Sonstiges"];

export function LocationsTab({ projectId }: { projectId: string }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState(LOC_TYPES[0]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [x, setX] = useState("500");
  const [y, setY] = useState("500");
  const [showMap, setShowMap] = useState(true);

  useEffect(() => { refresh(); setSelected(null); }, [projectId]);
  function refresh() { setLocations(listLocations(projectId)); }

  function select(loc: Location) {
    setSelected(loc.id);
    setName(loc.name); setType(loc.type || LOC_TYPES[0]);
    setDescription(loc.description); setNotes(loc.notes);
    setX(String(Math.round(loc.x))); setY(String(Math.round(loc.y)));
  }

  async function save() {
    if (!name.trim()) return;
    if (selected) {
      await saveLocation({
        ...locations.find((l) => l.id === selected)!, projectId,
        name: name.trim(), type, description, notes,
        x: Number(x) || 0, y: Number(y) || 0,
      });
    } else {
      await createLocation(projectId, {
        name, type, description, notes, x: Number(x) || 0, y: Number(y) || 0,
      });
    }
    setName(""); setDescription(""); setNotes(""); setX("500"); setY("500");
    setSelected(null);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Ort löschen?")) return;
    await deleteLocation(id);
    if (selected === id) setSelected(null);
    refresh();
  }

  function onMapClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const wy = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
    setX(String(wx)); setY(String(wy));
  }

  function exportSvg() {
    downloadWorldbuildingFile(
      locationsToSvg(listLocations(projectId), { title: "Projektkarte" }),
      "karte.svg", "image/svg+xml",
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input placeholder="Ortsname" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {LOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input title="X-Koordinate (0-1000)" style={{ width: 70 }} value={x} onChange={(e) => setX(e.target.value)} />
        <input title="Y-Koordinate (0-1000)" style={{ width: 70 }} value={y} onChange={(e) => setY(e.target.value)} />
        <button onClick={save}>{selected ? "Aktualisieren" : "+ Ort"}</button>
        <button onClick={() => setShowMap((s) => !s)}>{showMap ? "Karte ausblenden" : "Karte zeigen"}</button>
        <button onClick={exportSvg}>⬇ SVG</button>
      </div>

      <textarea rows={2} placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
      <textarea rows={2} placeholder="Notizen" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 10 }} />

      {showMap && (
        <svg
          viewBox="0 0 1000 1000" style={{ width: "100%", background: "#1a2332", border: "1px solid #334", cursor: "crosshair", marginBottom: 10 }}
          onClick={onMapClick}
        >
          <text x="10" y="25" fill="#e2e8f0" fontSize="18">Karte — Klick setzt Koordinaten</text>
          {locations.map((l) => {
            const colors: Record<string, string> = {
              Stadt: "#f59e0b", Dorf: "#84cc16", Landschaft: "#22c55e",
              Gebäude: "#60a5fa", Ruine: "#a78bfa", Sonstiges: "#94a3b8",
            };
            return (
              <g key={l.id} onClick={(e) => { e.stopPropagation(); select(l); }} style={{ cursor: "pointer" }}>
                <circle cx={l.x} cy={l.y} r={selected === l.id ? 14 : 9}
                  fill={colors[l.type] ?? "#94a3b8"} stroke={selected === l.id ? "#fff" : "#0f172a"} strokeWidth={2} />
                <text x={l.x + 13} y={l.y + 4} fill="#e2e8f0" fontSize={16}>{l.name}</text>
              </g>
            );
          })}
        </svg>
      )}

      <ul>
        {locations.map((l) => (
          <li key={l.id} style={{ cursor: "pointer" }} onClick={() => select(l)}>
            <strong>{l.name}</strong>{l.type ? ` (${l.type})` : ""} — [{Math.round(l.x)}, {Math.round(l.y)}]
            {l.description ? ` — ${l.description.slice(0, 60)}` : ""}{" "}
            <button onClick={(e) => { e.stopPropagation(); remove(l.id); }}>🗑</button>
          </li>
        ))}
        {!locations.length && <li><em>Noch keine Orte angelegt.</em></li>}
      </ul>
    </div>
  );
}
