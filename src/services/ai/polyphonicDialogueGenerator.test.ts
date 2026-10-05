/**
 * Tests: polyphonicDialogueGenerator (WP 54.2 — Polyphoner Dialog-Generator)
 */

import { describe, it, expect } from "vitest";
import {
  generateDialogue,
  detectSubtext,
  analyzePolyphony,
  type DialogueCharacter,
} from "./polyphonicDialogueGenerator";

const CAST: DialogueCharacter[] = [
  {
    name: "Detective",
    role: "Ermittler",
    pattern: { formality: 0.2, tempo: 0.3, slang: 0.3 },
    intent: "sucht ein Geständnis",
  },
  {
    name: "Verdächtige",
    role: "Zeugin",
    pattern: { formality: 0.8, tempo: 0.5, slang: 0.1 },
    intent: "blufft und lenkt den Verdacht",
  },
  {
    name: "Wirt",
    role: "Zeuge",
    pattern: { formality: 0.4, tempo: 0.7, slang: 0.6 },
  },
];

describe("polyphonicDialogueGenerator — generateDialogue", () => {
  it("erzeugt die gewünschte Anzahl Beiträge", () => {
    const r = generateDialogue(CAST, { turns: 9 });
    expect(r.turnCount).toBe(9);
  });

  it("wechselt die Sprecher reihum", () => {
    const r = generateDialogue(CAST, { turns: 6 });
    expect(r.turns[0].speaker).toBe("Detective");
    expect(r.turns[1].speaker).toBe("Verdächtige");
    expect(r.turns[2].speaker).toBe("Wirt");
    expect(r.turns[3].speaker).toBe("Detective");
  });

  it("listet alle beteiligten Figuren", () => {
    const r = generateDialogue(CAST);
    expect(r.characters).toEqual(["Detective", "Verdächtige", "Wirt"]);
  });

  it("ist deterministisch", () => {
    const a = generateDialogue(CAST, { turns: 8 });
    const b = generateDialogue(CAST, { turns: 8 });
    expect(a.script).toBe(b.script);
  });

  it("erzeugt einen formatierten Drehbuch-Text", () => {
    const r = generateDialogue(CAST, { turns: 4 });
    expect(r.script).toContain("DETECTIVE:");
    expect(r.script.length).toBeGreaterThan(20);
  });

  it("baut Körpersprache-Aktionen ein", () => {
    const r = generateDialogue(CAST, { turns: 12 });
    expect(r.actionCount).toBeGreaterThan(0);
    expect(r.script).toMatch(/\(.*\.\)/);
  });

  it("kann Aktionen abschalten", () => {
    const r = generateDialogue(CAST, { turns: 10, includeActions: false });
    expect(r.actionCount).toBe(0);
    expect(r.script).not.toMatch(/\(.*\.\)/);
  });

  it("nummeriert die Beiträge fortlaufend", () => {
    const r = generateDialogue(CAST, { turns: 5 });
    expect(r.turns.map((t) => t.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it("berücksichtigt die Konflikt-Vorgabe", () => {
    const r = generateDialogue(CAST, { turns: 6, conflict: "ein Alibi prüfen" });
    expect(r.script).toContain("Alibi");
  });

  it("verwendet die Absicht der Figur", () => {
    const r = generateDialogue([CAST[0], CAST[1]], { turns: 4 });
    expect(r.script).toContain("Geständnis");
  });

  it("begrenzt auf maximal 4 Figuren", () => {
    const many: DialogueCharacter[] = [
      { name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" },
    ];
    const r = generateDialogue(many, { turns: 8 });
    expect(r.characters.length).toBe(4);
    expect(r.characters).not.toContain("E");
  });

  it("verlangt mindestens 2 Figuren", () => {
    const r = generateDialogue([{ name: "Solo" }], { turns: 6 });
    expect(r.turns).toEqual([]);
    expect(r.script).toBe("");
  });

  it("begrenzt die Beitragszahl auf 4–24", () => {
    expect(generateDialogue(CAST, { turns: 1 }).turnCount).toBe(4);
    expect(generateDialogue(CAST, { turns: 999 }).turnCount).toBe(24);
  });

  it("mutiert die Figuren-Liste nicht", () => {
    const input = JSON.parse(JSON.stringify(CAST));
    generateDialogue(CAST, { turns: 6 });
    expect(CAST).toEqual(input);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(generateDialogue(null).turns).toEqual([]);
    expect(generateDialogue(undefined).script).toBe("");
    expect(generateDialogue("kein Array").turnCount).toBe(0);
    expect(generateDialogue([{ name: "" }, { name: "  " }]).turnCount).toBe(0);
  });

  it("erkennt Subtext in erzeugten Zeilen", () => {
    const r = generateDialogue(CAST, { turns: 16 });
    expect(r.turns.some((t) => t.subtext !== undefined)).toBe(true);
  });
});

describe("polyphonicDialogueGenerator — detectSubtext", () => {
  it("erkennt Ausweichen", () => {
    const r = detectSubtext([{ speaker: "A", text: "Warum sollte ich das wissen?", index: 1 }]);
    expect(r[0].intent).toBe("Ausweichen");
  });

  it("erkennt Bluffen", () => {
    const r = detectSubtext([{ speaker: "A", text: "Natürlich war ich das.", index: 1 }]);
    expect(r[0].intent).toBe("Bluffen");
  });

  it("liefert die Signalwörter mit", () => {
    const r = detectSubtext([{ speaker: "A", text: "Das ist merkwürdig.", index: 1 }]);
    expect(r[0].signals.length).toBeGreaterThan(0);
  });

  it("untersucht mehrere Beiträge", () => {
    const r = detectSubtext([
      { speaker: "A", text: "Natürlich.", index: 1 },
      { speaker: "B", text: "Das ist merkwürdig.", index: 2 },
    ]);
    expect(r.length).toBe(2);
  });

  it("nimmt auch reine Strings", () => {
    const r = detectSubtext(["Warum sollte ich das wissen?"]);
    expect(r.length).toBe(1);
  });

  it("findet nichts in neutralem Text", () => {
    const r = detectSubtext([{ speaker: "A", text: "Der Regen fällt.", index: 1 }]);
    expect(r).toEqual([]);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(detectSubtext([])).toEqual([]);
    expect(detectSubtext(null)).toEqual([]);
    expect(detectSubtext(undefined)).toEqual([]);
  });
});

describe("polyphonicDialogueGenerator — analyzePolyphony", () => {
  it("berechnet Sprechanteile", () => {
    const r = generateDialogue(CAST, { turns: 9 });
    const analysis = analyzePolyphony(r.turns);
    expect(analysis.characterCount).toBe(3);
    expect(analysis.shares.length).toBe(3);
  });

  it("Anteile summieren sich auf 1", () => {
    const r = generateDialogue(CAST, { turns: 12 });
    const analysis = analyzePolyphony(r.turns);
    const sum = analysis.shares.reduce((s, x) => s + x.share, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.01);
  });

  it("sortiert absteigend nach Beiträgen", () => {
    const r = generateDialogue(CAST, { turns: 11 });
    const analysis = analyzePolyphony(r.turns);
    for (let i = 1; i < analysis.shares.length; i++) {
      expect(analysis.shares[i - 1].turns).toBeGreaterThanOrEqual(analysis.shares[i].turns);
    }
  });

  it("rhythmIndex ist 1 bei perfekter Gleichverteilung", () => {
    const even = [
      { speaker: "A", text: "x", index: 1 },
      { speaker: "B", text: "x", index: 2 },
      { speaker: "A", text: "x", index: 3 },
      { speaker: "B", text: "x", index: 4 },
    ];
    expect(analyzePolyphony(even).rhythmIndex).toBe(1);
  });

  it("rhythmIndex sinkt bei ungleicher Verteilung", () => {
    const uneven = [
      { speaker: "A", text: "x", index: 1 },
      { speaker: "A", text: "x", index: 2 },
      { speaker: "A", text: "x", index: 3 },
      { speaker: "B", text: "x", index: 4 },
    ];
    expect(analyzePolyphony(uneven).rhythmIndex).toBeLessThan(1);
  });

  it("berechnet die mittlere Beitragslänge", () => {
    const r = analyzePolyphony([
      { speaker: "A", text: "eins zwei drei", index: 1 },
      { speaker: "B", text: "vier fünf sechs sieben fünf", index: 2 },
    ]);
    expect(r.avgTurnLength).toBe(4);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzePolyphony([]);
    expect(r.shares).toEqual([]);
    expect(r.characterCount).toBe(0);
    expect(r.rhythmIndex).toBe(0);
    expect(analyzePolyphony(null).avgTurnLength).toBe(0);
  });
});
