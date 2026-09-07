// Sprint 15, Agent 5: Tests fuer die Bilingual-Prompt-Templates (NEUE Datei).
// Deckt ab: Template-Rendering, Variablen-Validierung, Registry-
// Vollstaendigkeit (alle Templates haben description + build-Funktion).
// Keine LLM-Calls: build() ist pure (nur renderTemplate).

import { describe, it, expect } from "vitest";
import {
  BILINGUAL_REGISTRY,
  CHAPTER_SUMMARY_BILINGUAL_TEMPLATE,
  CONSISTENCY_CHECK_TEMPLATE,
  TRANSLATE_DE_EN_TEMPLATE,
  getBilingualTemplate,
  listBilingualTemplateIds,
  validateBilingualVars,
} from "./bilingualTemplates";

describe("Bilingual-Registry: Struktur", () => {
  it("alle Templates haben nicht-leere id + description", () => {
    expect(BILINGUAL_REGISTRY.length).toBeGreaterThanOrEqual(3);
    for (const tpl of BILINGUAL_REGISTRY) {
      expect(tpl.id.trim().length).toBeGreaterThan(0);
      expect(tpl.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("alle Templates haben eine build-Funktion", () => {
    for (const tpl of BILINGUAL_REGISTRY) {
      expect(typeof tpl.build).toBe("function");
    }
  });

  it("Template-IDs sind eindeutig", () => {
    const ids = listBilingualTemplateIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("alle Templates nutzen {{variable}}-Platzhalter", () => {
    for (const tpl of BILINGUAL_REGISTRY) {
      expect(tpl.template).toContain("{{");
      expect(tpl.requiredVars.length).toBeGreaterThan(0);
    }
  });

  it("getBilingualTemplate: unbekannte ID wirft", () => {
    expect(() => getBilingualTemplate("bilingual:gibt-es-nicht")).toThrow(
      /Unbekanntes bilinguales Template/,
    );
  });
});

describe("TRANSLATE_DE_EN_TEMPLATE", () => {
  it("rendert Quelltext + Ton, ohne {{-Reste}", () => {
    const out = TRANSLATE_DE_EN_TEMPLATE.build({
      sourceText: "Es war eine dunkle Nacht.",
      tone: "spannend",
    });
    expect(out).toContain("Es war eine dunkle Nacht.");
    expect(out).toContain("spannend");
    expect(out).not.toContain("{{");
  });

  it("optionales Glossar wird bei Belegung eingesetzt", () => {
    const out = TRANSLATE_DE_EN_TEMPLATE.build({
      sourceText: "Der Wald.",
      tone: "lyrisch",
      glossary: "Wald -> forest",
    });
    expect(out).toContain("Wald -> forest");
  });

  it("wirft bei fehlendem sourceText", () => {
    expect(() => TRANSLATE_DE_EN_TEMPLATE.build({ tone: "neutral" })).toThrow(
      /Fehlende Variablen.*sourceText/,
    );
  });
});

describe("CHAPTER_SUMMARY_BILINGUAL_TEMPLATE", () => {
  it("rendert Titel + Text in DE/EN-Struktur", () => {
    const out = CHAPTER_SUMMARY_BILINGUAL_TEMPLATE.build({
      chapterTitle: "Ankunft",
      chapterText: "Der Held erreicht die Stadt.",
    });
    expect(out).toContain("Ankunft");
    expect(out).toContain("Der Held erreicht die Stadt.");
    expect(out).toContain("DE:");
    expect(out).toContain("EN:");
    expect(out).not.toContain("{{");
  });

  it("optionale maxSentences wird bei Belegung eingesetzt", () => {
    const out = CHAPTER_SUMMARY_BILINGUAL_TEMPLATE.build({
      chapterTitle: "X",
      chapterText: "Y",
      maxSentences: 3,
    });
    expect(out).toContain("3");
  });
});

describe("CONSISTENCY_CHECK_TEMPLATE", () => {
  it("rendert beide Sprachtexte", () => {
    const out = CONSISTENCY_CHECK_TEMPLATE.build({
      germanText: "Der Hund bellt.",
      englishText: "The dog barks.",
    });
    expect(out).toContain("Der Hund bellt.");
    expect(out).toContain("The dog barks.");
    expect(out).not.toContain("{{");
  });

  it("wirft bei fehlendem englishText", () => {
    expect(() => CONSISTENCY_CHECK_TEMPLATE.build({ germanText: "Hallo" })).toThrow(
      /Fehlende Variablen.*englishText/,
    );
  });
});

describe("validateBilingualVars", () => {
  it("meldet fehlende requiredVars", () => {
    const check = validateBilingualVars(TRANSLATE_DE_EN_TEMPLATE, { tone: "x" });
    expect(check.valid).toBe(false);
    expect(check.missing).toEqual(["sourceText"]);
  });

  it("meldet unbekannte Variablen", () => {
    const check = validateBilingualVars(CONSISTENCY_CHECK_TEMPLATE, {
      germanText: "d",
      englishText: "e",
      humbugVariable: 1,
    });
    expect(check.missing).toEqual([]);
    expect(check.unknown).toEqual(["humbugVariable"]);
    expect(check.valid).toBe(false);
  });

  it("vollstaendige Belegung ist valide", () => {
    const check = validateBilingualVars(CHAPTER_SUMMARY_BILINGUAL_TEMPLATE, {
      chapterTitle: "T",
      chapterText: "C",
      maxSentences: 5,
    });
    expect(check).toEqual({ missing: [], unknown: [], valid: true });
  });
});
