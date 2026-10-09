// @vitest-environment jsdom
// Armierungs-Sequenz-Orchestrator Tests (Meilenstein 59.0 / v7.1.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ARMING_STEPS,
  generateTensionWeave,
  generateArmingScene,
  createSampleArmingStep,
  createSampleArmingScene,
} from "./armingSequenceOrchestrator";

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("ist deterministisch für gleichen Input", () => {
    const a = hashString("der-himmel-ist-blau");
    const b = hashString("der-himmel-ist-blau");
    expect(a).toBe(b);
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    const hashes = new Set([
      hashString("alpha"),
      hashString("beta"),
      hashString("gamma"),
      hashString("delta"),
      hashString("epsilon"),
      hashString("zeta"),
    ]);
    expect(hashes.size).toBeGreaterThan(1);
  });

  it("liefert einen unsigned 32-bit Integer", () => {
    const h = hashString("irgendein-string");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("verarbeitet leeren String ohne Fehler", () => {
    expect(() => hashString("")).not.toThrow();
    expect(Number.isInteger(hashString(""))).toBe(true);
  });

  it("verarbeitet Unicode-Zeichen korrekt", () => {
    const h1 = hashString("⚔️ Schwert");
    const h2 = hashString("🛡️ Schild");
    expect(Number.isInteger(h1)).toBe(true);
    expect(Number.isInteger(h2)).toBe(true);
  });

  it("reaktieren sensibel auf kleine Änderungen", () => {
    const h1 = hashString("Riemen");
    const h2 = hashString("Riemen ");
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------
describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("liefert Werte im Bereich [0, 1)", () => {
    const rng = createSeededRandom(1337);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("liefert unterschiedliche Sequenzen für verschiedene Seeds", () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it("akzeptiert Seed 0", () => {
    const rng = createSeededRandom(0);
    const v = rng();
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("produziert eine verteilte Abfolge (statt Konstante)", () => {
    const rng = createSeededRandom(99);
    const values = new Set(Array.from({ length: 50 }, () => rng()));
    expect(values.size).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------
// ARMING_STEPS
// ---------------------------------------------------------------------------
describe("ARMING_STEPS", () => {
  it("enthält genau 6 Schritte", () => {
    expect(ARMING_STEPS).toHaveLength(6);
  });

  it("hat eindeutige ids", () => {
    const ids = ARMING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("enthält die erwarteten Schritt-Ids in korrekter Reihenfolge", () => {
    const ids = ARMING_STEPS.map((s) => s.id);
    expect(ids).toEqual([
      "underwear",
      "legwear",
      "cuirass",
      "armwear",
      "helm",
      "weapon",
    ]);
  });

  it("jeder Schritt hat ein nicht-leeres name", () => {
    for (const step of ARMING_STEPS) {
      expect(typeof step.name).toBe("string");
      expect(step.name.length).toBeGreaterThan(0);
    }
  });

  it("jeder Schritt hat eine nicht-leere description", () => {
    for (const step of ARMING_STEPS) {
      expect(typeof step.description).toBe("string");
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it("jeder Schritt hat eine positive Dauer in Sekunden", () => {
    for (const step of ARMING_STEPS) {
      expect(typeof step.duration).toBe("number");
      expect(step.duration).toBeGreaterThan(0);
    }
  });

  it("jeder Schritt hat eine Schwierigkeit zwischen 0 und 10", () => {
    for (const step of ARMING_STEPS) {
      expect(typeof step.difficulty).toBe("number");
      expect(step.difficulty).toBeGreaterThanOrEqual(0);
      expect(step.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it("folgt der traditionellen Reihenfolge Unterkleid → Beine → Torso → Arme → Kopf → Waffe", () => {
    const names = ARMING_STEPS.map((s) => s.name);
    expect(names[0]).toContain("Unterkleid");
    expect(names[1]).toContain("Bein");
    expect(names[2]).toContain("Brustpanzer");
    expect(names[3]).toContain("Armzeug");
    expect(names[4]).toContain("Helm");
    expect(names[5]).toContain("Waffenübergabe");
  });
});

// ---------------------------------------------------------------------------
// generateTensionWeave
// ---------------------------------------------------------------------------
describe("generateTensionWeave", () => {
  const defaultState = { fear: 5, determination: 5, experience: 5 };

  it("ist deterministisch für gleichen Input", () => {
    const w1 = generateTensionWeave("cuirass", defaultState, 42);
    const w2 = generateTensionWeave("cuirass", defaultState, 42);
    expect(w1).toEqual(w2);
  });

  it("liefert eine Spannung zwischen 0 und 10", () => {
    for (const step of ARMING_STEPS) {
      const weave = generateTensionWeave(step.id, defaultState, 7);
      expect(weave.tension).toBeGreaterThanOrEqual(0);
      expect(weave.tension).toBeLessThanOrEqual(10);
    }
  });

  it("liefert psychologicalCues als Array mit mindestens einem Eintrag", () => {
    for (const step of ARMING_STEPS) {
      const weave = generateTensionWeave(step.id, defaultState, 99);
      expect(Array.isArray(weave.psychologicalCues)).toBe(true);
      expect(weave.psychologicalCues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("liefert einen nicht-leeren innerMonologue-String", () => {
    for (const step of ARMING_STEPS) {
      const weave = generateTensionWeave(step.id, defaultState, 13);
      expect(typeof weave.innerMonologue).toBe("string");
      expect(weave.innerMonologue.length).toBeGreaterThan(0);
    }
  });

  it("reaktiviert auf steigende Angst mit höherer Spannung", () => {
    const lowFear = generateTensionWeave(
      "weapon",
      { fear: 1, determination: 5, experience: 5 },
      42,
    );
    const highFear = generateTensionWeave(
      "weapon",
      { fear: 9, determination: 5, experience: 5 },
      42,
    );
    expect(highFear.tension).toBeGreaterThanOrEqual(lowFear.tension);
  });

  it("dämpft die Spannung bei hoher Entschlossenheit", () => {
    const lowResolve = generateTensionWeave(
      "helm",
      { fear: 7, determination: 1, experience: 5 },
      55,
    );
    const highResolve = generateTensionWeave(
      "helm",
      { fear: 7, determination: 9, experience: 5 },
      55,
    );
    expect(highResolve.tension).toBeLessThanOrEqual(lowResolve.tension);
  });

  it("dämpft die Spannung bei hoher Erfahrung", () => {
    const lowExp = generateTensionWeave(
      "cuirass",
      { fear: 7, determination: 5, experience: 1 },
      77,
    );
    const highExp = generateTensionWeave(
      "cuirass",
      { fear: 7, determination: 5, experience: 9 },
      77,
    );
    expect(highExp.tension).toBeLessThanOrEqual(lowExp.tension);
  });

  it("liefert defensive Fallbacks für unbekannte Schritt-Id", () => {
    const weave = generateTensionWeave("unbekannt", defaultState, 1);
    expect(weave.tension).toBe(0);
    expect(weave.psychologicalCues).toEqual([]);
    expect(weave.innerMonologue).toBe("");
  });

  it("nutzt alle 6 Schritt-Ids", () => {
    for (const step of ARMING_STEPS) {
      const weave = generateTensionWeave(step.id, defaultState, 100);
      expect(weave).toBeDefined();
      expect(typeof weave.tension).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// generateArmingScene
// ---------------------------------------------------------------------------
describe("generateArmingScene", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const s1 = generateArmingScene(12345);
    const s2 = generateArmingScene(12345);
    expect(s1).toEqual(s2);
  });

  it("liefert eine Szene als nicht-leeren String", () => {
    const scene = generateArmingScene(42);
    expect(typeof scene.scene).toBe("string");
    expect(scene.scene.length).toBeGreaterThan(0);
  });

  it("enthält alle 6 Schritte in der Szene", () => {
    const scene = generateArmingScene(7);
    expect(scene.stepCount).toBe(6);
  });

  it("summiert die Gesamtdauer aller Schritte korrekt", () => {
    const scene = generateArmingScene(99);
    const expectedDuration = ARMING_STEPS.reduce((sum, s) => sum + s.duration, 0);
    expect(scene.totalDuration).toBe(expectedDuration);
  });

  it("liefert eine durchschnittliche Spannung zwischen 0 und 10", () => {
    const scene = generateArmingScene(55);
    expect(scene.averageTension).toBeGreaterThanOrEqual(0);
    expect(scene.averageTension).toBeLessThanOrEqual(10);
  });

  it("die Szene enthält die Namen aller Schritte", () => {
    const scene = generateArmingScene(3);
    for (const step of ARMING_STEPS) {
      expect(scene.scene).toContain(step.name);
    }
  });

  it("die Szene enthält Beschreibungen aller Schritte", () => {
    const scene = generateArmingScene(11);
    for (const step of ARMING_STEPS) {
      expect(scene.scene).toContain(step.description);
    }
  });

  it("verbinden die Szene mit Absätzen", () => {
    const scene = generateArmingScene(22);
    expect(scene.scene).toContain("\n\n");
  });

  it("sind Szenen für verschiedene Seeds unterschiedlich", () => {
    const s1 = generateArmingScene(1);
    const s2 = generateArmingScene(2);
    // Mindestens ein Feld sollte sich unterscheiden
    const different =
      s1.scene !== s2.scene ||
      s1.averageTension !== s2.averageTension ||
      s1.totalDuration !== s2.totalDuration;
    expect(different).toBe(true);
  });

  it("mit Seed 0 funktioniert", () => {
    const scene = generateArmingScene(0);
    expect(scene.stepCount).toBe(6);
    expect(scene.totalDuration).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createSampleArmingStep
// ---------------------------------------------------------------------------
describe("createSampleArmingStep", () => {
  it("liefert einen gültigen ArmingStep mit allen Feldern", () => {
    const step = createSampleArmingStep();
    expect(step).toBeDefined();
    expect(typeof step.id).toBe("string");
    expect(typeof step.name).toBe("string");
    expect(step.name.length).toBeGreaterThan(0);
    expect(typeof step.description).toBe("string");
    expect(step.description.length).toBeGreaterThan(0);
    expect(typeof step.duration).toBe("number");
    expect(step.duration).toBeGreaterThan(0);
    expect(typeof step.difficulty).toBe("number");
    expect(step.difficulty).toBeGreaterThanOrEqual(0);
    expect(step.difficulty).toBeLessThanOrEqual(10);
  });

  it("entspricht dem ersten kanonischen Schritt (underwear)", () => {
    const step = createSampleArmingStep();
    expect(step.id).toBe("underwear");
    expect(step.name).toBe("Unterkleid");
  });

  it("jedes Aufrufobjekt ist eine frische Kopie (keine Referenz)", () => {
    const s1 = createSampleArmingStep();
    const s2 = createSampleArmingStep();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });
});

// ---------------------------------------------------------------------------
// createSampleArmingScene
// ---------------------------------------------------------------------------
describe("createSampleArmingScene", () => {
  it("liefert eine gültige ArmingScene mit allen Feldern", () => {
    const scene = createSampleArmingScene();
    expect(scene).toBeDefined();
    expect(typeof scene.scene).toBe("string");
    expect(scene.scene.length).toBeGreaterThan(0);
    expect(typeof scene.totalDuration).toBe("number");
    expect(scene.totalDuration).toBeGreaterThan(0);
    expect(typeof scene.stepCount).toBe("number");
    expect(scene.stepCount).toBe(6);
    expect(typeof scene.averageTension).toBe("number");
    expect(scene.averageTension).toBeGreaterThanOrEqual(0);
    expect(scene.averageTension).toBeLessThanOrEqual(10);
  });

  it("ist deterministisch (fester interner Seed)", () => {
    const s1 = createSampleArmingScene();
    const s2 = createSampleArmingScene();
    expect(s1).toEqual(s2);
  });

  it("enthält alle 6 Schritt-Namen", () => {
    const scene = createSampleArmingScene();
    for (const step of ARMING_STEPS) {
      expect(scene.scene).toContain(step.name);
    }
  });

  it("enthält psychologische Cues in der Szene", () => {
    const scene = createSampleArmingScene();
    // Cues enthalten typischerweise Satzzeichen oder konkrete Phrasen
    const hasCueElements =
      scene.scene.includes("Puls") ||
      scene.scene.includes("Atem") ||
      scene.scene.includes("Angst") ||
      scene.scene.includes("Herz") ||
      scene.scene.includes("Zweifel") ||
      scene.scene.includes("Entschlossenheit") ||
      scene.scene.includes("Ruhig");
    expect(hasCueElements).toBe(true);
  });

  it("die Gesamtdauer entspricht der Summe der Schritt-Dauern", () => {
    const scene = createSampleArmingScene();
    const expected = ARMING_STEPS.reduce((sum, s) => sum + s.duration, 0);
    expect(scene.totalDuration).toBe(expected);
  });

  it("die durchschnittliche Spannung liegt im erwarteten Bereich", () => {
    const scene = createSampleArmingScene();
    // Mit dem Sample-Seed sollten wir eine mittlere Spannung erwarten
    expect(scene.averageTension).toBeGreaterThanOrEqual(0);
    expect(scene.averageTension).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Integration: ARMING_STEPS ↔ generateTensionWeave ↔ generateArmingScene
// ---------------------------------------------------------------------------
describe("Integration: Armierungs-Pipeline", () => {
  it("jeder kanonische Schritt kann eine Spannungs-Verwebung erzeugen", () => {
    for (const step of ARMING_STEPS) {
      const weave = generateTensionWeave(
        step.id,
        { fear: 5, determination: 5, experience: 5 },
        42,
      );
      expect(weave).toBeDefined();
      expect(weave.tension).toBeGreaterThanOrEqual(0);
      expect(weave.tension).toBeLessThanOrEqual(10);
      expect(Array.isArray(weave.psychologicalCues)).toBe(true);
      expect(typeof weave.innerMonologue).toBe("string");
    }
  });

  it("die Szene enthält die psychologische Spannung der Schritte", () => {
    const scene = generateArmingScene(42);
    // Die Szene sollte Cues und Monologe enthalten
    expect(scene.scene.length).toBeGreaterThan(200);
  });

  it("die durchschnittliche Spannung der Szene liegt zwischen den Min/Max der Einzelschritte", () => {
    const scene = generateArmingScene(77);
    const tensions = ARMING_STEPS.map((step) =>
      generateTensionWeave(
        step.id,
        { fear: 5, determination: 5, experience: 5 },
        77,
      ).tension,
    );
    const min = Math.min(...tensions);
    const max = Math.max(...tensions);
    expect(scene.averageTension).toBeGreaterThanOrEqual(min);
    expect(scene.averageTension).toBeLessThanOrEqual(max);
  });

  it("die Beispiel-Szene ist eine gültige generateArmingScene-Ausgabe", () => {
    const sample = createSampleArmingScene();
    const reference = generateArmingScene(
      // createSampleArmingScene nutzt einen festen internen Seed
      // Wir prüfen daher nur die Struktur
      0,
    );
    expect(sample.stepCount).toBe(reference.stepCount);
    expect(sample.totalDuration).toBe(reference.totalDuration);
  });
});
