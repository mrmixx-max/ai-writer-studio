// @vitest-environment jsdom
/**
 * Tests: espionageTradecraftEngine (Meilenstein 57.0 — v6.9.0)
 * Spionagetradecraft- & Totbriefkasten-Topografie-Engine.
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  TRADECRAFT_OPERATIONS,
  generateTradecraftProse,
  generateDeadDropTopography,
  createSampleTradecraftOperation,
  createSampleDeadDrop,
} from "./espionageTradecraftEngine";

describe("hashString — deterministischer FNV-1a-Hash", () => {
  it("liefert für denselben String immer denselben Hash", () => {
    expect(hashString("toter-briefkasten")).toBe(hashString("toter-briefkasten"));
    expect(hashString("")).toBe(hashString(""));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("deadDrop")).not.toBe(hashString("brushPass"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("gibt einen nicht-negativen 32-Bit-Ganzzahlwert zurück", () => {
    const h = hashString("kompromittiertes-safehouse");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("behandelt Leerstring deterministisch als gültigen Hash", () => {
    const h = hashString("");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBe(hashString(""));
  });
});

describe("createSeededRandom — deterministischer Zufallsgenerator", () => {
  it("liefert für denselben Seed dieselbe Sequenz", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("liefert für unterschiedliche Seeds unterschiedliche Sequenzen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(a()).not.toBe(b());
  });

  it("erzeugt Werte im Bereich [0,1)", () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("TRADECRAFT_OPERATIONS — die vier Tradecraft-Operationen", () => {
  it("enthält genau vier Operationen", () => {
    expect(TRADECRAFT_OPERATIONS).toHaveLength(4);
  });

  it("enthält die vier erwarteten IDs", () => {
    const ids = TRADECRAFT_OPERATIONS.map((op) => op.id);
    expect(ids).toEqual(
      expect.arrayContaining(["deadDrop", "brushPass", "dryCleaning", "compromisedSafehouse"]),
    );
    expect(new Set(ids).size).toBe(4);
  });

  it("gibt jeder Operation id, name, description, riskLevel und steps", () => {
    for (const op of TRADECRAFT_OPERATIONS) {
      expect(typeof op.id).toBe("string");
      expect(op.id.length).toBeGreaterThan(0);
      expect(typeof op.name).toBe("string");
      expect(op.name.length).toBeGreaterThan(0);
      expect(typeof op.description).toBe("string");
      expect(op.description.length).toBeGreaterThan(0);
      expect(typeof op.riskLevel).toBe("number");
      expect(op.riskLevel).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(op.steps)).toBe(true);
      expect(op.steps.length).toBeGreaterThan(0);
      for (const step of op.steps) {
        expect(typeof step).toBe("string");
        expect(step.length).toBeGreaterThan(0);
      }
    }
  });

  it("weist dem kompromittierten Safehouse das höchste Risiko zu", () => {
    const safehouse = TRADECRAFT_OPERATIONS.find((op) => op.id === "compromisedSafehouse");
    const brushPass = TRADECRAFT_OPERATIONS.find((op) => op.id === "brushPass");
    expect(safehouse).toBeDefined();
    expect(brushPass).toBeDefined();
    expect(safehouse!.riskLevel).toBeGreaterThan(brushPass!.riskLevel);
  });
});

describe("generateTradecraftProse — paranoiadichte Prosa", () => {
  it("liefert einen nicht-leeren String", () => {
    const prose = generateTradecraftProse("deadDrop", 1);
    expect(typeof prose).toBe("string");
    expect(prose.trim().length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleiche Operation und gleichen Seed", () => {
    const a = generateTradecraftProse("brushPass", 7);
    const b = generateTradecraftProse("brushPass", 7);
    expect(a).toBe(b);
  });

  it("beginnt mit dem Namen der Operation", () => {
    const op = TRADECRAFT_OPERATIONS.find((o) => o.id === "dryCleaning")!;
    const prose = generateTradecraftProse("dryCleaning", 3);
    expect(prose.startsWith(`${op.name}:`)).toBe(true);
  });

  it("fällt bei unbekannter Operation auf die erste zurück", () => {
    const fallback = generateTradecraftProse("nichtVorhanden", 5);
    expect(fallback.startsWith(`${TRADECRAFT_OPERATIONS[0].name}:`)).toBe(true);
    expect(fallback.trim().length).toBeGreaterThan(0);
  });

  it("erzeugt über unterschiedliche Seeds unterschiedliche Prosa", () => {
    expect(generateTradecraftProse("deadDrop", 1)).not.toBe(generateTradecraftProse("deadDrop", 2));
  });
});

describe("generateDeadDropTopography — Totbriefkasten-Topografie", () => {
  it("liefert alle geforderten Felder", () => {
    const topo = generateDeadDropTopography(11);
    expect(typeof topo.location).toBe("string");
    expect(topo.location.length).toBeGreaterThan(0);
    expect(typeof topo.method).toBe("string");
    expect(topo.method.length).toBeGreaterThan(0);
    expect(typeof topo.concealment).toBe("string");
    expect(topo.concealment.length).toBeGreaterThan(0);
    expect(typeof topo.retrievalSignal).toBe("string");
    expect(topo.retrievalSignal.length).toBeGreaterThan(0);
    expect(typeof topo.riskLevel).toBe("number");
  });

  it("hält den riskLevel im Bereich [2,8]", () => {
    for (let seed = 0; seed < 50; seed++) {
      const topo = generateDeadDropTopography(seed);
      expect(topo.riskLevel).toBeGreaterThanOrEqual(2);
      expect(topo.riskLevel).toBeLessThanOrEqual(8);
    }
  });

  it("ist deterministisch für denselben Seed", () => {
    expect(generateDeadDropTopography(99)).toEqual(generateDeadDropTopography(99));
  });

  it("liefert für unterschiedliche Seeds unterschiedliche Topografien", () => {
    expect(generateDeadDropTopography(1)).not.toEqual(generateDeadDropTopography(2));
  });
});

describe("createSampleTradecraftOperation und createSampleDeadDrop", () => {
  it("liefert eine gültige Beispiel-Operation", () => {
    const op = createSampleTradecraftOperation();
    expect(op).toEqual(TRADECRAFT_OPERATIONS[0]);
    expect(typeof op.id).toBe("string");
    expect(op.steps.length).toBeGreaterThan(0);
  });

  it("liefert einen gültigen Beispiel-Totbriefkasten", () => {
    const drop = createSampleDeadDrop();
    expect(typeof drop.location).toBe("string");
    expect(typeof drop.method).toBe("string");
    expect(typeof drop.concealment).toBe("string");
    expect(typeof drop.retrievalSignal).toBe("string");
    expect(drop.riskLevel).toBeGreaterThanOrEqual(2);
    expect(drop.riskLevel).toBeLessThanOrEqual(8);
  });

  it("entspricht der Topografie für Seed 0", () => {
    expect(createSampleDeadDrop()).toEqual(generateDeadDropTopography(0));
  });
});
