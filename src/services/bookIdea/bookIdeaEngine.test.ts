// Tests: Book Idea Engine — Guards (Refine-Idempotenz, Count-Clamp, Hybrid).
import { describe, it, expect } from "vitest";
import {
  generateBookIdeas,
  refineIdea,
  evaluateIdea,
} from "./bookIdeaEngine";
import type { BookIdea } from "@/types/bookIdea";

function sampleIdea(): BookIdea {
  return {
    id: "idea-1",
    title: "Die letzte Zukunft",
    genre: "Krimi",
    targetAudience: "Erwachsene (18-35)",
    logline: "Eine Person kämpft gegen die Zeit.",
    synopsis: "Eine kurze Zusammenfassung der Idee.",
    protagonist: "Eine mutige Person Anfang 30 mit verborgener Vergangenheit.",
    antagonist: "Eine mysteriöse Organisation.",
    setting: "Eine nahe Zukunft.",
    conflict: "Wer kontrolliert die Zukunft, kontrolliert die Macht.",
    themes: ["Macht", "Kontrolle"],
    chapters: ["Anfang", "Mitte"],
  };
}

describe("refineIdea", () => {
  it("ist idempotent — kein doppeltes Anhängen bei wiederholtem Verfeinern", () => {
    const once = refineIdea(sampleIdea());
    const twice = refineIdea(once);
    expect(twice.themes).toEqual(once.themes);
    expect(twice.synopsis).toBe(once.synopsis);
    expect(twice.chapters).toEqual(once.chapters);
    expect(new Set(twice.themes).size).toBe(twice.themes.length);
  });

  it("füllt Kapitel unter 6 auf, ohne Duplikate", () => {
    const refined = refineIdea(sampleIdea());
    expect(refined.chapters.length).toBeGreaterThanOrEqual(4);
    expect(new Set(refined.chapters).size).toBe(refined.chapters.length);
  });
});

describe("generateBookIdeas", () => {
  it("liefert Demo-Ideen in der gewünschten Anzahl", async () => {
    const ideas = await generateBookIdeas({
      genre: "Krimi",
      theme: "Zeit",
      targetAudience: "Erwachsene (18-35)",
      count: 3,
    });
    expect(ideas).toHaveLength(3);
    for (const idea of ideas) {
      expect(idea.title).toBeTruthy();
      expect(idea.genre).toBe("Krimi");
    }
  });

  it("klemmt übergroße Counts auf 10", async () => {
    const ideas = await generateBookIdeas({
      genre: "Krimi",
      theme: "Zeit",
      targetAudience: "Erwachsene (18-35)",
      count: 99,
    });
    expect(ideas).toHaveLength(10);
  });

  it("fällt bei leerem Theme auf den Default zurück", async () => {
    const ideas = await generateBookIdeas({
      genre: "Krimi",
      theme: "   ",
      targetAudience: "Erwachsene (18-35)",
      count: 2,
    });
    expect(ideas).toHaveLength(2);
    expect(ideas[0].title).toContain("Zukunft");
  });

  it("hybrid ohne Netz liefert Demo-Fallback in der gewünschten Anzahl", async () => {
    const ideas = await generateBookIdeas({
      genre: "Krimi",
      theme: "Zeit",
      targetAudience: "Erwachsene (18-35)",
      count: 4,
      mode: "hybrid",
      llmModel: "gibt-es-nicht-xyz",
    });
    expect(ideas).toHaveLength(4);
  });

  it("bewertet generierte Ideen ohne Throw", async () => {
    const ideas = await generateBookIdeas({
      genre: "Fantasy",
      theme: "Drachen",
      targetAudience: "Jugendliche (13-17)",
      count: 2,
    });
    for (const idea of ideas) {
      const eval_ = evaluateIdea(idea);
      expect(eval_.overallScore).toBeGreaterThan(0);
    }
  });
});
