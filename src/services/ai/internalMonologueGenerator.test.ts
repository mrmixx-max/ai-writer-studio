/**
 * Tests: internalMonologueGenerator (WP 57.1 — Deep POV & Erlebte Rede)
 */

import { describe, it, expect } from "vitest";
import {
  generateInternalMonologue,
  analyzeMonologueDepth,
  stripThoughtTags,
  STATE_LABELS,
  type MentalState,
} from "./internalMonologueGenerator";

describe("internalMonologueGenerator — generateInternalMonologue", () => {
  it("erzeugt einen Monolog", () => {
    const r = generateInternalMonologue("panic");
    expect(r.text.length).toBeGreaterThan(10);
    expect(r.state).toBe("panic");
  });

  it("erzeugt die gewünschte Fragmentzahl", () => {
    const r = generateInternalMonologue("calculation", { fragments: 9 });
    expect(r.fragmentCount).toBe(9);
    expect(r.fragments.length).toBe(9);
  });

  it("ist deterministisch", () => {
    const a = generateInternalMonologue("grief", { fragments: 8 });
    const b = generateInternalMonologue("grief", { fragments: 8 });
    expect(a.text).toBe(b.text);
  });

  it("unterschiedliche Zustände erzeugen unterschiedlichen Text", () => {
    const panic = generateInternalMonologue("panic");
    const calc = generateInternalMonologue("calculation");
    const grief = generateInternalMonologue("grief");
    expect(panic.text).not.toBe(calc.text);
    expect(calc.text).not.toBe(grief.text);
  });

  it("verarbeitet alle drei Zustände", () => {
    const states: MentalState[] = ["panic", "calculation", "grief"];
    states.forEach((s) => {
      const r = generateInternalMonologue(s);
      expect(r.state).toBe(s);
      expect(r.text.length).toBeGreaterThan(5);
    });
  });

  it("Panik ist fragmentierter als Berechnung", () => {
    const panic = generateInternalMonologue("panic", { fragments: 10 });
    const calc = generateInternalMonologue("calculation", { fragments: 10 });
    expect(panic.avgFragmentLength).toBeLessThanOrEqual(calc.avgFragmentLength);
  });

  it("erlebte Rede enthält keine distanzierenden Marker", () => {
    const r = generateInternalMonologue("grief", { freeIndirect: true });
    expect(r.distancingMarkers).toBe(0);
    expect(r.text.toLowerCase()).not.toContain("dachte er");
  });

  it("bindet die Situation ein", () => {
    const r = generateInternalMonologue("panic", { situation: "im brennenden Haus" });
    expect(r.text).toContain("brennenden Haus");
  });

  it("begrenzt die Fragmentzahl auf 3–14", () => {
    expect(generateInternalMonologue("panic", { fragments: 1 }).fragmentCount).toBe(3);
    expect(generateInternalMonologue("panic", { fragments: 99 }).fragmentCount).toBe(14);
  });

  it("fällt bei unbekanntem Zustand auf calculation zurück", () => {
    const r = generateInternalMonologue("unbekannt" as never);
    expect(r.state).toBe("calculation");
  });

  it("kommt ohne Argumente zurecht", () => {
    const r = generateInternalMonologue();
    expect(r.fragmentCount).toBeGreaterThan(0);
    expect(r.state).toBe("calculation");
  });

  it("kommt mit null-Optionen zurecht", () => {
    expect(generateInternalMonologue("panic", null).text.length).toBeGreaterThan(5);
  });

  it("berechnet die mittlere Fragmentlänge", () => {
    const r = generateInternalMonologue("calculation", { fragments: 6 });
    expect(r.avgFragmentLength).toBeGreaterThan(0);
  });

  it("exportiert die Zustands-Labels", () => {
    expect(STATE_LABELS.panic).toBe("Rasende Panik");
    expect(STATE_LABELS.calculation).toBe("Kühle Berechnung");
    expect(STATE_LABELS.grief).toBe("Trauer & Betäubung");
  });

  it("nutzt kein distanzierendes 'dachte' in erlebter Rede", () => {
    const r = generateInternalMonologue("calculation", { fragments: 12 });
    expect(r.text.toLowerCase()).not.toMatch(/\bdachte\b/);
  });
});

describe("internalMonologueGenerator — analyzeMonologueDepth", () => {
  it("tiefe erlebte Rede erreicht hohe Werte", () => {
    const r = analyzeMonologueDepth("Zu schnell. Kein Ausweg. Der Puls im Hals. Nicht jetzt.");
    expect(r.depth).toBeGreaterThan(0.7);
  });

  it("distanzierende Marker senken die Tiefe", () => {
    const deep = analyzeMonologueDepth("Zu schnell. Kein Ausweg.");
    const shallow = analyzeMonologueDepth(
      "Er dachte, dass es zu schnell war, und er fragte sich, ob es einen Ausweg gab.",
    );
    expect(shallow.depth).toBeLessThan(deep.depth);
  });

  it("listet die distanzierenden Marker", () => {
    const r = analyzeMonologueDepth("Er dachte an sie und fragte sich warum.");
    expect(r.distancingMarkers.length).toBeGreaterThan(0);
  });

  it("zählt Fragmente", () => {
    const r = analyzeMonologueDepth("Eins. Zwei. Drei.");
    expect(r.fragmentCount).toBe(3);
  });

  it("berechnet die Fragmentierungsquote", () => {
    const r = analyzeMonologueDepth("Kurz. Auch kurz. Ein deutlich längerer Satz mit vielen Wörtern hier.");
    expect(r.fragmentationRatio).toBeGreaterThan(0);
  });

  it("erkennt sensorische Reize", () => {
    const r = analyzeMonologueDepth("Der Geruch von Öl. Das Ticken der Uhr. Es war kalt.");
    expect(r.sensoryHits).toBeGreaterThan(0);
  });

  it("depth bleibt zwischen 0 und 1", () => {
    const r = analyzeMonologueDepth(
      "Er dachte, sie dachte, ich dachte, er fragte sich, sie fragte sich, bei sich, in Gedanken.",
    );
    expect(r.depth).toBeGreaterThanOrEqual(0);
    expect(r.depth).toBeLessThanOrEqual(1);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzeMonologueDepth("");
    expect(r.depth).toBe(0);
    expect(r.distancingMarkers).toEqual([]);
    expect(analyzeMonologueDepth(null).fragmentCount).toBe(0);
    expect(analyzeMonologueDepth(undefined).sensoryHits).toBe(0);
  });

  it("erkennt den generierten Monolog als tief", () => {
    const m = generateInternalMonologue("panic", { fragments: 10 });
    const r = analyzeMonologueDepth(m.text);
    expect(r.depth).toBeGreaterThan(0.6);
  });
});

describe("internalMonologueGenerator — stripThoughtTags", () => {
  it("entfernt 'dachte er'", () => {
    const r = stripThoughtTags("Es war zu spät, dachte er.");
    expect(r.text.toLowerCase()).not.toContain("dachte er");
    expect(r.text).toContain("zu spät");
    expect(r.removed).toBeGreaterThan(0);
  });

  it("entfernt 'fragte sie sich'", () => {
    const r = stripThoughtTags("Warum nur, fragte sie sich.");
    expect(r.text.toLowerCase()).not.toContain("fragte sie sich");
  });

  it("erhält den Gedankeninhalt", () => {
    const r = stripThoughtTags("Der Stuhl steht noch schief, dachte sie.");
    expect(r.text).toContain("Stuhl steht noch schief");
  });

  it("bereinigt verwaiste Satzzeichen", () => {
    const r = stripThoughtTags("Es war zu spät, dachte er.");
    expect(r.text).not.toMatch(/,\s*\./);
    expect(r.text).not.toMatch(/\s{2,}/);
  });

  it("meldet die Anzahl entfernter Marker", () => {
    const r = stripThoughtTags("Er dachte nach. Sie fragte sich warum.");
    expect(r.removed).toBeGreaterThanOrEqual(1);
  });

  it("lässt Text ohne Marker unverändert", () => {
    const clean = "Der Regen fiel schräg gegen das Fenster.";
    const r = stripThoughtTags(clean);
    expect(r.text).toBe(clean);
    expect(r.removed).toBe(0);
  });

  it("erhöht die POV-Tiefe messbar", () => {
    const shallow = "Er dachte, dass es zu spät war, und er fragte sich, ob es einen Ausweg gab.";
    const before = analyzeMonologueDepth(shallow);
    const stripped = stripThoughtTags(shallow);
    const after = analyzeMonologueDepth(stripped.text);
    expect(after.depth).toBeGreaterThan(before.depth);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(stripThoughtTags("").removed).toBe(0);
    expect(stripThoughtTags(null).text).toBe("");
    expect(stripThoughtTags(undefined).removed).toBe(0);
  });
});
