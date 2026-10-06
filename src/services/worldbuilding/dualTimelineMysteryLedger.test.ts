/**
 * Tests: DualTimelineMysteryLedger (WP 72.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createEmptyLedger,
  createSampleLedger,
  addEvent,
  addEvidence,
  addSuspect,
  addChain,
  getEventsByTimeline,
  getEvidenceByTimeline,
  getContradictions,
  getEvidenceForSuspect,
  computeChainStrength,
  findStrongestChain,
  findPrimeSuspect,
  hasContradictoryAlibi,
  formatLedgerReport,
  type TimelineEvent,
  type Evidence,
  type Suspect,
  type EvidenceChain,
} from "./dualTimelineMysteryLedger";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("liefert unterschiedliche Werte für unterschiedliche Inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("createEmptyLedger", () => {
  it("erstellt leere Ledger", () => {
    const ledger = createEmptyLedger();
    expect(ledger.events).toEqual([]);
    expect(ledger.evidence).toEqual([]);
    expect(ledger.suspects).toEqual([]);
    expect(ledger.chains).toEqual([]);
  });
});

describe("createSampleLedger", () => {
  it("erstellt Beispiel-Ledger mit Daten", () => {
    const ledger = createSampleLedger();
    expect(ledger.events.length).toBeGreaterThan(0);
    expect(ledger.evidence.length).toBeGreaterThan(0);
    expect(ledger.suspects.length).toBeGreaterThan(0);
    expect(ledger.chains.length).toBeGreaterThan(0);
  });

  it("hat Ereignisse auf beiden Zeitachsen", () => {
    const ledger = createSampleLedger();
    expect(getEventsByTimeline(ledger, "past").length).toBeGreaterThan(0);
    expect(getEventsByTimeline(ledger, "present").length).toBeGreaterThan(0);
  });
});

describe("addEvent", () => {
  it("fügt Ereignis hinzu", () => {
    const ledger = createEmptyLedger();
    const event: TimelineEvent = {
      id: "ev-1",
      timeline: "past",
      chapter: 1,
      title: "Test",
      description: "Beschreibung",
      involvedCharacters: [],
      relatedEvidenceIds: [],
    };
    const updated = addEvent(ledger, event);
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0].id).toBe("ev-1");
  });

  it("verändert nicht die Original-Ledger", () => {
    const ledger = createEmptyLedger();
    const event: TimelineEvent = {
      id: "ev-1",
      timeline: "past",
      chapter: 1,
      title: "Test",
      description: "Beschreibung",
      involvedCharacters: [],
      relatedEvidenceIds: [],
    };
    addEvent(ledger, event);
    expect(ledger.events).toHaveLength(0);
  });
});

describe("addEvidence", () => {
  it("fügt Indiz hinzu", () => {
    const ledger = createEmptyLedger();
    const evidence: Evidence = {
      id: "clue-1",
      name: "Handschuh",
      description: "Blutig",
      foundAtChapter: 1,
      timeline: "past",
      credibility: 80,
      relatedSuspectIds: [],
      contradictsEvidenceIds: [],
    };
    const updated = addEvidence(ledger, evidence);
    expect(updated.evidence).toHaveLength(1);
  });
});

describe("addSuspect", () => {
  it("fügt Verdächtigen hinzu", () => {
    const ledger = createEmptyLedger();
    const suspect: Suspect = {
      id: "suspect-1",
      name: "Butler",
      motive: "Erbe",
      alibi: "Garten",
      alibiStrength: 30,
      relatedEvidenceIds: [],
      isGuilty: true,
    };
    const updated = addSuspect(ledger, suspect);
    expect(updated.suspects).toHaveLength(1);
  });
});

describe("addChain", () => {
  it("fügt Beweiskette hinzu", () => {
    const ledger = createEmptyLedger();
    const chain: EvidenceChain = {
      id: "chain-1",
      name: "Kette",
      evidenceIds: [],
      conclusion: "Schluss",
      strength: 0,
    };
    const updated = addChain(ledger, chain);
    expect(updated.chains).toHaveLength(1);
  });
});

describe("getEventsByTimeline", () => {
  it("filtert Vergangenheit", () => {
    const ledger = createSampleLedger();
    const past = getEventsByTimeline(ledger, "past");
    expect(past.every((e) => e.timeline === "past")).toBe(true);
  });

  it("filtert Gegenwart", () => {
    const ledger = createSampleLedger();
    const present = getEventsByTimeline(ledger, "present");
    expect(present.every((e) => e.timeline === "present")).toBe(true);
  });
});

describe("getEvidenceByTimeline", () => {
  it("filtert Indizien nach Zeitachse", () => {
    const ledger = createSampleLedger();
    const past = getEvidenceByTimeline(ledger, "past");
    expect(past.every((e) => e.timeline === "past")).toBe(true);
  });
});

describe("getContradictions", () => {
  it("findet widersprüchliche Indizien", () => {
    const ledger = createSampleLedger();
    const contradictions = getContradictions(ledger, "clue-3");
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it("findet keine Widersprüche für unbekanntes Indiz", () => {
    const ledger = createSampleLedger();
    expect(getContradictions(ledger, "unknown")).toEqual([]);
  });
});

describe("getEvidenceForSuspect", () => {
  it("findet Indizien für Verdächtigen", () => {
    const ledger = createSampleLedger();
    const evidence = getEvidenceForSuspect(ledger, "suspect-1");
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("findet keine Indizien für unbekannten Verdächtigen", () => {
    const ledger = createSampleLedger();
    expect(getEvidenceForSuspect(ledger, "unknown")).toEqual([]);
  });
});

describe("computeChainStrength", () => {
  it("berechnet Stärke basierend auf Glaubwürdigkeit", () => {
    const ledger = createSampleLedger();
    const chain = ledger.chains[0];
    const strength = computeChainStrength(ledger, chain);
    expect(strength).toBeGreaterThanOrEqual(0);
    expect(strength).toBeLessThanOrEqual(100);
  });

  it("gibt 0 für leere Kette", () => {
    const ledger = createEmptyLedger();
    const chain: EvidenceChain = {
      id: "chain-1",
      name: "Leer",
      evidenceIds: [],
      conclusion: "",
      strength: 0,
    };
    expect(computeChainStrength(ledger, chain)).toBe(0);
  });
});

describe("findStrongestChain", () => {
  it("findet die stärkste Kette", () => {
    const ledger = createSampleLedger();
    const strongest = findStrongestChain(ledger);
    expect(strongest).not.toBeNull();
  });

  it("gibt null für leere Ledger", () => {
    const ledger = createEmptyLedger();
    expect(findStrongestChain(ledger)).toBeNull();
  });
});

describe("findPrimeSuspect", () => {
  it("findet den Hauptverdächtigen", () => {
    const ledger = createSampleLedger();
    const prime = findPrimeSuspect(ledger);
    expect(prime).not.toBeNull();
    expect(prime!.name).toBe("Der Butler");
  });

  it("gibt null für leere Ledger", () => {
    const ledger = createEmptyLedger();
    expect(findPrimeSuspect(ledger)).toBeNull();
  });
});

describe("hasContradictoryAlibi", () => {
  it("erkennt widersprüchliches Alibi", () => {
    const ledger = createSampleLedger();
    expect(hasContradictoryAlibi(ledger, "suspect-1")).toBe(true);
  });

  it("erkennt kein widersprüchliches Alibi bei starkem Alibi", () => {
    const ledger = createSampleLedger();
    expect(hasContradictoryAlibi(ledger, "suspect-2")).toBe(false);
  });

  it("gibt false für unbekannten Verdächtigen", () => {
    const ledger = createSampleLedger();
    expect(hasContradictoryAlibi(ledger, "unknown")).toBe(false);
  });
});

describe("formatLedgerReport", () => {
  it("formatiert Bericht", () => {
    const ledger = createSampleLedger();
    const report = formatLedgerReport(ledger);
    expect(report).toContain("INDIZIEN-HAUPTBUCH");
    expect(report).toContain("EREIGNISSE");
    expect(report).toContain("INDIZIEN");
    expect(report).toContain("VERDÄCHTIGE");
  });

  it("nennt Hauptverdächtigen", () => {
    const ledger = createSampleLedger();
    const report = formatLedgerReport(ledger);
    expect(report).toContain("HAUPTVERDÄCHTIGER");
  });

  it("nennt stärkste Beweiskette", () => {
    const ledger = createSampleLedger();
    const report = formatLedgerReport(ledger);
    expect(report).toContain("STERKSTE BEWEISKETTE");
  });
});
