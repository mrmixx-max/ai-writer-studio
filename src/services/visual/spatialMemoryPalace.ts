// SpatialMemoryPalace (WP 82.1)
//
// 3D-Spatial-Mind-Palace & Gedächtnispalast: thematische Räume,
// Artefakt-Sockel und Rundgang-Modus für Mystery- und Epen-Stoffe.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein Artefakt im Palast. */
export interface PalaceArtifact {
  id: string;
  name: string;
  type: "clue" | "weapon" | "letter" | "portrait" | "key";
  x: number;
  y: number;
  z: number;
  label: string;
  linkedArtifactIds: string[];
}

/** Ein Raum im Palast. */
export interface PalaceRoom {
  id: string;
  name: string;
  description: string;
  artifacts: PalaceArtifact[];
  unresolvedContradictions: string[];
}

/** Der Gedächtnispalast. */
export interface MemoryPalace {
  name: string;
  rooms: PalaceRoom[];
  totalArtifacts: number;
}

/** Erstellt einen leeren Palast. */
export function createEmptyPalace(name: string): MemoryPalace {
  return { name, rooms: [], totalArtifacts: 0 };
}

/** Fügt einen Raum hinzu. */
export function addRoom(palace: MemoryPalace, room: PalaceRoom): MemoryPalace {
  const rooms = [...palace.rooms, room];
  const totalArtifacts = rooms.reduce((sum, r) => sum + r.artifacts.length, 0);
  return { ...palace, rooms, totalArtifacts };
}

/** Fügt ein Artefakt zu einem Raum hinzu. */
export function addArtifact(palace: MemoryPalace, roomId: string, artifact: PalaceArtifact): MemoryPalace {
  const rooms = palace.rooms.map((r) =>
    r.id === roomId ? { ...r, artifacts: [...r.artifacts, artifact] } : r,
  );
  const totalArtifacts = rooms.reduce((sum, r) => sum + r.artifacts.length, 0);
  return { ...palace, rooms, totalArtifacts };
}

/** Findet alle ungelösten Widersprüche im Palast. */
export function findUnresolvedContradictions(palace: MemoryPalace): string[] {
  const contradictions: string[] = [];
  for (const room of palace.rooms) {
    contradictions.push(...room.unresolvedContradictions);
  }
  return contradictions;
}

/** Findet alle Artefakte eines bestimmten Typs. */
export function getArtifactsByType(palace: MemoryPalace, type: PalaceArtifact["type"]): PalaceArtifact[] {
  const artifacts: PalaceArtifact[] = [];
  for (const room of palace.rooms) {
    for (const artifact of room.artifacts) {
      if (artifact.type === type) {
        artifacts.push(artifact);
      }
    }
  }
  return artifacts;
}

/** Verknüpft zwei Artefakte. */
export function linkArtifacts(palace: MemoryPalace, roomId: string, artifactId1: string, artifactId2: string): MemoryPalace {
  const rooms = palace.rooms.map((r) => {
    if (r.id !== roomId) return r;
    const artifacts = r.artifacts.map((a) => {
      if (a.id === artifactId1) {
        return { ...a, linkedArtifactIds: [...a.linkedArtifactIds, artifactId2] };
      }
      if (a.id === artifactId2) {
        return { ...a, linkedArtifactIds: [...a.linkedArtifactIds, artifactId1] };
      }
      return a;
    });
    return { ...r, artifacts };
  });
  return { ...palace, rooms, totalArtifacts: rooms.reduce((sum, r) => sum + r.artifacts.length, 0) };
}

/** Erstellt einen Beispiel-Palast. */
export function createSamplePalace(): MemoryPalace {
  let palace = createEmptyPalace("Palast der Geheimnisse");

  palace = addRoom(palace, {
    id: "room-1",
    name: "Kabinett der Geheimnisse",
    description: "Ein dunkles Raum mit Regalen voller Akten.",
    artifacts: [
      { id: "art-1", name: "Brief des Verrats", type: "letter", x: 1, y: 0, z: 2, label: "Brief", linkedArtifactIds: [] },
      { id: "art-2", name: "Tatwerkzeug", type: "weapon", x: 3, y: 0, z: 1, label: "Werkzeug", linkedArtifactIds: [] },
    ],
    unresolvedContradictions: ["Brief und Werkzeug passen nicht zusammen"],
  });

  palace = addRoom(palace, {
    id: "room-2",
    name: "Archiv der Morde",
    description: "Ein kalter Raum mit Karten und Fotos.",
    artifacts: [
      { id: "art-3", name: "Karte des Tatorts", type: "clue", x: 2, y: 0, z: 3, label: "Karte", linkedArtifactIds: [] },
    ],
    unresolvedContradictions: [],
  });

  palace = linkArtifacts(palace, "room-1", "art-1", "art-2");

  return palace;
}

/** Formatiert den Palast als Text. */
export function formatPalace(palace: MemoryPalace): string {
  const lines: string[] = [];
  lines.push(`=== GEDÄCHTNISPALAST: ${palace.name} ===`);
  lines.push(`Räume: ${palace.rooms.length}`);
  lines.push(`Artefakte: ${palace.totalArtifacts}`);
  lines.push("");
  for (const room of palace.rooms) {
    lines.push(`  ${room.name}: ${room.description}`);
    for (const artifact of room.artifacts) {
      lines.push(`    ${artifact.name} (${artifact.type}) bei (${artifact.x}, ${artifact.y}, ${artifact.z})`);
    }
    if (room.unresolvedContradictions.length > 0) {
      lines.push(`    Ungelöste Widersprüche: ${room.unresolvedContradictions.join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
