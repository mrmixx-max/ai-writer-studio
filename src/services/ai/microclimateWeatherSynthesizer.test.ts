/**
 * Tests: microclimateWeatherSynthesizer (WP 65.1)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeMicroclimate,
  analyzeBarometricPressure,
  embedScene,
  CLIMATE_LABELS,
  type MicroclimateType,
} from "./microclimateWeatherSynthesizer";

describe("microclimateWeatherSynthesizer", () => {
  const ALL_TYPES: MicroclimateType[] = [
    "swamp-mist",
    "thin-air",
    "catacomb-heat",
    "coastal-fog",
    "desert-scorch",
    "arctic-wind",
  ];

  describe("synthesizeMicroclimate", () => {
    it("erzeugt eine Szene mit Standardwerten", () => {
      const s = synthesizeMicroclimate();
      expect(s.type).toBe("swamp-mist");
      expect(s.label).toBe(CLIMATE_LABELS["swamp-mist"]);
      expect(s.impressions.length).toBe(5);
      expect(s.senseCount).toBe(5);
      expect(s.prose.length).toBeGreaterThan(20);
    });

    it("erzeugt eine Szene für jede Lage", () => {
      for (const type of ALL_TYPES) {
        const s = synthesizeMicroclimate(type);
        expect(s.type).toBe(type);
        expect(s.label).toBe(CLIMATE_LABELS[type]);
        expect(s.impressions.length).toBe(5);
        expect(s.senseCount).toBe(5);
      }
    });

    it("aktiviert alle 5 Sinne", () => {
      const s = synthesizeMicroclimate("coastal-fog");
      const senses = s.impressions.map((i) => i.sense);
      expect(senses).toContain("sight");
      expect(senses).toContain("sound");
      expect(senses).toContain("smell");
      expect(senses).toContain("taste");
      expect(senses).toContain("touch");
    });

    it("hat einen barometrischen Druck", () => {
      const s = synthesizeMicroclimate("thin-air");
      expect(s.pressureHpa).toBeLessThan(700);
    });

    it("hat ein Körperempfinden", () => {
      const s = synthesizeMicroclimate("desert-scorch");
      expect(s.bodyFeeling.length).toBeGreaterThan(10);
    });

    it("ist deterministisch", () => {
      const a = synthesizeMicroclimate("arctic-wind");
      const b = synthesizeMicroclimate("arctic-wind");
      expect(a.prose).toBe(b.prose);
      expect(a.pressureHpa).toBe(b.pressureHpa);
    });

    it("kommt mit null zurecht", () => {
      const s = synthesizeMicroclimate(null);
      expect(s.type).toBe("swamp-mist");
    });

    it("kommt mit ungültigem Typ zurecht", () => {
      const s = synthesizeMicroclimate("invalid" as MicroclimateType);
      expect(s.type).toBe("swamp-mist");
    });
  });

  describe("analyzeBarometricPressure", () => {
    it("erkennt niedrigen Druck", () => {
      const a = analyzeBarometricPressure(980);
      expect(a.category).toBe("low");
      expect(a.bodyFeeling).toContain("Schläfen");
      expect(a.foreboding).toContain("Sturm");
    });

    it("erkennt normalen Druck", () => {
      const a = analyzeBarometricPressure(1013);
      expect(a.category).toBe("normal");
    });

    it("erkennt hohen Druck", () => {
      const a = analyzeBarometricPressure(1025);
      expect(a.category).toBe("high");
    });

    it("verwendet den Lagen-Druck ohne Angaben", () => {
      const a = analyzeBarometricPressure(null, "thin-air");
      expect(a.pressureHpa).toBeLessThan(700);
    });

    it("kommt mit null zurecht", () => {
      const a = analyzeBarometricPressure(null, null);
      expect(a.pressureHpa).toBeGreaterThan(0);
    });
  });

  describe("embedScene", () => {
    it("bettet die Szene in einen bestehenden Text ein", () => {
      const s = synthesizeMicroclimate("coastal-fog");
      const text = "Der Hafen war still.";
      const result = embedScene(s, text);
      expect(result).toContain(text);
      expect(result).toContain(s.prose);
    });

    it("gibt nur die Szene zurück ohne Text", () => {
      const s = synthesizeMicroclimate("swamp-mist");
      const result = embedScene(s, null);
      expect(result).toBe(s.prose);
    });

    it("kommt mit leerem Text zurecht", () => {
      const s = synthesizeMicroclimate("desert-scorch");
      const result = embedScene(s, "");
      expect(result).toBe(s.prose);
    });

    it("kommt mit null-Szene zurecht", () => {
      const result = embedScene(null, "Text");
      expect(result).toBe("");
    });
  });

  describe("CLIMATE_LABELS", () => {
    it("enthält alle Lagen", () => {
      expect(Object.keys(CLIMATE_LABELS).length).toBe(6);
    });
  });
});
