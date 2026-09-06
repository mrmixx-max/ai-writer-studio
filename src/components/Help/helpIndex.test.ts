// Tests: Hilfe-Index Vollständigkeit + Suche + EN-Fallback (Sprint 10, Agent 4).
import { describe, it, expect } from "vitest";
import {
  HELP_ENTRIES,
  HELP_IDS,
  getHelpEntry,
  helpBody,
  helpTitle,
  searchHelp,
} from "./helpIndex";

describe("helpIndex — Vollständigkeit", () => {
  it("enthält mindestens 8 Einträge", () => {
    expect(HELP_ENTRIES.length).toBeGreaterThanOrEqual(8);
  });

  it("jeder Eintrag hat id, title, body, titleEn, bodyEn und keywords", () => {
    for (const e of HELP_ENTRIES) {
      expect(e.id.trim().length).toBeGreaterThan(0);
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.body.trim().length).toBeGreaterThan(20);
      expect(e.titleEn.trim().length).toBeGreaterThan(0);
      expect(e.bodyEn.trim().length).toBeGreaterThan(20);
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(e.keywords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("IDs sind eindeutig und HELP_IDS passt", () => {
    const ids = HELP_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HELP_IDS).toEqual(ids);
  });

  it("Pflicht-Themen sind abgedeckt (Ollama/CORS, BookWriter, KDP, Update)", () => {
    const all = HELP_ENTRIES.map((e) => e.id).join(" ");
    for (const must of ["ollama", "cors", "bookwriter", "kdp", "update"]) {
      expect(
        HELP_ENTRIES.some(
          (e) =>
            e.id.includes(must) ||
            e.keywords.some((k) => k.includes(must)),
        ),
        `Thema fehlt: ${must} (${all})`,
      ).toBe(true);
    }
  });
});

describe("helpIndex — Suche und Fallback", () => {
  it("leere Query liefert alle Einträge", () => {
    expect(searchHelp("").length).toBe(HELP_ENTRIES.length);
    expect(searchHelp("   ").length).toBe(HELP_ENTRIES.length);
  });

  it("Suche findet CORS-Eintrag über Keyword und über EN-Begriff", () => {
    expect(searchHelp("OLLAMA_ORIGINS").some((e) => e.id === "ollama-cors")).toBe(true);
    expect(searchHelp("cors").some((e) => e.id === "ollama-cors")).toBe(true);
  });

  it("Suche ist case-insensitiv und findet KDP über Titel", () => {
    expect(searchHelp("kdp").length).toBeGreaterThanOrEqual(1);
    expect(searchHelp("KDP").length).toBe(searchHelp("kdp").length);
  });

  it("unbekannte Query liefert leere Liste", () => {
    expect(searchHelp("zz-quartet-xyz-unbekannt")).toEqual([]);
  });

  it("getHelpEntry + EN-Fallback funktionieren", () => {
    const e = getHelpEntry("ollama-cors");
    expect(e).toBeDefined();
    expect(helpTitle(e!, "de")).toBe(e!.title);
    expect(helpTitle(e!, "en")).toBe(e!.titleEn);
    expect(helpBody(e!, "de")).toBe(e!.body);
    expect(helpBody(e!, "en")).toBe(e!.bodyEn);
    expect(getHelpEntry("gibt-es-nicht")).toBeUndefined();
  });
});
