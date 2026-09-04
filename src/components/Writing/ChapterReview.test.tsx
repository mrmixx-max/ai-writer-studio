// @vitest-environment jsdom
// Component-Tests: ChapterReview — Status/Metrik-Badges, Aktionen,
// Budget-Warnung sperrt Aktionen, Revisionshistorie sichtbar,
// needs_revision → draft/completed per UI.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterReview } from "./ChapterReview";
import type { Chapter } from "@/types/project";
import type { RevisionRecord } from "@/services/writing/revise";

function mkChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "ch1", projectId: "p1", title: "Kapitel 1", content: "Der Hund bellt laut. Die Katze schläft.",
    orderIndex: 0, createdAt: 0, updatedAt: 0, status: "needs_revision",
    targetWordCount: 2000, minimumWordCount: 1600, maximumWordCount: 2400, currentWordCount: 42,
    ...overrides,
  };
}

const profiles = [
  { id: "sty1", projectId: null, name: "Sachbuch klar", systemHint: "klar", rules: ["Kein Passiv"], isPreset: true, createdAt: 0, updatedAt: 0 },
  { id: "sty2", projectId: null, name: "Thriller temporeich", systemHint: "schnell", rules: [], isPreset: true, createdAt: 0, updatedAt: 0 },
];

const noRevisions = {};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChapterReview", () => {
  it("zeigt Status-Badges und Metrik-Badges je Kapitel", () => {
    render(
      <ChapterReview
        chapters={[mkChapter()]}
        styleProfiles={profiles}
        onRevise={vi.fn()}
        onComplete={vi.fn()}
        revisionsByChapter={noRevisions}
      />,
    );
    expect(screen.getByText("Überarbeitung nötig")).toBeTruthy();
    expect(screen.getByText("Kapitel 1")).toBeTruthy();
    expect(screen.getByTestId("metric-fillerRatio-ok")).toBeTruthy();
    expect(screen.getByText(/Wörter/)).toBeTruthy();
  });

  it("Metrik-Badge zeigt Warnung bei Füllwörtern über Schwelle", () => {
    const filler = Array.from({ length: 40 }, (_, i) => `${i % 2 ? "also" : "eigentlich"} ding${i}`).join(" ");
    render(
      <ChapterReview
        chapters={[mkChapter({ content: filler })]}
        styleProfiles={profiles}
        onRevise={vi.fn()}
        onComplete={vi.fn()}
        revisionsByChapter={noRevisions}
      />,
    );
    expect(screen.getByTestId("metric-fillerRatio-warn")).toBeTruthy();
  });

  it("Straffen-Button ruft onRevise(chapterId, 'straffen', null)", () => {
    const onRevise = vi.fn();
    render(
      <ChapterReview chapters={[mkChapter()]} styleProfiles={profiles} onRevise={onRevise} onComplete={vi.fn()} revisionsByChapter={noRevisions} />,
    );
    fireEvent.click(screen.getByTitle("−10 % Wortzahl, Füllwörter entfernen"));
    expect(onRevise).toHaveBeenCalledWith("ch1", "straffen", null);
  });

  it("Stil-Aktion übergibt das gewählte Profil", () => {
    const onRevise = vi.fn();
    render(
      <ChapterReview chapters={[mkChapter()]} styleProfiles={profiles} onRevise={onRevise} onComplete={vi.fn()} revisionsByChapter={noRevisions} />,
    );
    fireEvent.change(screen.getByLabelText(/Stilprofil/), { target: { value: "sty1" } });
    fireEvent.click(screen.getByTitle("Stilprofil anwenden: Sachbuch klar"));
    expect(onRevise).toHaveBeenCalledWith("ch1", "stil", profiles[0]);
  });

  it("Stil ohne gewähltes Profil ist disabled", () => {
    render(
      <ChapterReview chapters={[mkChapter()]} styleProfiles={profiles} onRevise={vi.fn()} onComplete={vi.fn()} revisionsByChapter={noRevisions} />,
    );
    const btn = screen.getByTitle(/Zuerst Stilprofil wählen/);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("completed-Aktion ruft onComplete", () => {
    const onComplete = vi.fn();
    render(
      <ChapterReview chapters={[mkChapter()]} styleProfiles={profiles} onRevise={vi.fn()} onComplete={onComplete} revisionsByChapter={noRevisions} />,
    );
    fireEvent.click(screen.getByText("✓ completed"));
    expect(onComplete).toHaveBeenCalledWith("ch1");
  });

  it("Budget-Warnung sperrt Revisions-Aktionen und wird angezeigt", () => {
    const onRevise = vi.fn();
    render(
      <ChapterReview
        chapters={[mkChapter()]}
        styleProfiles={profiles}
        onRevise={onRevise}
        onComplete={vi.fn()}
        budgetWarning="API-Budget aufgebraucht (Agent 2)"
        revisionsByChapter={noRevisions}
      />,
    );
    expect(screen.getByTestId("budget-warning").textContent).toContain("API-Budget aufgebraucht");
    const straffen = screen.getByTitle("−10 % Wortzahl, Füllwörter entfernen") as HTMLButtonElement;
    expect(straffen.disabled).toBe(true);
    fireEvent.click(straffen);
    expect(onRevise).not.toHaveBeenCalled();
  });

  it("Revisionshistorie ist aufklappbar und sichtbar", () => {
    const revisions: RevisionRecord[] = [{
      id: "rev1", chapterId: "ch1", mode: "straffen", model: "m",
      beforeWords: 100, afterWords: 90, beforeFiller: 0.30, afterFiller: 0.12,
      note: "LLM-Revision (straffen)", createdAt: 1735689600000,
    }];
    render(
      <ChapterReview
        chapters={[mkChapter()]}
        styleProfiles={profiles}
        onRevise={vi.fn()}
        onComplete={vi.fn()}
        revisionsByChapter={{ ch1: revisions }}
      />,
    );
    fireEvent.click(screen.getByText("▼ Historie"));
    expect(screen.getByTestId("history-ch1").textContent).toContain("100 → 90");
    expect(screen.getByTestId("history-ch1").textContent).toContain("30 %"); // beforeFiller 0.30 → 30 %
    expect(screen.getByTestId("history-ch1").textContent).toContain("LLM-Revision");
  });

  it("zählt überarbeitungswürdige Kapitel im Kopf", () => {
    render(
      <ChapterReview
        chapters={[mkChapter(), mkChapter({ id: "ch2", title: "Kapitel 2", status: "draft" })]}
        styleProfiles={profiles}
        onRevise={vi.fn()}
        onComplete={vi.fn()}
        revisionsByChapter={noRevisions}
      />,
    );
    expect(screen.getByText(/1 überarbeitungswürdig/)).toBeTruthy();
  });
});