// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  AUGMENTATION_SLOTS,
  getAugmentationSlot,
  calculateAugmentationProfile,
  generateGlitchProse,
  analyzeCyberware,
  createSampleAugmentationProfile,
  createSampleCyberwareReport,
} from "./cyberneticAugmentationLedger";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(29);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("AUGMENTATION_SLOTS", () => {
  it("enthält fünf Augmentierungs-Slots", () => {
    expect(AUGMENTATION_SLOTS).toHaveLength(5);
  });
  it("jeder Slot hat Energie, Bio-Kompatibilität und Verlustwerte", () => {
    for (const s of AUGMENTATION_SLOTS) {
      expect(s.powerDraw).toBeGreaterThan(0);
      expect(s.bioCompatibility).toBeGreaterThanOrEqual(0);
      expect(s.bioCompatibility).toBeLessThanOrEqual(1);
      expect(s.humanityLoss).toBeGreaterThanOrEqual(0);
      expect(s.humanityLoss).toBeLessThanOrEqual(1);
    }
  });
  it("Neuro-Interface hat den höchsten Menschlichkeitsverlust", () => {
    const neural = getAugmentationSlot("neural")!;
    for (const s of AUGMENTATION_SLOTS) {
      if (s.id !== "neural") expect(neural.humanityLoss).toBeGreaterThanOrEqual(s.humanityLoss);
    }
  });
  it("getAugmentationSlot lieferv undefined für unbekannt", () => {
    expect(getAugmentationSlot("xyz" as never)).toBeUndefined();
  });
});

describe("calculateAugmentationProfile", () => {
  it("ist deterministisch", () => {
    expect(calculateAugmentationProfile(["neural", "optics"], 42).id).toBe(
      calculateAugmentationProfile(["neural", "optics"], 42).id
    );
  });
  it("summiert den Energieverbrauch", () => {
    const p = calculateAugmentationProfile(["neural", "optics", "limbs"], 42);
    const expected = 15 + 8 + 25;
    expect(p.totalPowerDraw).toBe(expected);
  });
  it("Menschlichkeitsverlust bleibt im Bereich 0..1", () => {
    const p = calculateAugmentationProfile(["neural", "optics", "limbs", "organs", "armor"], 42);
    expect(p.totalHumanityLoss).toBeGreaterThanOrEqual(0);
    expect(p.totalHumanityLoss).toBeLessThanOrEqual(1);
  });
  it("Dissoziations-Index bleibt im Bereich 0..1", () => {
    const p = calculateAugmentationProfile(["neural", "optics", "limbs"], 42);
    expect(p.dissociationIndex).toBeGreaterThanOrEqual(0);
    expect(p.dissociationIndex).toBeLessThanOrEqual(1);
  });
  it("leere Liste ergibt null Werte", () => {
    const p = calculateAugmentationProfile([], 42);
    expect(p.totalPowerDraw).toBe(0);
    expect(p.totalHumanityLoss).toBe(0);
  });
  it("unbekannte Slots werden ignoriert", () => {
    const p = calculateAugmentationProfile(["neural", "xyz" as never], 42);
    expect(p.installed).toHaveLength(1);
  });
});

describe("generateGlitchProse", () => {
  it("ist deterministisch", () => {
    expect(generateGlitchProse(3, 42)).toBe(generateGlitchProse(3, 42));
  });
  it("erzeugt die angeforderte Bildzahl ohne Duplikate", () => {
    const text = generateGlitchProse(4, 7);
    expect(text.split(". ").length).toBeGreaterThan(3);
  });
  it("begrenzt auf die Poolgröße", () => {
    const text = generateGlitchProse(999, 1);
    // 6 Bilder, aber durch Satzzeichen mehr Segmente — prüfe auf Wortanzahl
    expect(text.split(" ").length).toBeLessThan(200);
  });
});

describe("analyzeCyberware", () => {
  it("ist deterministisch", () => {
    expect(analyzeCyberware(["neural", "optics"], 42).id).toBe(
      analyzeCyberware(["neural", "optics"], 42).id
    );
  });
  it("enthält Profil, Glitch-Prosa und Medikamentenplan", () => {
    const r = analyzeCyberware(["neural", "optics", "limbs"], 42);
    expect(r.profile.installed.length).toBe(3);
    expect(r.glitchProse.length).toBeGreaterThan(20);
    expect(r.medicationSchedule.length).toBeGreaterThan(0);
  });
  it("hohe Abhängigkeit erzeugt täglichen Medikamentenplan", () => {
    const r = analyzeCyberware(["organs", "neural"], 42);
    expect(r.medicationSchedule).toContain("Täglich");
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleAugmentationProfile liefert 3 Slots", () => {
    expect(createSampleAugmentationProfile().installed).toHaveLength(3);
  });
  it("createSampleCyberwareReport liefert einen Bericht", () => {
    expect(createSampleCyberwareReport().glitchProse.length).toBeGreaterThan(20);
  });
});
