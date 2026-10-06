/**
 * Tests: SpatialMemoryPalace (WP 82.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createEmptyPalace,
  addRoom,
  addArtifact,
  findUnresolvedContradictions,
  getArtifactsByType,
  linkArtifacts,
  createSamplePalace,
  formatPalace,
  type PalaceRoom,
  type PalaceArtifact,
} from "./spatialMemoryPalace";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("createEmptyPalace", () => {
  it("erstellt leeren Palast", () => {
    const palace = createEmptyPalace("Test");
    expect(palace.name).toBe("Test");
    expect(palace.rooms).toEqual([]);
    expect(palace.totalArtifacts).toBe(0);
  });
});

describe("addRoom", () => {
  it("fügt Raum hinzu", () => {
    const palace = createEmptyPalace("Test");
    const room: PalaceRoom = {
      id: "r1",
      name: "Raum",
      description: "Beschreibung",
      artifacts: [],
      unresolvedContradictions: [],
    };
    const updated = addRoom(palace, room);
    expect(updated.rooms).toHaveLength(1);
  });
});

describe("addArtifact", () => {
  it("fügt Artefakt hinzu", () => {
    let palace = createEmptyPalace("Test");
    palace = addRoom(palace, {
      id: "r1",
      name: "Raum",
      description: "Beschreibung",
      artifacts: [],
      unresolvedContradictions: [],
    });
    const artifact: PalaceArtifact = {
      id: "a1",
      name: "Artefakt",
      type: "clue",
      x: 1,
      y: 0,
      z: 2,
      label: "Label",
      linkedArtifactIds: [],
    };
    const updated = addArtifact(palace, "r1", artifact);
    expect(updated.totalArtifacts).toBe(1);
  });
});

describe("findUnresolvedContradictions", () => {
  it("findet Widersprüche", () => {
    const palace = createSamplePalace();
    const contradictions = findUnresolvedContradictions(palace);
    expect(contradictions.length).toBeGreaterThan(0);
  });
});

describe("getArtifactsByType", () => {
  it("filtert Artefakte nach Typ", () => {
    const palace = createSamplePalace();
    const clues = getArtifactsByType(palace, "clue");
    expect(clues.length).toBeGreaterThan(0);
  });
});

describe("linkArtifacts", () => {
  it("verknüpft Artefakte", () => {
    let palace = createEmptyPalace("Test");
    palace = addRoom(palace, {
      id: "r1",
      name: "Raum",
      description: "Beschreibung",
      artifacts: [
        { id: "a1", name: "A", type: "clue", x: 0, y: 0, z: 0, label: "", linkedArtifactIds: [] },
        { id: "a2", name: "B", type: "clue", x: 1, y: 0, z: 0, label: "", linkedArtifactIds: [] },
      ],
      unresolvedContradictions: [],
    });
    const updated = linkArtifacts(palace, "r1", "a1", "a2");
    const room = updated.rooms[0];
    expect(room.artifacts[0].linkedArtifactIds).toContain("a2");
    expect(room.artifacts[1].linkedArtifactIds).toContain("a1");
  });
});

describe("createSamplePalace", () => {
  it("erstellt Beispiel-Palast", () => {
    const palace = createSamplePalace();
    expect(palace.rooms.length).toBeGreaterThan(0);
    expect(palace.totalArtifacts).toBeGreaterThan(0);
  });
});

describe("formatPalace", () => {
  it("formatiert Palast als Text", () => {
    const palace = createSamplePalace();
    const text = formatPalace(palace);
    expect(text).toContain("GEDÄCHTNISPALAST");
  });
});
