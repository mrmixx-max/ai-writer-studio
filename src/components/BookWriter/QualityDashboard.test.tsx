// @vitest-environment jsdom
// Component-Tests: QualityDashboard (Sprint 17, Agent 2) — Score, Metriken,
// Vorschlags-Klick, Trend, Empty-State. LektoratPanel wird NICHT angefasst.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QualityDashboard,
  computeOverallScore,
  clampScore,
  type QualityMetric,
  type QualitySuggestion,
  type ChapterQualityPoint,
} from "./QualityDashboard";

const metrics: QualityMetric[] = [
  { id: "stil", label: "Stil", score: 80 },
  { id: "kohaerenz", label: "Kohärenz", score: 60 },
];

const suggestions: QualitySuggestion[] = [
  { id: "s1", chapterId: "ch1", text: "Füllwort entfernen", metricId: "stil" },
  { id: "s2", chapterId: "ch2", text: "Passiv auflösen", metricId: "stil" },
];

const chapters: ChapterQualityPoint[] = [
  { chapterId: "ch1", title: "Anfang", score: 70 },
  { chapterId: "ch2", title: "Mitte", score: 90 },
];

describe("QualityDashboard", () => {
  it("rendert das Panel", () => {
    render(<QualityDashboard metrics={metrics} />);
    expect(screen.getByTestId("quality-dashboard")).toBeInTheDocument();
  });

  it("zeigt den gemittelten Gesamt-Score (80+60)/2 = 70", () => {
    render(<QualityDashboard metrics={metrics} />);
    expect(screen.getByTestId("quality-score")).toHaveTextContent("70");
  });

  it("rendert alle Metriken mit Balken und Score", () => {
    render(<QualityDashboard metrics={metrics} />);
    expect(screen.getAllByTestId("quality-metric")).toHaveLength(2);
    const bars = screen.getAllByTestId("quality-metric-bar");
    expect(bars[0]).toHaveAttribute("data-score", "80");
    expect(bars[1]).toHaveAttribute("data-score", "60");
    expect(bars[0].getAttribute("style")).toContain("width: 80%");
  });

  it("meldet Klick auf Vorschlag an onApplySuggestion und entfernt ihn", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <QualityDashboard
        metrics={metrics}
        suggestions={suggestions}
        onApplySuggestion={onApply}
      />,
    );
    expect(screen.getAllByTestId("quality-suggestion")).toHaveLength(2);
    await user.click(screen.getAllByTestId("quality-suggestion-fix")[0]);
    expect(onApply).toHaveBeenCalledWith("s1");
    expect(screen.getAllByTestId("quality-suggestion")).toHaveLength(1);
  });

  it("zeigt Done-Hinweis, wenn alle Vorschläge übernommen sind", async () => {
    const user = userEvent.setup();
    render(<QualityDashboard metrics={metrics} suggestions={[suggestions[0]]} />);
    await user.click(screen.getByTestId("quality-suggestion-fix"));
    expect(screen.getByTestId("quality-suggestions-done")).toBeInTheDocument();
  });

  it("rendert den Kapitel-Trend", () => {
    render(<QualityDashboard metrics={metrics} chapters={chapters} />);
    const points = screen.getAllByTestId("quality-trend-point");
    expect(points).toHaveLength(2);
    expect(points[0]).toHaveAttribute("data-chapter", "ch1");
    expect(points[1]).toHaveTextContent("Mitte");
  });

  it("zeigt den Empty-State ohne Daten", () => {
    render(<QualityDashboard />);
    expect(screen.getByTestId("quality-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("quality-score")).not.toBeInTheDocument();
  });

  it("fällt für den Gesamt-Score auf den Kapitel-Mittelwert zurück", () => {
    expect(computeOverallScore([], chapters)).toBe(80);
  });

  it("gibt 0 zurück, wenn keinerlei Daten vorliegen", () => {
    expect(computeOverallScore([], [])).toBe(0);
  });

  it("clampet Scores auf 0–100", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});
