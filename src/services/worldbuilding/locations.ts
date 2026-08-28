// Orte-Service: Locations mit Koordinaten für Karten-Export.
import { getDb, persist } from "@/services/db";

export interface Location {
  id: string;
  projectId: string;
  name: string;
  description: string;
  x: number; // Karten-Koordinate (0-1000)
  y: number;
  type: string; // z.B. "Stadt", "Dorf", "Landschaft", "Gebäude"
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const COLS = "id, project_id, name, description, x, y, type, notes, created_at, updated_at";

function rowToLocation(v: unknown[]): Location {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    name: (v[2] as string) || "",
    description: (v[3] as string) || "",
    x: Number(v[4]) || 0,
    y: Number(v[5]) || 0,
    type: (v[6] as string) || "",
    notes: (v[7] as string) || "",
    createdAt: Number(v[8]),
    updatedAt: Number(v[9]),
  };
}

function uid(): string {
  return "loc_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Alle Orte eines Projekts (alphabetisch). */
export function listLocations(projectId: string): Location[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM locations WHERE project_id = ? ORDER BY name`, [projectId],
  );
  return res.length ? res[0].values.map(rowToLocation) : [];
}

/** Einen Ort laden. */
export function getLocation(id: string): Location | null {
  const res = getDb().exec(`SELECT ${COLS} FROM locations WHERE id = ?`, [id]);
  return res.length ? rowToLocation(res[0].values[0]) : null;
}

/** Ort anlegen oder aktualisieren. */
export async function saveLocation(
  loc: Omit<Location, "createdAt" | "updatedAt">,
): Promise<Location> {
  const now = Date.now();
  const existing = getLocation(loc.id);
  const record: Location = { ...loc, createdAt: existing?.createdAt ?? now, updatedAt: now };
  getDb().exec(
    `INSERT OR REPLACE INTO locations (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [record.id, record.projectId, record.name, record.description,
      record.x, record.y, record.type, record.notes,
      record.createdAt, record.updatedAt],
  );
  await persist();
  return record;
}

/** Neuen Ort anlegen. */
export async function createLocation(
  projectId: string,
  data: Pick<Location, "name"> & Partial<Omit<Location, "name" | "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<Location> {
  return saveLocation({
    id: uid(), projectId,
    name: data.name.trim(),
    description: data.description ?? "",
    x: data.x ?? 500, y: data.y ?? 500,
    type: data.type ?? "", notes: data.notes ?? "",
  });
}

/** Ort löschen. */
export async function deleteLocation(id: string): Promise<void> {
  getDb().run("DELETE FROM locations WHERE id = ?", [id]);
  await persist();
}

/** Orte umbenennen: liefert alle Orte, deren Name eine Fundstelle in text hat. */
export function findLocationMentions(
  locations: Location[], text: string,
): { location: Location; count: number }[] {
  const results: { location: Location; count: number }[] = [];
  for (const loc of locations) {
    if (!loc.name.trim()) continue;
    const re = new RegExp(`\\b${loc.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = text.match(re);
    if (matches?.length) results.push({ location: loc, count: matches.length });
  }
  return results.sort((a, b) => b.count - a.count);
}
