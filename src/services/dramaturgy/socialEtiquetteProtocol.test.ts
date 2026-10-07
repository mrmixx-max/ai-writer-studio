// @vitest-environment jsdom
/** Tests: SocialEtiquetteProtocol (WP 86.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createProtocol,
  checkGreeting,
  scanTextForViolations,
  calculateScandalIndex,
  createCourtCharacter,
  createSampleProtocol,
  createSampleViolation,
  createSampleCharacter,
  type CourtProtocol as _CourtProtocol,
  type ProtocolViolation as _ProtocolViolation,
  type TitleRank as _TitleRank,
  type GreetingRule as _GreetingRule,
} from "./socialEtiquetteProtocol";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("createProtocol", () => {
  it("erzeugt Protokoll mit allen Rängen", () => {
    const p = createProtocol("Test", 123);
    expect(p.name).toContain("Kaiserlicher Hofprotokoll");
    expect(Object.keys(p.titles).length).toBe(12);
    expect(p.greetingRules.length).toBeGreaterThan(0);
    expect(p.taboos.length).toBeGreaterThan(0);
    expect(p.scandalThresholds.length).toBe(7);
  });

  it("ist deterministisch", () => {
    const p1 = createProtocol("A", 1);
    const p2 = createProtocol("A", 1);
    expect(p1).toEqual(p2);
  });
});

describe("checkGreeting", () => {
  const protocol = createSampleProtocol();

  it("erlaubt korrekte Anrede und Geste", () => {
    const result = checkGreeting(protocol, "ritter", "herzog", "tiefer_bucks", ["Eure Gnaden"]);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("erkennt falsche Geste", () => {
    const result = checkGreeting(protocol, "ritter", "herzog", "kopfnicken", ["Eure Gnaden"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Geste"))).toBe(true);
  });

  it("erkennt fehlende Pflicht-Anrede", () => {
    const result = checkGreeting(protocol, "ritter", "herzog", "tiefer_bucks", ["Mylord"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Fehlende"))).toBe(true);
  });

  it("erkennt verbotene Anrede", () => {
    const result = checkGreeting(protocol, "ritter", "herzog", "tiefer_bucks", ["Eure Gnaden", "Du"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Verbotene"))).toBe(true);
  });

  it("gibt valid=true für unbekannte Rang-Kombination", () => {
    const result = checkGreeting(protocol, "bürger", "diener", "egal", ["Hey"]);
    expect(result.valid).toBe(true);
  });
});

describe("scanTextForViolations", () => {
  const protocol = createSampleProtocol();

  it("findet Duzen-Verstoß", () => {
    const violations = scanTextForViolations(protocol, "Du bist ein Narr!", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].violationType).toBe("anrede");
    expect(violations[0].severity).toBe("schwer");
  });

  it("findet keine Verstöße bei korrekter Anrede", () => {
    const violations = scanTextForViolations(protocol, "Eure Gnaden, ich diene.", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    const duzenViolations = violations.filter(v => v.violationType === "anrede" && v.description.includes("Du"));
    expect(duzenViolations.length).toBe(0);
  });

  it("berücksichtigt Kontext", () => {
    const violationsAudienz = scanTextForViolations(protocol, "Du Narr!", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    const violationsTafel = scanTextForViolations(protocol, "Du Narr!", "Ritter", "ritter", "Herzog", "herzog", "tafel");
    expect(violationsAudienz.length).toBeGreaterThanOrEqual(violationsTafel.length);
  });

  it("gibt deterministische Ergebnisse", () => {
    const v1 = scanTextForViolations(protocol, "Du Narr!", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    const v2 = scanTextForViolations(protocol, "Du Narr!", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    expect(v1).toEqual(v2);
  });

  it("skaliert Skandal-Score mit Rang", () => {
    const vRitter = scanTextForViolations(protocol, "Du Narr!", "Ritter", "ritter", "Herzog", "herzog", "audienz");
    const vGraf = scanTextForViolations(protocol, "Du Narr!", "Graf", "graf", "Herzog", "herzog", "audienz");
    expect(vGraf[0]?.scandalScore).toBeGreaterThanOrEqual(vRitter[0]?.scandalScore ?? 0);
  });
});

describe("calculateScandalIndex", () => {
  it("gibt 0 für leeres Array", () => {
    expect(calculateScandalIndex([])).toBe(0);
  });

  it("summiert Scores und berücksichtigt Gossip", () => {
      const violations: _ProtocolViolation[] = [
      { id: "1", violator: "A", violatorRank: "ritter", victim: "B", victimRank: "herzog", violationType: "anrede", description: "", context: "audienz", severity: "schwer", scandalScore: 20, gossipSpread: 30, reputationDamage: 15 },
      { id: "2", violator: "C", violatorRank: "graf", victim: "D", victimRank: "herzog", violationType: "geste", description: "", context: "tafel", severity: "mittel", scandalScore: 25, gossipSpread: 40, reputationDamage: 20 },
    ];
    const index = calculateScandalIndex(violations);
    expect(index).toBeGreaterThan(45);
    expect(index).toBeLessThan(1000);
  });
});

describe("createCourtCharacter", () => {
  it("erzeugt Charakter mit allen Feldern", () => {
    const char = createCourtCharacter("Test", "graf", "Haus Test", 42);
    expect(char.name).toBe("Test");
    expect(char.rank).toBe("graf");
    expect(char.house).toBe("Haus Test");
    expect(char.reputation).toBeGreaterThanOrEqual(50);
    expect(char.reputation).toBeLessThanOrEqual(90);
    expect(char.knownViolations).toEqual([]);
  });

  it("ist deterministisch", () => {
    const c1 = createCourtCharacter("X", "ritter", "Y", 1);
    const c2 = createCourtCharacter("X", "ritter", "Y", 1);
    expect(c1).toEqual(c2);
  });
});

describe("createSampleProtocol", () => {
  it("erzeugt Beispiel-Protokoll", () => {
    const p = createSampleProtocol();
    expect(p.name).toContain("Beispiel");
  });
});

describe("createSampleViolation", () => {
  it("erzeugt Beispiel-Verletzung", () => {
    const v = createSampleViolation();
    expect(v.id).toContain("viol-");
    expect(v.violatorRank).toBe("ritter");
    expect(v.victimRank).toBe("herzog");
  });
});

describe("createSampleCharacter", () => {
  it("erzeugt Beispiel-Charakter", () => {
    const c = createSampleCharacter();
    expect(c.name).toBe("Graf Valerius");
    expect(c.rank).toBe("graf");
    expect(c.house).toBe("Haus Falkenhorst");
  });
});