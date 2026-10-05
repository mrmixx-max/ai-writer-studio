/**
 * Tests: combatChoreographyGenerator (WP 56.2 — Action- & Kampf-Choreograf)
 */

import { describe, it, expect } from "vitest";
import {
  choreographCombat,
  validateCombatBeat,
  analyzeCombatPacing,
  WEAPON_LABELS,
  OBSTACLE_LABELS,
  type Combatant,
} from "./combatChoreographyGenerator";

const DUEL: Combatant[] = [
  { name: "Raven", weapon: "longsword", grip: "two-handed", condition: "fresh" },
  { name: "Kessler", weapon: "dagger", grip: "one-handed", condition: "wounded" },
];

describe("combatChoreographyGenerator — choreographCombat", () => {
  it("erzeugt eine Choreografie", () => {
    const r = choreographCombat({ combatants: DUEL });
    expect(r.beatCount).toBeGreaterThan(0);
    expect(r.text.length).toBeGreaterThan(50);
  });

  it("nennt die Kämpfer", () => {
    const r = choreographCombat({ combatants: DUEL });
    expect(r.combatants).toEqual(["Raven", "Kessler"]);
  });

  it("nummeriert die Beats fortlaufend", () => {
    const r = choreographCombat({ combatants: DUEL });
    r.beats.forEach((b, i) => expect(b.index).toBe(i + 1));
  });

  it("ist deterministisch", () => {
    const a = choreographCombat({ combatants: DUEL, tempo: "kinetic" });
    const b = choreographCombat({ combatants: DUEL, tempo: "kinetic" });
    expect(a.text).toBe(b.text);
  });

  it("Tempo steuert die Beat-Anzahl", () => {
    const slow = choreographCombat({ combatants: DUEL, tempo: "measured" });
    const fast = choreographCombat({ combatants: DUEL, tempo: "frantic" });
    expect(fast.beatCount).toBeGreaterThan(slow.beatCount);
  });

  it("wechselt die handelnden Figuren", () => {
    const r = choreographCombat({ combatants: DUEL });
    const actors = new Set(r.beats.map((b) => b.actor));
    expect(actors.size).toBe(2);
  });

  it("endet mit einem Abschluss-Beat", () => {
    const r = choreographCombat({ combatants: DUEL });
    expect(r.beats[r.beats.length - 1].kind).toBe("finish");
  });

  it("webt Hindernisse ein", () => {
    const r = choreographCombat({
      combatants: DUEL,
      obstacles: ["rain", "overturned-table", "wet-cobblestones"],
    });
    expect(r.obstacles.length).toBeGreaterThan(0);
  });

  it("verarbeitet den Zustand verwundeter Figuren", () => {
    const r = choreographCombat({ combatants: DUEL });
    expect(r.text).toMatch(/Wunde|Luft/);
  });

  it("erzeugt Stakkato-Sätze bei frantic", () => {
    const r = choreographCombat({ combatants: DUEL, tempo: "frantic" });
    const pacing = analyzeCombatPacing(r.text);
    expect(pacing.staccatoRatio).toBeGreaterThan(0);
  });

  it("jeder Beat endet mit Satzzeichen", () => {
    const r = choreographCombat({ combatants: DUEL });
    r.beats.forEach((b) => {
      expect(/[.!?]$/.test(b.text.trim())).toBe(true);
    });
  });

  it("verlangt mindestens 2 Kämpfer", () => {
    const r = choreographCombat({ combatants: [{ name: "Solo", weapon: "fists" }] });
    expect(r.beats).toEqual([]);
    expect(r.text).toBe("");
  });

  it("begrenzt auf maximal 4 Kämpfer", () => {
    const many: Combatant[] = [
      { name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" },
    ];
    const r = choreographCombat({ combatants: many });
    expect(r.combatants.length).toBe(4);
    expect(r.combatants).not.toContain("E");
  });

  it("mutiert die Eingabe nicht", () => {
    const copy = JSON.parse(JSON.stringify(DUEL));
    choreographCombat({ combatants: DUEL });
    expect(DUEL).toEqual(copy);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(choreographCombat().beats).toEqual([]);
    expect(choreographCombat(null).text).toBe("");
    expect(choreographCombat(undefined).beatCount).toBe(0);
    expect(choreographCombat({ combatants: "kein Array" as never }).beatCount).toBe(0);
    expect(choreographCombat({ combatants: [{ name: "" }, { name: "  " }] }).beatCount).toBe(0);
  });

  it("fällt bei unbekanntem Tempo auf kinetic zurück", () => {
    const r = choreographCombat({ combatants: DUEL, tempo: "unbekannt" as never });
    expect(r.beatCount).toBe(10);
  });

  it("berechnet Satz-Kennzahlen", () => {
    const r = choreographCombat({ combatants: DUEL });
    expect(r.sentenceCount).toBeGreaterThan(0);
    expect(r.avgSentenceLength).toBeGreaterThan(0);
  });

  it("exportiert Waffen- und Hindernis-Labels", () => {
    expect(WEAPON_LABELS.longsword).toBe("Langschwert");
    expect(OBSTACLE_LABELS.rain).toBe("Regen");
  });
});

describe("combatChoreographyGenerator — validateCombatBeat", () => {
  it("blockiert zweihändige Waffe einhändig", () => {
    const r = validateCombatBeat({ name: "Raven", weapon: "longsword", grip: "one-handed" });
    expect(r.valid).toBe(false);
    expect(r.violations[0]).toContain("beide Hände");
  });

  it("erlaubt zweihändige Waffe beidhändig", () => {
    const r = validateCombatBeat({ name: "Raven", weapon: "longsword", grip: "two-handed" });
    expect(r.valid).toBe(true);
  });

  it("blockiert Nachladen mit belegten Händen", () => {
    const r = validateCombatBeat(
      { name: "Kessler", weapon: "rifle", grip: "two-handed" },
      { reload: true },
    );
    expect(r.valid).toBe(false);
    expect(r.violations[0]).toContain("freie Hand");
  });

  it("erlaubt Nachladen mit freier Hand", () => {
    const r = validateCombatBeat(
      { name: "Kessler", weapon: "pistol", grip: "one-handed" },
      { reload: true },
    );
    expect(r.valid).toBe(true);
  });

  it("blockiert Angriff und Nachladen gleichzeitig", () => {
    const r = validateCombatBeat(
      { name: "Kessler", weapon: "pistol", grip: "one-handed" },
      { attack: true, reload: true },
    );
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => v.includes("gleichzeitig"))).toBe(true);
  });

  it("blockiert Langschwert plus Schild", () => {
    const r = validateCombatBeat({ name: "Raven", weapon: "longsword", grip: "shield" });
    expect(r.valid).toBe(false);
    expect(r.violations[0]).toContain("Schild");
  });

  it("erlaubt Fäuste immer", () => {
    expect(validateCombatBeat({ name: "X", weapon: "fists" }).valid).toBe(true);
  });

  it("kommt mit fehlendem Kämpfer zurecht", () => {
    expect(validateCombatBeat(null).valid).toBe(true);
    expect(validateCombatBeat(undefined).violations).toEqual([]);
  });
});

describe("combatChoreographyGenerator — analyzeCombatPacing", () => {
  it("zählt Sätze", () => {
    const r = analyzeCombatPacing("Kurz. Länger hier. Und noch einer.");
    expect(r.sentenceCount).toBe(3);
  });

  it("berechnet die mittlere Satzlänge", () => {
    const r = analyzeCombatPacing("Eins zwei drei. Vier fünf sechs.");
    expect(r.avgSentenceLength).toBe(3);
  });

  it("findet den längsten Satz", () => {
    const r = analyzeCombatPacing("Kurz. Eins zwei drei vier fünf sechs sieben.");
    expect(r.longestSentence).toBe(7);
  });

  it("berechnet die Stakkato-Quote", () => {
    const r = analyzeCombatPacing("Kein Atem. Nur Bewegung. Dann Stille. Und ein längerer Satz mit vielen Wörtern hier.");
    expect(r.staccatoRatio).toBeGreaterThan(0);
  });

  it("belohnt wechselnde Satzlängen", () => {
    const varied = analyzeCombatPacing(
      "Kurz. Ein deutlich längerer Satz mit vielen Wörtern und Details. Kurz. Noch ein langer Satz mit reichlich Wörtern darin.",
    );
    expect(varied.rhythmScore).toBeGreaterThan(0.5);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzeCombatPacing("");
    expect(r.sentenceCount).toBe(0);
    expect(r.rhythmScore).toBe(0);
    expect(analyzeCombatPacing(null).avgSentenceLength).toBe(0);
    expect(analyzeCombatPacing(undefined).longestSentence).toBe(0);
  });
});
