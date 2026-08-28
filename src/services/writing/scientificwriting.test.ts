// Wissenschaftliches Schreiben: Tests für Gliederung, Textgenerator, Abstract, Umformulierung.
import { describe, it, expect } from "vitest";
import {
  generateScientificOutline,
  generateScientificText,
  generateAbstract,
  rewriteAcademic,
  analyzeScientificInput,
  checkOutlineStructure,
} from "@/services/writing/scientificwriting";
import type { ScientificWritingInput } from "@/services/writing/scientificwriting";

const BASE_INPUT: ScientificWritingInput = {
  workType: "hausarbeit",
  topic: "Auswirkungen von KI-Assistenz auf Schreibprozesse",
  field: "Medienwissenschaft",
  level: "bachelor",
  language: "de",
  tone: "sachlich",
  section: "einleitung",
};

describe("scientific writing", () => {
  it("erzeugt eine akademische Gliederung aus einer Forschungsfrage", () => {
    const result = generateScientificOutline({
      ...BASE_INPUT,
      topic: "Auswirkungen von KI-Assistenz auf Schreibprozesse",
      level: "bachelor",
      language: "de",
    });
    expect(result.outline.length).toBeGreaterThan(3);
    expect(result.outline[0]).toContain("Einleitung");
  });

  it("formuliert Rohtext wissenschaftlich um", () => {
    const result = rewriteAcademic({
      inputText: "KI hilft beim Schreiben und macht vieles einfacher.",
      tone: "sachlich",
    });
    expect(result.rewritten.toLowerCase()).not.toMatch(/mega|toll|cool|einfach super/);
    expect(result.rewritten).toContain("wissenschaftlich");
  });

  it("erzeugt ein Abstract mit den Kernbestandteilen", () => {
    const result = generateAbstract({
      topic: "Digitale Schreibassistenz in der Self-Publishing-Praxis",
      method: "qualitative analyse",
      resultSummary: "Die Arbeit zeigt eine Effizienzsteigerung bei der Textüberarbeitung.",
    });
    expect(result.text).toContain("Ziel");
    expect(result.text).toContain("Methode");
  });

  it("warnt bei fehlenden Quellen", () => {
    const warnings = analyzeScientificInput({
      ...BASE_INPUT,
      topic: "Wirkung von KI auf Kreativität",
      sources: [],
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === "no-sources")).toBe(true);
  });

  it("erzeugt einen Einleitungstext", () => {
    const result = generateScientificText({
      ...BASE_INPUT,
      section: "einleitung",
    });
    expect(result.text).toContain("vorliegende Arbeit");
    expect(result.text).toContain("Forschungsfrage");
  });

  it("erzeugt einen Methodik-Text", () => {
    const result = generateScientificText({
      ...BASE_INPUT,
      section: "methodik",
    });
    expect(result.text).toContain("methodische Vorgehensweise");
    expect(result.text).toContain("Datenerhebung");
  });

  it("erzeugt einen Fazit-Text", () => {
    const result = generateScientificText({
      ...BASE_INPUT,
      section: "schluss",
    });
    expect(result.text).toContain("vorliegende Arbeit");
    expect(result.text).toContain("Zusammenfassend");
  });

  it("Gliederungsprüfung erkennt fehlende Einleitung", () => {
    const warnings = checkOutlineStructure([
      "1. Theoretischer Rahmen",
      "2. Methodik",
      "3. Ergebnisse",
    ]);
    expect(warnings.some((w) => w.code === "no-introduction")).toBe(true);
  });

  it("Gliederungsprüfung erkennt fehlenden Schluss", () => {
    const warnings = checkOutlineStructure([
      "1. Einleitung",
      "2. Theoretischer Rahmen",
      "3. Methodik",
    ]);
    expect(warnings.some((w) => w.code === "no-conclusion")).toBe(true);
  });

  it("Gliederungsprüfung erkennt kurze Gliederung", () => {
    const warnings = checkOutlineStructure(["1. Einleitung"]);
    expect(warnings.some((w) => w.code === "outline-too-short")).toBe(true);
  });

  it("Essay-Gliederung ist kompakter", () => {
    const result = generateScientificOutline({
      ...BASE_INPUT,
      workType: "essay",
    });
    expect(result.outline.length).toBeLessThan(10);
    expect(result.outline[0]).toContain("Einleitung");
  });

  it("Abstract-Gliederung ist kurz", () => {
    const result = generateScientificOutline({
      ...BASE_INPUT,
      workType: "abstract",
    });
    expect(result.outline.length).toBeLessThan(6);
  });

  it("warnt bei verbotenen Phrasen", () => {
    const warnings = analyzeScientificInput({
      ...BASE_INPUT,
      rawText: "In der heutigen schnelllebigen Welt ist das ein spannendes Thema.",
    });
    expect(warnings.some((w) => w.code === "banned-phrase")).toBe(true);
  });

  it("Abstract enthält Keywords", () => {
    const result = generateAbstract({
      topic: "Test",
      method: "Analyse",
      resultSummary: "Ergebnisse zeigen Effekte.",
    });
    expect(result.keywords.length).toBeGreaterThan(0);
  });
});
