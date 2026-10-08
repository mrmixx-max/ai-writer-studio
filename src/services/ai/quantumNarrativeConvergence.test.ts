// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SYNC_GRID_SIZE,
  createSyncGrid,
  generateHandoffSequence,
  checkCausality,
  createSampleSyncGrid,
  createSampleHandoff,
  type CharacterState,
  type TimelineEvent,
} from "./quantumNarrativeConvergence";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("")).toBe(hashString(""));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("Lyra")).not.toBe(hashString("Bram"));
  });

  it("liefert einen unsigned 32-bit Ganzzahl-Hash", () => {
    const h = hashString("Showdown");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) expect(r1()).toBe(r2());
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("SYNC_GRID_SIZE", () => {
  it("ist 8", () => {
    expect(SYNC_GRID_SIZE).toBe(8);
  });
});

describe("createSyncGrid", () => {
  it("liefert grid-, conflicts- und warnings-Arrays", () => {
    const result = createSyncGrid(createSampleSyncGrid());
    expect(Array.isArray(result.grid)).toBe(true);
    expect(Array.isArray(result.conflicts)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("sortiert das Raster deterministisch nach y, dann x", () => {
    const chars: CharacterState[] = [
      { id: "a", name: "A", role: "R", position: { x: 5, y: 10 }, goal: "g", tension: 0.5 },
      { id: "b", name: "B", role: "R", position: { x: 5, y: 2 }, goal: "g", tension: 0.5 },
      { id: "c", name: "C", role: "R", position: { x: 1, y: 2 }, goal: "g", tension: 0.5 },
    ];
    const { grid } = createSyncGrid(chars);
    expect(grid.map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("meldet doppelte Strang-IDs als Konflikt", () => {
    const chars: CharacterState[] = [
      { id: "x", name: "X", role: "R", position: { x: 1, y: 1 }, goal: "g", tension: 0.5 },
      { id: "x", name: "X2", role: "R", position: { x: 9, y: 9 }, goal: "g", tension: 0.5 },
    ];
    const { conflicts } = createSyncGrid(chars);
    expect(conflicts.some((c) => c.includes("Doppelte Strang-ID"))).toBe(true);
  });

  it("meldet Position-Kollisionen als Konflikt", () => {
    const chars: CharacterState[] = [
      { id: "x", name: "X", role: "R", position: { x: 3, y: 3 }, goal: "g", tension: 0.5 },
      { id: "y", name: "Y", role: "R", position: { x: 3, y: 3 }, goal: "g", tension: 0.5 },
    ];
    const { conflicts } = createSyncGrid(chars);
    expect(conflicts.some((c) => c.includes("Position-Kollision"))).toBe(true);
  });

  it("warnt bei Spannung außerhalb von 0–1", () => {
    const chars: CharacterState[] = [
      { id: "x", name: "X", role: "R", position: { x: 1, y: 1 }, goal: "g", tension: 1.5 },
    ];
    const { warnings } = createSyncGrid(chars);
    expect(warnings.some((w) => w.includes("Spannung"))).toBe(true);
  });

  it("warnt bei fehlendem Ziel oder fehlender Rolle", () => {
    const chars: CharacterState[] = [
      { id: "x", name: "X", role: "", position: { x: 1, y: 1 }, goal: "", tension: 0.5 },
    ];
    const { warnings } = createSyncGrid(chars);
    expect(warnings.some((w) => w.includes("kein Ziel"))).toBe(true);
    expect(warnings.some((w) => w.includes("keine Rolle"))).toBe(true);
  });

  it("liefert bei ungültiger Eingabe ein leeres Raster", () => {
    const result = createSyncGrid(undefined as unknown as CharacterState[]);
    expect(result.grid).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("generateHandoffSequence", () => {
  const chars = createSampleSyncGrid();

  it("liefert sequence- und transitions-Arrays", () => {
    const result = generateHandoffSequence(chars, 1);
    expect(Array.isArray(result.sequence)).toBe(true);
    expect(Array.isArray(result.transitions)).toBe(true);
  });

  it("erzeugt Übergänge mit from/to/cue", () => {
    const { transitions } = generateHandoffSequence(chars, 123);
    expect(transitions.length).toBe(chars.length - 1);
    for (const t of transitions) {
      expect(typeof t.from).toBe("string");
      expect(typeof t.to).toBe("string");
      expect(typeof t.cue).toBe("string");
      expect(t.cue.length).toBeGreaterThan(0);
    }
  });

  it("verknüpft aufeinanderfolgende Stränge in den Übergängen", () => {
    const { transitions } = generateHandoffSequence(chars, 123);
    for (let i = 0; i < transitions.length; i++) {
      expect(transitions[i].from).toBe(chars[i].id);
      expect(transitions[i].to).toBe(chars[i + 1].id);
    }
  });

  it("ist deterministisch für gleichen Seed und gleiche Stränge", () => {
    const a = generateHandoffSequence(chars, 99);
    const b = generateHandoffSequence(chars, 99);
    expect(a).toEqual(b);
  });

  it("liefert bei weniger als zwei Strängen eine leere Kette", () => {
    const result = generateHandoffSequence([chars[0]], 1);
    expect(result.sequence).toEqual([]);
    expect(result.transitions).toEqual([]);
  });
});

describe("checkCausality", () => {
  const chars = createSampleSyncGrid();

  it("liefert violations-, warnings- und anomalies-Arrays", () => {
    const timeline: TimelineEvent[] = [{ characterId: "s1", action: "greift an", timestamp: 1 }];
    const result = checkCausality(chars, timeline);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.anomalies)).toBe(true);
  });

  it("meldet unbekannte Figur als Verstoß", () => {
    const timeline: TimelineEvent[] = [{ characterId: "ghost", action: "handelt", timestamp: 1 }];
    const { violations } = checkCausality(chars, timeline);
    expect(violations.some((v) => v.includes("Unbekannte Figur"))).toBe(true);
  });

  it("meldet widersprüchliche Handlungen zum selben Zeitstempel", () => {
    const timeline: TimelineEvent[] = [
      { characterId: "s1", action: "greift an", timestamp: 5 },
      { characterId: "s1", action: "flieht", timestamp: 5 },
    ];
    const { violations } = checkCausality(chars, timeline);
    expect(violations.some((v) => v.includes("Widersprüchliche Handlungen"))).toBe(true);
  });

  it("meldet Rückwärts-Sprünge als Zeit-Anomalie", () => {
    const timeline: TimelineEvent[] = [
      { characterId: "s1", action: "startet", timestamp: 10 },
      { characterId: "s1", action: "endet", timestamp: 3 },
    ];
    const { anomalies } = checkCausality(chars, timeline);
    expect(anomalies.some((a) => a.includes("Zeit-Anomalie"))).toBe(true);
  });

  it("meldet negative Zeitstempel als Anomalie", () => {
    const timeline: TimelineEvent[] = [{ characterId: "s1", action: "handelt", timestamp: -1 }];
    const { anomalies } = checkCausality(chars, timeline);
    expect(anomalies.some((a) => a.includes("Negativer Zeitstempel"))).toBe(true);
  });

  it("warnt bei leerer Zeitleiste", () => {
    const { warnings } = checkCausality(chars, []);
    expect(warnings.some((w) => w.includes("Keine Zeitleisten-Ereignisse"))).toBe(true);
  });

  it("liefert bei ungültiger Eingabe leere Ergebnisse", () => {
    const result = checkCausality(undefined as unknown as CharacterState[], undefined as unknown as TimelineEvent[]);
    expect(result.violations).toEqual([]);
    expect(result.anomalies).toEqual([]);
  });
});

describe("createSampleSyncGrid", () => {
  it("liefert SYNC_GRID_SIZE gültige Stränge", () => {
    const grid = createSampleSyncGrid();
    expect(grid.length).toBe(SYNC_GRID_SIZE);
    for (const c of grid) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.position.x).toBe("number");
      expect(typeof c.position.y).toBe("number");
      expect(c.tension).toBeGreaterThanOrEqual(0);
      expect(c.tension).toBeLessThanOrEqual(1);
    }
  });

  it("ist deterministisch", () => {
    expect(createSampleSyncGrid()).toEqual(createSampleSyncGrid());
  });
});

describe("createSampleHandoff", () => {
  it("liefert eine gültige Übergabe-Sequenz", () => {
    const handoff = createSampleHandoff();
    expect(Array.isArray(handoff.sequence)).toBe(true);
    expect(Array.isArray(handoff.transitions)).toBe(true);
    expect(handoff.sequence.length).toBeGreaterThan(0);
    expect(handoff.transitions.length).toBe(SYNC_GRID_SIZE - 1);
    for (const t of handoff.transitions) {
      expect(typeof t.from).toBe("string");
      expect(typeof t.to).toBe("string");
      expect(t.cue.length).toBeGreaterThan(0);
    }
  });

  it("ist deterministisch", () => {
    expect(createSampleHandoff()).toEqual(createSampleHandoff());
  });
});
