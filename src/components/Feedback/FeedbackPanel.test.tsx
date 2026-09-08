// @vitest-environment jsdom
// Component-Tests: FeedbackPanel (Sprint 23, Agent 2) — Fokus-Auswahl,
// Ton-Auswahl, Review-Start (injizierter Client), Übernehmen-Buttons.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackPanel } from "./FeedbackPanel";
import type { ReviewFeedback } from "@/services/feedback/feedback";

const MOCK_RESULT: ReviewFeedback = {
  overallScore: 72,
  summary: "Stimmungsvoller Anfang.",
  suggestions: [
    {
      id: "s1",
      focus: "clarity",
      line: 1,
      original: "wirklich sehr dunkel",
      suggestion: "pechschwarz",
      reason: "Präziseres Bild.",
      priority: "medium",
    },
  ],
  strengths: ["Starke Atmosphäre"],
  weaknesses: ["Füllwörter"],
};

const FOCUS_IDS = ["structure", "clarity", "tone", "pacing", "dialogue", "description", "grammar", "consistency"];

describe("FeedbackPanel", () => {
  it("rendert Fokus-Auswahl mit allen acht Bereichen", () => {
    render(<FeedbackPanel initialText="Hallo Welt." review={vi.fn()} />);
    expect(screen.getByTestId("feedback-focus-group")).toBeInTheDocument();
    for (const f of FOCUS_IDS) {
      expect(screen.getByTestId(`feedback-focus-${f}`)).toBeInTheDocument();
    }
  });

  it("rendert Ton-Auswahl und deaktivierten Start bei leerem Text", () => {
    render(<FeedbackPanel review={vi.fn()} />);
    expect(screen.getByTestId("feedback-tone-select")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-text-input")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-start")).toBeDisabled();
  });

  it("Review-Start zeigt Score, Zusammenfassung und Vorschläge", async () => {
    const user = userEvent.setup();
    const review = vi.fn(async () => MOCK_RESULT);
    render(<FeedbackPanel initialText="Der Wald war wirklich sehr dunkel." review={review} />);
    await user.click(screen.getByTestId("feedback-start"));
    await waitFor(() => expect(screen.getByTestId("feedback-result")).toBeInTheDocument());
    expect(review).toHaveBeenCalledOnce();
    expect(screen.getByTestId("feedback-score")).toHaveTextContent("72/100");
    expect(screen.getByTestId("feedback-summary")).toHaveTextContent("Stimmungsvoller Anfang.");
    expect(screen.getByTestId("feedback-suggestion-s1")).toHaveTextContent("pechschwarz");
    expect(screen.getByTestId("feedback-apply-s1")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-apply-all")).toBeInTheDocument();
  });

  it("Übernehmen-Button ersetzt Original durch Vorschlag im Text", async () => {
    const user = userEvent.setup();
    render(<FeedbackPanel initialText="Der Wald war wirklich sehr dunkel." review={vi.fn(async () => MOCK_RESULT)} />);
    await user.click(screen.getByTestId("feedback-start"));
    await waitFor(() => expect(screen.getByTestId("feedback-apply-s1")).toBeInTheDocument());
    await user.click(screen.getByTestId("feedback-apply-s1"));
    const area = screen.getByTestId("feedback-text-input") as HTMLTextAreaElement;
    expect(area.value).toBe("Der Wald war pechschwarz.");
    expect(screen.getByTestId("feedback-apply-s1")).toHaveTextContent("Übernommen");
  });

  it("Alle-übernehmen wendet sämtliche Vorschläge an", async () => {
    const user = userEvent.setup();
    render(<FeedbackPanel initialText="Der Wald war wirklich sehr dunkel." review={vi.fn(async () => MOCK_RESULT)} />);
    await user.click(screen.getByTestId("feedback-start"));
    await waitFor(() => expect(screen.getByTestId("feedback-apply-all")).toBeInTheDocument());
    await user.click(screen.getByTestId("feedback-apply-all"));
    expect((screen.getByTestId("feedback-text-input") as HTMLTextAreaElement).value).toBe(
      "Der Wald war pechschwarz.",
    );
  });
});
