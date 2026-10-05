/**
 * Tests: plotTwistSynthesizer (WP 58.1 — Autonomer Plot-Twist-Synthesizer)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeTwist,
  generateConfrontation,
  scoreTwistImpact,
  ARCHETYPE_LABELS,
  type TwistArchetype,
} from "./plotTwistSynthesizer";

const OPTS = {
  protagonist: "Aron",
  antagonist: "Meister Halden",
  artifact: "das Sonnenrelikt",
};

describe("plotTwistSynthesizer — synthesizeTwist", () => {
  it("erzeugt einen Twist", () => {
    const t = synthesizeTwist(OPTS);
    expect(t.reveal.length).toBeGreaterThan(20);
    expect(t.archetype).toBeTruthy();
  });

  it("unterstützt alle vier Archetypen", () => {
    const all: TwistArchetype[] = [
      "identity-reveal", "false-objective", "moral-reversal", "sacrifice-choice",
    ];
    all.forEach((a) => {
      const t = synthesizeTwist({ ...OPTS, archetype: a });
      expect(t.archetype).toBe(a);
      expect(t.label).toBe(ARCHETYPE_LABELS[a]);
    });
  });

  it("nennt den Antagonisten bei der Identitäts-Enthüllung", () => {
    const t = synthesizeTwist({ ...OPTS, archetype: "identity-reveal" });
    expect(t.reveal).toContain("Meister Halden");
  });

  it("nennt das Artefakt beim Scheinziel", () => {
    const t = synthesizeTwist({ ...OPTS, archetype: "false-objective" });
    expect(t.reveal).toContain("Sonnenrelikt");
  });

  it("nennt den Helden bei der Opfer-Wahl", () => {
    const t = synthesizeTwist({ ...OPTS, archetype: "sacrifice-choice" });
    expect(t.reveal).toContain("Aron");
  });

  it("nennt immer eine konkrete Figur oder das Artefakt", () => {
    const all: TwistArchetype[] = [
      "identity-reveal", "false-objective", "moral-reversal", "sacrifice-choice",
    ];
    all.forEach((a) => {
      const t = synthesizeTwist({ ...OPTS, archetype: a });
      const names = ["Aron", "Meister Halden", "Sonnenrelikt"];
      expect(names.some((n) => t.reveal.includes(n))).toBe(true);
    });
  });

  it("liefert zwei Vorbereitungs-Hinweise", () => {
    const t = synthesizeTwist(OPTS);
    expect(t.setup.length).toBe(2);
  });

  it("Hinweise sind verschieden", () => {
    const t = synthesizeTwist(OPTS);
    expect(t.setup[0]).not.toBe(t.setup[1]);
  });

  it("liefert die emotionale Wirkung", () => {
    const t = synthesizeTwist(OPTS);
    expect(t.emotionalImpact.length).toBeGreaterThan(10);
  });

  it("listet die betroffenen Figuren", () => {
    const t = synthesizeTwist({ ...OPTS, archetype: "sacrifice-choice" });
    expect(t.affected).toContain("Aron");
  });

  it("ist deterministisch", () => {
    const a = synthesizeTwist({ ...OPTS, archetype: "moral-reversal" });
    const b = synthesizeTwist({ ...OPTS, archetype: "moral-reversal" });
    expect(a.reveal).toBe(b.reveal);
    expect(a.setup).toEqual(b.setup);
  });

  it("wählt ohne Vorgabe deterministisch einen Archetyp", () => {
    const a = synthesizeTwist(OPTS);
    const b = synthesizeTwist(OPTS);
    expect(a.archetype).toBe(b.archetype);
  });

  it("endet mit Satzzeichen", () => {
    const t = synthesizeTwist(OPTS);
    expect(/[.!?]$/.test(t.reveal.trim())).toBe(true);
  });

  it("nutzt Platzhalter bei fehlenden Namen", () => {
    const t = synthesizeTwist({ archetype: "identity-reveal" });
    expect(t.reveal.length).toBeGreaterThan(10);
  });

  it("kommt ohne Optionen zurecht", () => {
    const t = synthesizeTwist();
    expect(t.reveal.length).toBeGreaterThan(10);
  });

  it("kommt mit null zurecht", () => {
    expect(synthesizeTwist(null).reveal.length).toBeGreaterThan(10);
    expect(synthesizeTwist(undefined).setup.length).toBe(2);
  });

  it("mutiert die Optionen nicht", () => {
    const copy = { ...OPTS };
    synthesizeTwist(OPTS);
    expect(OPTS).toEqual(copy);
  });

  it("exportiert die Archetyp-Labels", () => {
    expect(ARCHETYPE_LABELS["identity-reveal"]).toBe("Identitäts-Enthüllung");
    expect(ARCHETYPE_LABELS["false-objective"]).toBe("Scheinziel (False Objective)");
  });
});

describe("plotTwistSynthesizer — generateConfrontation", () => {
  it("erzeugt eine Konfrontationsszene", () => {
    const s = generateConfrontation(OPTS);
    expect(s.lineCount).toBeGreaterThan(4);
    expect(s.text.length).toBeGreaterThan(100);
  });

  it("enthält alle vier Phasen", () => {
    const s = generateConfrontation(OPTS);
    const kinds = new Set(s.lines.map((l) => l.kind));
    expect(kinds.has("setup")).toBe(true);
    expect(kinds.has("reveal")).toBe(true);
    expect(kinds.has("reaction")).toBe(true);
    expect(kinds.has("consequence")).toBe(true);
  });

  it("enthält die Enthüllung", () => {
    const s = generateConfrontation({ ...OPTS, archetype: "identity-reveal" });
    expect(s.text).toContain("Meister Halden");
  });

  it("nennt die beteiligten Figuren", () => {
    const s = generateConfrontation(OPTS);
    expect(s.characters).toEqual(["Aron", "Meister Halden"]);
  });

  it("ist deterministisch", () => {
    const a = generateConfrontation({ ...OPTS, archetype: "moral-reversal" });
    const b = generateConfrontation({ ...OPTS, archetype: "moral-reversal" });
    expect(a.text).toBe(b.text);
  });

  it("formatiert Redebeiträge mit Sprecher", () => {
    const s = generateConfrontation(OPTS);
    expect(s.text).toContain("ARON:");
  });

  it("enthält den Twist im Ergebnis", () => {
    const s = generateConfrontation(OPTS);
    expect(s.twist).toBeTruthy();
    expect(s.twist.archetype).toBeTruthy();
  });

  it("berechnet die Wortzahl", () => {
    const s = generateConfrontation(OPTS);
    expect(s.wordCount).toBeGreaterThan(40);
  });

  it("kommt ohne Optionen zurecht", () => {
    const s = generateConfrontation();
    expect(s.lineCount).toBeGreaterThan(4);
  });

  it("kommt mit null zurecht", () => {
    expect(generateConfrontation(null).lineCount).toBeGreaterThan(4);
    expect(generateConfrontation(undefined).wordCount).toBeGreaterThan(20);
  });
});

describe("plotTwistSynthesizer — scoreTwistImpact", () => {
  it("bewertet einen Twist", () => {
    const t = synthesizeTwist(OPTS);
    const s = scoreTwistImpact(t);
    expect(s.impact).toBeGreaterThan(0);
    expect(s.surprise).toBeGreaterThan(0);
    expect(s.preparation).toBeGreaterThan(0);
  });

  it("impact bleibt zwischen 0 und 1", () => {
    const t = synthesizeTwist(OPTS);
    const s = scoreTwistImpact(t);
    expect(s.impact).toBeGreaterThanOrEqual(0);
    expect(s.impact).toBeLessThanOrEqual(1);
  });

  it("mehr Hinweise erhöhen die Vorbereitung", () => {
    const t = synthesizeTwist(OPTS);
    const few = scoreTwistImpact({ ...t, setup: [t.setup[0]] });
    const many = scoreTwistImpact({ ...t, setup: [...t.setup, "dritter", "vierter"] });
    expect(many.preparation).toBeGreaterThan(few.preparation);
  });

  it("mehr Hinweise senken die Überraschung", () => {
    const t = synthesizeTwist(OPTS);
    const few = scoreTwistImpact({ ...t, setup: [t.setup[0]] });
    const many = scoreTwistImpact({ ...t, setup: [...t.setup, "dritter", "vierter"] });
    expect(many.surprise).toBeLessThan(few.surprise);
  });

  it("empfiehlt Hinweise bei fehlender Vorbereitung", () => {
    const t = synthesizeTwist(OPTS);
    const s = scoreTwistImpact({ ...t, setup: [] });
    expect(s.recommendation).toContain("Vorbereitung");
  });

  it("empfiehlt weniger Spuren bei zu vielen Hinweisen", () => {
    const t = synthesizeTwist(OPTS);
    const s = scoreTwistImpact({ ...t, setup: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(s.recommendation).toContain("vorhersehbar");
  });

  it("liefert eine Empfehlung", () => {
    const s = scoreTwistImpact(synthesizeTwist(OPTS));
    expect(s.recommendation.length).toBeGreaterThan(10);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    const s = scoreTwistImpact(null);
    expect(s.impact).toBe(0);
    expect(s.recommendation).toContain("Kein Twist");
    expect(scoreTwistImpact(undefined).surprise).toBe(0);
  });

  it("harmonisches Mittel bestraft einseitige Werte", () => {
    const t = synthesizeTwist(OPTS);
    const s = scoreTwistImpact({ ...t, setup: [] });
    // Vorbereitung 0 → impact muss 0 sein, egal wie hoch die Überraschung.
    expect(s.impact).toBe(0);
  });
});
