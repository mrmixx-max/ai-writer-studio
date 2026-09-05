// @vitest-environment jsdom
// Sprint 7, Agent 3: Stil/Ton-Presets.
//
// TDD: Diese Tests definieren den Vertrag der Stil-Presets.
// - 8 Presets in prompts.json
// - 17 Genres in prompts.json
// - systemForGenre akzeptiert optionalen Stil und injiziert das Overlay
// - Byte-Identität ohne Stil (keine Breaking Changes)
import { describe, it, expect } from "vitest";
import {
  PROMPT_LIBRARY_VERSION,
  listStyles,
  getStyle,
  systemFromProfile,
  listGenres,
} from "./library";
import {
  systemForGenre as systemForGenreFacade,
} from "../prompts";

describe("Stil-Presets: Daten in prompts.json", () => {
  it("8 Stil-Presets mit den geforderten IDs", () => {
    expect(listStyles().map((s) => s.id)).toEqual([
      "wissenschaftlich",
      "blog",
      "sachbuch-klassisch",
      "thriller",
      "humorvoll",
      "noir",
      "poetisch",
      "biografisch",
    ]);
  });

  it("23 Genres vorhanden", () => {
    const genres = listGenres();
    expect(genres.length).toBe(23);
    expect(genres).toContain("horror");
    expect(genres).toContain("romance");
    expect(genres).toContain("scifi");
    expect(genres).toContain("philosophie");
    expect(genres).toContain("wirtschaft");
    expect(genres).toContain("kinderbuch");
    expect(genres).toContain("western");
    expect(genres).toContain("cyberpunk");
    expect(genres).toContain("maerchen");
    expect(genres).toContain("doku");
    expect(genres).toContain("reisebericht");
    expect(genres).toContain("lyrik");
  });

  it("Version der Library bleibt 2.0 (additive Erweiterung)", () => {
    expect(PROMPT_LIBRARY_VERSION).toBe("2.0");
  });

  it("jedes Preset hat label, description, systemHint und mind. 2 Regeln", () => {
    for (const s of listStyles()) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.systemHint.length).toBeGreaterThan(0);
      expect(s.rules.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("humorvoll trägt humoristische Charakteristik", () => {
    const h = getStyle("humorvoll");
    expect(h).toBeTruthy();
    expect(h!.systemHint + " " + h!.rules.join(" ")).toMatch(/humor|witz/);
  });

  it("noir trägt düster-noir-Charakteristik", () => {
    const n = getStyle("noir");
    expect(n).toBeTruthy();
    expect(n!.systemHint + " " + n!.rules.join(" ")).toMatch(/düster|noir/);
  });

  it("poetisch trägt poetische Charakteristik", () => {
    const p = getStyle("poetisch");
    expect(p).toBeTruthy();
    expect(p!.systemHint + " " + p!.rules.join(" ")).toMatch(/poetisch|bildreich/);
  });

  it("biografisch trägt biografische Charakteristik", () => {
    const b = getStyle("biografisch");
    expect(b).toBeTruthy();
    expect(b!.systemHint + " " + b!.rules.join(" ")).toMatch(/biografisch|lebensgeschichte/);
  });
});

describe("Stil-Mapping: systemForGenre mit Stil-Overlay", () => {
  it("ohne Stil: byte-identisch zum bisherigen Verhalten (keine Breaking Changes)", () => {
    const res = systemFromProfile("sachbuch", "sachlich-nah", "de");
    expect(res).toContain("Sachbuchautor");
    expect(res).toContain("Tonalität: sachlich-nah");
    expect(res).toContain("Regeln:");
    // Fassade ebenfalls unverändert
    expect(systemForGenreFacade("sachbuch", "sachlich-nah", "de")).toBe(res);
  });

  it("mit Stil: Overlay wird injiziert (Rolle + Regeln sichtbar)", () => {
    const withStyle = systemFromProfile("sachbuch", "sachlich-nah", "de", "wissenschaftlich");
    const without = systemFromProfile("sachbuch", "sachlich-nah", "de");
    expect(withStyle).toContain("Stil-Overlay: wissenschaftlich");
    expect(withStyle).toContain("präzise");
    expect(withStyle).toContain("zitierfähig");
    expect(withStyle.startsWith(without)).toBe(true);
    expect(withStyle.length).toBeGreaterThan(without.length);
  });

  it("Stil-Regeln erscheinen als eigene Regelzeilen NACH den Genre-Regeln", () => {
    const res = systemFromProfile("roman", "düster", "de", "thriller");
    const genreRuleIdx = res.indexOf("- Keine Selbstreferenzen");
    const styleRuleIdx = res.indexOf("- Kurze, harte Sätze");
    expect(genreRuleIdx).toBeGreaterThan(-1);
    expect(styleRuleIdx).toBeGreaterThan(genreRuleIdx);
  });

  it("unbekannter Stil: fällt auf Verhalten OHNE Overlay zurück (kein Crash, kein Müll)", () => {
    const withUnknown = systemFromProfile("sachbuch", "sachlich-nah", "de", "gibt-es-nicht");
    expect(withUnknown).toBe(systemFromProfile("sachbuch", "sachlich-nah", "de"));
  });

  it("leerer Stil: identisch zu ohne Stil", () => {
    expect(systemFromProfile("sachbuch", "x", "de", "")).toBe(systemFromProfile("sachbuch", "x", "de"));
  });

  it("getStyle: case-insensitive, unknown → null", () => {
    expect(getStyle("THRILLER")?.id).toBe("thriller");
    expect(getStyle("nope")).toBeNull();
  });

  it("Fassade (prompts.ts) reicht den Stil an die Library durch", () => {
    const viaLibrary = systemFromProfile("roman", "düster", "de", "thriller");
    const viaFacade = systemForGenreFacade("roman", "düster", "de", "thriller");
    expect(viaFacade).toBe(viaLibrary);
  });
});

describe("Service-Verdrahtung: Briefing-tone als Stil-Quelle", () => {
  it("GUI-Muster (tone = Preset-ID) injiziert das Overlay", () => {
    const res = systemFromProfile("roman", "thriller", "de", "thriller");
    expect(res).toContain("Stil-Overlay: thriller");
    expect(res).toContain("Tonalität: thriller");
  });

  it("Legacy-Muster (tone = freier Text) injiziert KEIN Overlay", () => {
    const res = systemFromProfile("roman", "düster", "de", "düster");
    expect(res).not.toContain("Stil-Overlay:");
    expect(res).toContain("Tonalität: düster");
  });
});
