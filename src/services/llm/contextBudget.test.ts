// Tests für das Kontext-Budget (WP1.3).
//
// Kernaussagen:
//  - Die verfügbare Prompt-Größe hängt am Kontextfenster des Modells.
//  - Gekürzt wird von außen nach innen (Konzept zuerst, Fakten zuletzt).
//  - Der Kern (Aufgabe) wird nie gekürzt, weil er kein Baustein ist.

import { describe, it, expect } from "vitest";
import {
  availablePromptTokens,
  truncateToTokens,
  fitToBudget,
  renderSections,
  SECTION_PRIORITY,
  OUTPUT_RESERVE_RATIO,
  SAFETY_TOKENS,
  type ContextSection,
} from "./contextBudget";
import { estimateTokens } from "@/services/knowledge/chunking";
import { getLocalModelProfile } from "@/services/llm/localModelProfiles";

describe("availablePromptTokens", () => {
  it("folgt dem Kontextfenster des Modellprofils", () => {
    const profile = getLocalModelProfile("llama3.2:latest");
    const expected = Math.floor(profile.contextTokens * (1 - OUTPUT_RESERVE_RATIO) - SAFETY_TOKENS);
    expect(availablePromptTokens("llama3.2:latest")).toBe(expected);
  });

  it("lässt einem kleinen Modell deutlich weniger Platz als einem großen", () => {
    const small = availablePromptTokens("llama3.2:latest");
    const large = availablePromptTokens("qwen2.5:72b");
    expect(large).toBeGreaterThan(small);
  });

  it("reserviert Platz für die Antwort (nie das volle Fenster)", () => {
    const profile = getLocalModelProfile("llama3.2:latest");
    expect(availablePromptTokens("llama3.2:latest")).toBeLessThan(profile.contextTokens);
  });
});

describe("truncateToTokens", () => {
  it("lässt Text innerhalb des Budgets unverändert", () => {
    const t = "Ein kurzer Satz.";
    expect(truncateToTokens(t, 100)).toBe(t);
  });

  it("kürzt und markiert die Kürzung sichtbar", () => {
    const long = "Das ist ein Satz. ".repeat(200);
    const out = truncateToTokens(long, 50);
    expect(estimateTokens(out)).toBeLessThanOrEqual(50);
    expect(out).toContain("[…gekürzt]");
    expect(out.length).toBeLessThan(long.length);
  });

  it("reißt nicht mitten im Wort ab", () => {
    const long = "Wort ".repeat(500);
    const out = truncateToTokens(long, 30);
    const body = out.replace("\n[…gekürzt]", "");
    expect(body.endsWith("Wort")).toBe(true);
  });

  it("liefert leeren String bei Budget 0", () => {
    expect(truncateToTokens("irgendwas", 0)).toBe("");
  });
});

describe("fitToBudget", () => {
  const mk = (name: string, priority: number, words: number): ContextSection => ({
    name,
    priority,
    text: `${name}: ${"Inhalt ".repeat(words)}`,
  });

  it("lässt alles stehen, wenn es ins Budget passt", () => {
    const sections = [mk("concept", SECTION_PRIORITY.concept, 5), mk("facts", SECTION_PRIORITY.facts, 5)];
    const r = fitToBudget(sections, "llama3.2:latest", 10_000);
    expect(r.trimmed).toEqual([]);
    expect(r.sections.every((s) => s.text.length > 0)).toBe(true);
  });

  it("kürzt zuerst das Konzept und lässt die Fakten stehen", () => {
    const sections = [
      mk("concept", SECTION_PRIORITY.concept, 400),
      mk("facts", SECTION_PRIORITY.facts, 40),
    ];
    const budget = estimateTokens(sections[1].text) + 20;
    const r = fitToBudget(sections, "llama3.2:latest", budget);

    expect(r.trimmed).toContain("concept");
    expect(r.trimmed).not.toContain("facts");
    expect(r.sections.find((s) => s.name === "facts")!.text.length).toBeGreaterThan(0);
    expect(r.usedTokens).toBeLessThanOrEqual(budget);
  });

  it("verwirft einen Baustein ganz, statt ihn auf null Zeichen zu kürzen", () => {
    const sections = [
      mk("concept", SECTION_PRIORITY.concept, 500),
      mk("facts", SECTION_PRIORITY.facts, 20),
    ];
    const r = fitToBudget(sections, "llama3.2:latest", 60);
    const concept = r.sections.find((s) => s.name === "concept")!;
    // Entweder vollständig weg oder sinnvoll gekürzt — kein Rest-Fragment.
    expect(concept.text === "" || estimateTokens(concept.text) <= 60).toBe(true);
  });

  it("hält das Budget ein, auch wenn alle Bausteine zusammen zu groß sind", () => {
    const sections = [
      mk("concept", SECTION_PRIORITY.concept, 300),
      mk("previousChapters", SECTION_PRIORITY.previousChapters, 300),
      mk("research", SECTION_PRIORITY.research, 300),
      mk("facts", SECTION_PRIORITY.facts, 300),
      mk("world", SECTION_PRIORITY.world, 300),
    ];
    const r = fitToBudget(sections, "llama3.2:latest", 200);
    expect(r.usedTokens).toBeLessThanOrEqual(200);
  });

  it("verändert die übergebenen Bausteine nicht (Kopie)", () => {
    const sections = [mk("concept", SECTION_PRIORITY.concept, 500)];
    const before = sections[0].text;
    fitToBudget(sections, "llama3.2:latest", 20);
    expect(sections[0].text).toBe(before);
  });

  it("rechnet mit dem übergebenen Budget, nicht dem des Modells", () => {
    const sections = [mk("concept", SECTION_PRIORITY.concept, 100)];
    const r = fitToBudget(sections, "llama3.2:latest", 50);
    expect(r.availableTokens).toBe(50);
    expect(r.usedTokens).toBeLessThanOrEqual(50);
  });
});

describe("renderSections", () => {
  it("überspringt leere Bausteine", () => {
    const out = renderSections([
      { name: "a", priority: 1, text: "Erster Block" },
      { name: "b", priority: 2, text: "   " },
      { name: "c", priority: 3, text: "Dritter Block" },
    ]);
    expect(out).toBe("Erster Block\n\nDritter Block");
  });

  it("liefert leeren String, wenn alles leer ist", () => {
    expect(renderSections([{ name: "a", priority: 1, text: "" }])).toBe("");
  });
});
