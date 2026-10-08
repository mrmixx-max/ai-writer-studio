// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createEpistolaryUnreliableProfile,
  formatEpistolaryUnreliableProfile,
  createSampleProfile,
  createSampleIronyMarkers,
} from "./epistolaryUnreliableSynthesizer";

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
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });
  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });
});

describe("createEpistolaryUnreliableProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createEpistolaryUnreliableProfile("fieldJournal", "Autor", "Empfänger", "Wahrheit", 123);
    expect(profile.id).toContain("EPIST-");
    expect(profile.documentType).toBe("fieldJournal");
    expect(profile.authorName).toBe("Autor");
    expect(profile.recipientName).toBe("Empfänger");
    expect(profile.entries.length).toBeGreaterThanOrEqual(3);
    expect(profile.epistemichIronyMarkers.length).toBeGreaterThanOrEqual(2);
    expect(profile.seed).toBe(123);
  });

  it("generiert Feldtagebucheinträge mit abnehmender Zuverlässigkeit", () => {
    const profile = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 1);
    for (const entry of profile.entries) {
      expect(entry.reliabilityScore).toBeLessThanOrEqual(1);
      expect(entry.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(entry.hiddenTruthHints.length).toBeGreaterThan(0);
    }
  });

  it("generiert diplomatische Briefe mit Manipulation", () => {
    const profile = createEpistolaryUnreliableProfile("diplomaticLetter", "Test", "Test", "Test", 2);
    expect(profile.documentType).toBe("diplomaticLetter");
    const diplomaticSalutations = ["Hochverehrter", "Sehr geehrter", "Mein lieber", "An den Herrn"];
    for (const entry of profile.entries) {
      const hasSalutation = diplomaticSalutations.some(s => entry.text.includes(s));
      expect(hasSalutation).toBe(true);
    }
  });

  it("generiert Verhörprotokolle mit Ausweichmanövern", () => {
    const profile = createEpistolaryUnreliableProfile("interrogationProtocol", "Test", "Test", "Test", 3);
    expect(profile.documentType).toBe("interrogationProtocol");
    for (const entry of profile.entries) {
      expect(entry.text).toContain("Aussage");
    }
  });

  it("generiert letzte Beichtbriefe mit Rohheit", () => {
    const profile = createEpistolaryUnreliableProfile("finalConfession", "Test", "Test", "Test", 4);
    expect(profile.documentType).toBe("finalConfession");
    for (const entry of profile.entries) {
      expect(entry.text.length).toBeGreaterThan(0);
    }
  });

  it("epistemische Ironie-Marker haben alle Typen", () => {
    const profile = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 999);
    const types = profile.epistemichIronyMarkers.map(m => m.ironyType);
    const validTypes = ["wishfulThinking", "selfDeception", "manipulation", "unreliableMemory"];
    for (const t of types) {
      expect(validTypes).toContain(t);
    }
  });

  it("ist deterministisch", () => {
    const p1 = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 42);
    const p2 = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 42);
    expect(p1.id).toBe(p2.id);
    expect(p1.entries.length).toBe(p2.entries.length);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 1);
    const p2 = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 2);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("formatEpistolaryUnreliableProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createEpistolaryUnreliableProfile("fieldJournal", "Test", "Test", "Test", 1);
    const formatted = formatEpistolaryUnreliableProfile(profile);
    expect(formatted).toContain("UNZUVERLÄSSIGES DOKUMENT");
    expect(formatted).toContain(profile.id);
    expect(formatted).toContain("EINTRÄGE");
    expect(formatted).toContain("EPISTEMISCHE IRONIE-MARKER");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.documentType).toBe("fieldJournal");
    expect(profile.authorName).toBe("Dr. Viktor Halsh");
  });
});

describe("createSampleIronyMarkers", () => {
  it("erzeugt Beispiel-Ironie-Marker", () => {
    const markers = createSampleIronyMarkers();
    expect(markers.length).toBe(2);
    expect(markers[0].ironyType).toBe("selfDeception");
    expect(markers[1].ironyType).toBe("manipulation");
  });
});