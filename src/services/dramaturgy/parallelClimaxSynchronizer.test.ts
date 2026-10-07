// @vitest-environment jsdom
/** Tests: ParallelClimaxSynchronizer (WP 93.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createParallelClimax,
  formatSyncProfile,
  createSampleProfile as _createSampleProfile,
  createSampleMatchCut as _createSampleMatchCut,
  type SyncProfile as _SyncProfile,
  type PlotStrand as _PlotStrand,
  type MatchCut as _MatchCut,
} from "./parallelClimaxSynchronizer";

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

describe("createParallelClimax", () => {
  it("erzeugt Profil mit 2-4 Strängen", () => {
    const profile = createParallelClimax("Test", 2, 123);
    expect(profile.strands.length).toBe(2);
    
    const profile3 = createParallelClimax("Test", 3, 123);
    expect(profile3.strands.length).toBe(3);
    
    const profile4 = createParallelClimax("Test", 4, 123);
    expect(profile4.strands.length).toBe(4);
  });

  it("begrenzt Stränge auf Maximum 4", () => {
    const profile = createParallelClimax("Test", 10, 123);
    expect(profile.strands.length).toBe(4);
  });

  it("jedes Strang hat alle Beat-Typen", () => {
    const profile = createParallelClimax("Test", 3, 1);
    for (const strand of profile.strands) {
      expect(strand.beats.length).toBe(6); // setup, complication, crisis, darkNight, climax, resolution
      const types = strand.beats.map(b => b.beatType).sort();
      expect(types).toEqual(["climax", "complication", "crisis", "darkNight", "resolution", "setup"]);
    }
  });

  it("hat globale Klimax", () => {
    const profile = createParallelClimax("Test", 3, 1);
    expect(profile.globalClimaxTimestamp).toBeGreaterThanOrEqual(0);
    expect(profile.globalClimaxTimestamp).toBeLessThanOrEqual(100);
  });

  it("hat Match-Cuts", () => {
    const profile = createParallelClimax("Test", 3, 1);
    expect(profile.matchCuts.length).toBeGreaterThanOrEqual(2);
  });

  it("ist deterministisch", () => {
    const p1 = createParallelClimax("Test", 3, 42);
    const p2 = createParallelClimax("Test", 3, 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Seeds erzeugen verschiedene Synchronisationen", () => {
    const p1 = createParallelClimax("Test", 3, 1);
    const p2 = createParallelClimax("Test", 3, 2);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("formatSyncProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = _createSampleProfile();
    const text = formatSyncProfile(profile);
    expect(text).toContain("PARALLELER KLIMAX-SYNCHRONIZER");
    expect(text).toContain("STRANG");
    expect(text).toContain("MATCH-CUTS");
    expect(text).toContain("Globale Klimax");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = _createSampleProfile();
    expect(profile.name).toBe("Die Schlacht um Eldoria");
    expect(profile.strands.length).toBe(3);
  });
});

describe("createSampleMatchCut", () => {
  it("erzeugt Beispiel-Match-Cut", () => {
    const cut = _createSampleMatchCut();
    expect(cut.fromStrand).toBe("A");
    expect(cut.toStrand).toBe("B");
    expect(cut.trigger).toBeTruthy();
    expect(cut.transitionText).toContain("Schnitt");
  });
});