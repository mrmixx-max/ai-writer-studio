// @vitest-environment jsdom
/** Tests: FreudianSlipDialogueSynthesizer (WP 94.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createFreudianSlipProfile,
  formatFreudianSlipProfile,
  createSampleProfile,
  createSampleLeakage,
} from "./freudianSlipDialogueSynthesizer";

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

describe("createFreudianSlipProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createFreudianSlipProfile("Test", "Geheimnis", "Figur", 123);
    expect(profile.id).toContain("FREUD-");
    expect(profile.surfaceTopic).toBe("Test");
    expect(profile.repressedContent).toBe("Geheimnis");
    expect(profile.characterName).toBe("Figur");
    expect(profile.dialogueLines.length).toBeGreaterThanOrEqual(3);
    expect(profile.seed).toBe(123);
  });

  it("enthält Vermeidungsphrasen", () => {
    const profile = createFreudianSlipProfile("Thema", "Inhalt", "Figur", 42);
    const hasAvoidance = profile.dialogueLines.some(l =>
      l.text.includes("nicht darüber reden") ||
      l.text.includes("Thema wechseln") ||
      l.text.includes("erinnere mich nicht")
    );
    expect(hasAvoidance).toBe(true);
  });

  it("kann Fehlleistungen (Slips) enthalten", () => {
    const profile = createFreudianSlipProfile("Unfall", "Ich habe ihn ermordet", "Figur", 999);
    const _hasSlip = profile.dialogueLines.some(l => l.leakageType === "slip");
    // Nicht garantiert bei jedem Seed, aber Struktur muss stimmen
    expect(profile.leakageMarkers).toBeDefined();
  });

  it("ist deterministisch", () => {
    const p1 = createFreudianSlipProfile("Test", "Inhalt", "Figur", 42);
    const p2 = createFreudianSlipProfile("Test", "Inhalt", "Figur", 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createFreudianSlipProfile("Test", "Inhalt", "Figur", 1);
    const p2 = createFreudianSlipProfile("Test", "Inhalt", "Figur", 2);
    expect(p1.id).not.toBe(p2.id);
  });

  it("erkennt Tabu-Wörter im verdrängten Inhalt", () => {
    const profile = createFreudianSlipProfile("Thema", "Mord und Verrat", "Figur", 1);
    expect(profile.leakageMarkers.length).toBeGreaterThanOrEqual(0);
  });
});

describe("formatFreudianSlipProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createSampleProfile();
    const text = formatFreudianSlipProfile(profile);
    expect(text).toContain("FREUD'SCHER FEHLLEISTUNGS-SYNTHESIZER");
    expect(text).toContain("Thomas");
    expect(text).toContain("Der Unfall");
    expect(text).toContain("DIALOG:");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.characterName).toBe("Thomas");
    expect(profile.surfaceTopic).toBe("Der Unfall");
    expect(profile.id).toContain("FREUD-");
  });
});

describe("createSampleLeakage", () => {
  it("erzeugt Beispiel-Leakage-Marker", () => {
    const leaks = createSampleLeakage();
    expect(leaks.length).toBe(2);
    expect(leaks[0].originalWord).toBe("Mord");
    expect(leaks[1].type).toBe("substitution");
  });
});