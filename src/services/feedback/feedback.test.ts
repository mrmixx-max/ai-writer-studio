// Tests: Feedback Engine (Sprint 23, Agent 2).
import { describe, it, expect } from "vitest";
import {
  reviewText,
  getAvailableFocusAreas,
  applySuggestion,
  applyAllSuggestions,
  type ReviewRequest,
  type FeedbackSuggestion,
} from "./feedback";

const REQ: ReviewRequest = {
  text: "Es war einmal ein dunkler Wald. Er war wirklich sehr dunkel und auch irgendwie unheimlich.",
  focusAreas: ["clarity", "description"],
  tone: "creative",
};

const LLM_JSON = JSON.stringify({
  overallScore: 72,
  summary: "Stimmungsvoller Anfang mit kleinen Schwächen.",
  suggestions: [
    {
      id: "s1",
      focus: "clarity",
      line: 2,
      original: "wirklich sehr dunkel",
      suggestion: "pechschwarz",
      reason: "Präziseres Bild, weniger Füllwörter.",
      priority: "medium",
    },
  ],
  strengths: ["Starke Atmosphäre"],
  weaknesses: ["Füllwörter"],
});

describe("reviewText", () => {
  it("mockt die LLM-Antwort und liefert ReviewFeedback", async () => {
    const client = async () => LLM_JSON;
    const res = await reviewText(REQ, { client });
    expect(res.overallScore).toBe(72);
    expect(res.summary).toContain("Stimmungsvoll");
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0]).toMatchObject({
      id: "s1",
      focus: "clarity",
      original: "wirklich sehr dunkel",
      suggestion: "pechschwarz",
      priority: "medium",
    });
    expect(res.strengths).toEqual(["Starke Atmosphäre"]);
  });

  it("fällt bei Provider-Fehler auf die lokale Heuristik zurück", async () => {
    const client = async () => {
      throw new Error("offline");
    };
    const res = await reviewText(REQ, { client });
    expect(res.overallScore).toBeGreaterThan(0);
    expect(res.summary).toContain("offline");
  });

  it("liefert bei leerem Text ein leeres Feedback", async () => {
    const res = await reviewText({ text: "   ", focusAreas: [], tone: "professional" });
    expect(res.overallScore).toBe(0);
    expect(res.suggestions).toEqual([]);
  });
});

describe("applySuggestion", () => {
  it("ersetzt Original durch Vorschlag", () => {
    const s: FeedbackSuggestion = {
      id: "s1",
      focus: "clarity",
      original: "wirklich sehr dunkel",
      suggestion: "pechschwarz",
      reason: "präziser",
      priority: "medium",
    };
    expect(applySuggestion("Der Wald war wirklich sehr dunkel.", s)).toBe("Der Wald war pechschwarz.");
  });

  it("lässt den Text unverändert, wenn das Original fehlt", () => {
    const s: FeedbackSuggestion = {
      id: "s9",
      focus: "tone",
      original: "nicht vorhanden",
      suggestion: "x",
      reason: "",
      priority: "low",
    };
    expect(applySuggestion("Unveränderter Text.", s)).toBe("Unveränderter Text.");
  });
});

describe("applyAllSuggestions", () => {
  it("wendet alle Vorschläge sequentiell an", () => {
    const mk = (original: string, suggestion: string): FeedbackSuggestion => ({
      id: original,
      focus: "clarity",
      original,
      suggestion,
      reason: "",
      priority: "low",
    });
    const out = applyAllSuggestions("Der Wald war wirklich sehr dunkel und irgendwie unheimlich.", [
      mk("wirklich sehr dunkel", "pechschwarz"),
      mk("irgendwie unheimlich", "unheimlich"),
    ]);
    expect(out).toBe("Der Wald war pechschwarz und unheimlich.");
  });
});

describe("getAvailableFocusAreas", () => {
  it("gibt alle acht Fokus-Bereiche zurück", () => {
    expect(getAvailableFocusAreas()).toEqual([
      "structure",
      "clarity",
      "tone",
      "pacing",
      "dialogue",
      "description",
      "grammar",
      "consistency",
    ]);
  });
});
