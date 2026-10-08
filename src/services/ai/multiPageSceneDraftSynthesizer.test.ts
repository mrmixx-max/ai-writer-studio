// @vitest-environment jsdom
/** Tests: MultiPageSceneDraftSynthesizer (WP 95.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createMultiPageSceneProfile,
  formatMultiPageSceneProfile,
  createSampleProfile,
  createSampleConsistencyReport,
} from "./multiPageSceneDraftSynthesizer";

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

  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    let different = false;
    for (let i = 0; i < 10; i++) if (r1() !== r2()) different = true;
    expect(different).toBe(true);
  });
});

describe("createMultiPageSceneProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createMultiPageSceneProfile(
      ["Punkt 1", "Punkt 2"],
      "Held",
      1500,
      123
    );
    expect(profile.id).toContain("MULTI-");
    expect(profile.seedPoints).toEqual(["Punkt 1", "Punkt 2"]);
    expect(profile.protagonistName).toBe("Held");
    expect(profile.protagonistTraits.length).toBeGreaterThan(0);
    expect(profile.sceneWordCount).toBeGreaterThan(0);
    expect(profile.scenePages.length).toBe(6);
    expect(profile.fullText).toBeTruthy();
    expect(profile.consistencyReport).toBeDefined();
    expect(profile.seed).toBe(123);
  });

  it("erzeugt 6 Seiten mit korrekten Fokus-Typen", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Test", 1500, 1);
    expect(profile.scenePages.length).toBe(6);
    const focuses = profile.scenePages.map(p => p.focus);
    expect(focuses[0]).toBe("opening");
    expect(focuses[1]).toBe("rising");
    expect(focuses[2]).toBe("rising");
    expect(focuses[3]).toBe("climax");
    expect(focuses[4]).toBe("falling");
    expect(focuses[5]).toBe("resolution");
  });

  it("jede Seite hat sensorische Details", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Test", 1500, 10);
    for (const page of profile.scenePages) {
      expect(page.sensoryDetails.length).toBeGreaterThanOrEqual(2);
      expect(page.sensoryDetails.length).toBeLessThanOrEqual(5);
      for (const sensory of page.sensoryDetails) {
        expect(["sight", "sound", "smell", "touch", "taste", "proprioception"]).toContain(sensory.sense);
        expect(typeof sensory.intensity).toBe("number");
      }
    }
  });

  it("jede Seite hat POV-Marker", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Test", 1500, 10);
    for (const page of profile.scenePages) {
      expect(page.povMarkers.length).toBeGreaterThanOrEqual(2);
      for (const pov of page.povMarkers) {
        expect(["thought", "memory", "sensation", "judgment", "limitation"]).toContain(pov.type);
        expect(typeof pov.position).toBe("number");
      }
    }
  });

  it("Konsistenz-Prüfung hat alle Felder", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Test", 1500, 1);
    const r = profile.consistencyReport;
    expect(typeof r.povConsistent).toBe("boolean");
    expect(r.traitAdherence).toBeGreaterThanOrEqual(0);
    expect(r.traitAdherence).toBeLessThanOrEqual(1);
    expect(r.sensoryCoverage).toBeGreaterThanOrEqual(0);
    expect(r.sensoryCoverage).toBeLessThanOrEqual(1);
    expect(typeof r.knowledgeBoundariesRespected).toBe("boolean");
    expect(Array.isArray(r.issues)).toBe(true);
  });

  it("ist deterministisch", () => {
    const p1 = createMultiPageSceneProfile(["Punkt A", "Punkt B"], "Held", 1500, 42);
    const p2 = createMultiPageSceneProfile(["Punkt A", "Punkt B"], "Held", 1500, 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createMultiPageSceneProfile(["Test"], "Test", 1500, 1);
    const p2 = createMultiPageSceneProfile(["Test"], "Test", 1500, 2);
    expect(p1.id).not.toBe(p2.id);
  });

  it("Protagonist-Name taucht im Text auf", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Elias", 1500, 1);
    const nameCount = (profile.fullText.match(/Elias/gi) || []).length;
    expect(nameCount).toBeGreaterThan(0);
  });

  it("Ziel-Wortzahl wird approximiert erreicht", () => {
    const profile = createMultiPageSceneProfile(["Test"], "Test", 2000, 1);
    expect(profile.sceneWordCount).toBeGreaterThan(1000);
    expect(profile.sceneWordCount).toBeLessThan(4000);
  });
});

describe("formatMultiPageSceneProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createSampleProfile();
    const text = formatMultiPageSceneProfile(profile);
    expect(text).toContain("AUTONOMER MEHRSEITEN-SZENEN-SYNTHESIZER");
    expect(text).toContain("Elias");
    expect(text).toContain("KONSISTENZ-PRÜFUNG:");
    expect(text).toContain("SEITENÜBERSICHT:");
    expect(text).toContain("VOLLTEXT");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.protagonistName).toBe("Elias");
    expect(profile.seedPoints.length).toBe(3);
    expect(profile.id).toContain("MULTI-");
  });
});

describe("createSampleConsistencyReport", () => {
  it("erzeugt Beispiel-Konsistenz-Bericht", () => {
    const report = createSampleConsistencyReport();
    expect(report.povConsistent).toBe(true);
    expect(report.traitAdherence).toBe(0.8);
    expect(report.issues.length).toBe(0);
  });
});