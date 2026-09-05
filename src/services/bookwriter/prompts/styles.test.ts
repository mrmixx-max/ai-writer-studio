// @vitest-environment jsdom
// Sprint 7, Agent 3: Stil/Ton-Presets.
//
// TDD RED-Phase: Diese Tests definieren den Vertrag der Stil-Presets.
// - 5 Presets in prompts.json (wissenschaftlich, blog, jerry-cotton, sachbuch-klassisch, thriller)
// - systemForGenre akzeptiert optionalen Stil und injiziert das Overlay
// - Byte-Identität ohne Stil (keine Breaking Changes)
// - Dropdown im BookWriterPanel statt freiem Textfeld
import { describe, it, expect } from "vitest";
import {
  PROMPT_LIBRARY_VERSION,
  listStyles,
  getStyle,
  systemFromProfile,
} from "./library";
import {
  systemForGenre as systemForGenreFacade,
} from "../prompts";

describe("Stil-Presets: Daten in prompts.json", () => {
  it("exakt 5 Stil-Presets mit den geforderten IDs", () => {
    expect(listStyles().map((s) => s.id)).toEqual([
      "wissenschaftlich",
      "blog",
      "jerry-cotton",
      "sachbuch-klassisch",
      "thriller",
    ]);
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

  it("jerry-cotton trägt 1950er-Pulp-Charakteristik", () => {
    const jc = getStyle("jerry-cotton");
    expect(jc).toBeTruthy();
    expect(jc!.systemHint + " " + jc!.rules.join(" ")).toMatch(/1950/i);
  });
});

describe("Stil-Mapping: systemForGenre mit Stil-Overlay", () => {
  it("ohne Stil: byte-identisch zum bisherigen Verhalten (keine Breaking Changes)", () => {
    const expected =
      "Du bist ein erfahrener Sachbuchautor und Lektor. Du erklärst komplexe " +
      "Themen so, dass sie ein interessierter Laienleser versteht, ohne sie zu " +
      "vereinfachen. Deine Sätze sind präzise, deine Beispiele anschaulich.\n" +
      "\n" +
      "Tonalität: sachlich-nah\n" +
      "Schreibe alle Ausgaben auf Deutsch.\n" +
      "\n" +
      "Regeln:\n" +
      "- Schreibe in klarem, literarischem Deutsch, nicht in Bulletpoints.\n" +
      "- Vermeide Füllwörter, Abschweifungen und leere Floskeln.\n" +
      "- Jede Aussage muss einen konkreten Inhalt haben.\n" +
      "- Stelle nie Tatsachen auf, die du nicht prüfen kannst. Wo unsicher, formuliere vage oder markiere den Punkt.\n" +
      "- Keine Platzhalter wie [hier einfügen], keine unvollständigen Sätze.\n" +
      "- Keine Selbstreferenzen wie \"in diesem Kapitel\" oder \"wie oben erwähnt\".";
    expect(systemFromProfile("sachbuch", "sachlich-nah", "de")).toBe(expected);
    // Fassade ebenfalls unverändert
    expect(systemForGenreFacade("sachbuch", "sachlich-nah", "de")).toBe(expected);
  });

  it("mit Stil: Overlay wird injiziert (Rolle + Regeln sichtbar)", () => {
    const withStyle = systemFromProfile("sachbuch", "sachlich-nah", "de", "wissenschaftlich");
    const without = systemFromProfile("sachbuch", "sachlich-nah", "de");
    expect(withStyle).toContain("Stil-Overlay: wissenschaftlich");
    expect(withStyle).toContain("präzise");
    expect(withStyle).toContain("zitierfähig");
    // Overlay ergänzt, ersetzt nichts:
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

  it("jerry-cotton-Overlay: 1950er-Pulp-Anweisungen im Prompt", () => {
    const res = systemFromProfile("roman", "pulpig", "de", "jerry-cotton");
    expect(res).toContain("Stil-Overlay: jerry-cotton");
    expect(res).toMatch(/1950/);
    expect(res).toContain("- Szenische Einstiege");
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
    // BookWriterPanel setzt tone auf die Preset-ID; chapter-gen/workflow
    // reichen briefing.tone als style-Argument durch.
    const res = systemFromProfile("roman", "thriller", "de", "thriller");
    expect(res).toContain("Stil-Overlay: thriller");
    expect(res).toContain("Tonalität: thriller");
  });

  it("Legacy-Muster (tone = freier Text) injiziert KEIN Overlay", () => {
    // Alte Briefings haben tone="düster" etc. — getStyle("düster") → null.
    const res = systemFromProfile("roman", "düster", "de", "düster");
    expect(res).not.toContain("Stil-Overlay:");
    expect(res).toContain("Tonalität: düster");
  });
});
