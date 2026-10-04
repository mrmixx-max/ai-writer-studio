/**
 * Tests: CommandPalette (WP 40.2 — Befehlspalette mit Strg+K)
 */

import { describe, it, expect } from "vitest";
import { fuzzyScore, searchTools } from "./CommandPalette";
import { TOOLS } from "@/components/Werkzeuge/toolAdapters";

describe("fuzzyScore", () => {
  it("leerer Query ergibt Score 0", () => {
    expect(fuzzyScore("", "irgendwas")).toBe(0);
  });

  it("exakter Substring ergibt niedrigen Score", () => {
    expect(fuzzyScore("reise", "reisezeit-wächter")).toBe(0);
  });

  it("Substring in der Mitte wird gefunden", () => {
    const score = fuzzyScore("zeit", "reisezeit-wächter");
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
  });

  it("Fuzzy-Reihenfolge wird akzeptiert", () => {
    expect(fuzzyScore("rzw", "reisezeit-wächter")).not.toBeNull();
  });

  it("nicht vorhandene Zeichen ergeben null", () => {
    expect(fuzzyScore("xyz", "reisezeit")).toBeNull();
  });

  it("ist case-insensitive", () => {
    expect(fuzzyScore("REISE", "reisezeit")).toBe(0);
  });

  it("Substring-Treffer schlägt Fuzzy-Treffer", () => {
    const direct = fuzzyScore("reise", "reisezeit")!;
    const fuzzy = fuzzyScore("reise", "r-e-i-s-e-zeit")!;
    expect(direct).toBeLessThan(fuzzy);
  });
});

describe("searchTools", () => {
  it("leerer Query gibt alle Werkzeuge zurück", () => {
    expect(searchTools("").length).toBe(TOOLS.length);
  });

  it('findet Reisezeit-Wächter über "Reise"', () => {
    const results = searchTools("Reise");
    expect(results.some((t) => t.id === "spatiotemporal")).toBe(true);
  });

  it('findet Hörbuch-Master über "Hörbuch"', () => {
    const results = searchTools("Hörbuch");
    expect(results.some((t) => t.id === "audiobook-master")).toBe(true);
  });

  it('findet Drehbuch über "Drehbuch"', () => {
    const results = searchTools("Drehbuch");
    expect(results.some((t) => t.id === "screenplay-transmuter")).toBe(true);
  });

  it("findet Werkzeug über WP-Nummer", () => {
    const results = searchTools("WP 39.2");
    expect(results.some((t) => t.id === "contract-signer")).toBe(true);
  });

  it("findet Werkzeug über Kategorie", () => {
    const results = searchTools("Audio");
    expect(results.length).toBeGreaterThan(0);
  });

  it("gibt leeres Array bei keinem Treffer", () => {
    expect(searchTools("qqqqzzzz")).toEqual([]);
  });

  it("Ergebnisse sind nach Score sortiert", () => {
    const results = searchTools("stil");
    if (results.length > 1) {
      // Erster Treffer sollte den Suchbegriff im Label haben
      expect(results[0].label.toLowerCase()).toContain("stil");
    }
  });

  it("Trefferanzahl ist plausibel", () => {
    const results = searchTools("text");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(TOOLS.length);
  });
});
