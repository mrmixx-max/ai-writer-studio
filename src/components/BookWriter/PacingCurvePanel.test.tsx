// @vitest-environment jsdom
// Component-Tests: PacingCurvePanel — SVG-Kurven-Visualisierung.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PacingCurvePanel } from "./PacingCurvePanel";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

function makeChapters(count: number): BookChapterInput[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    title: `Kapitel ${i + 1}`,
    content:
      i === 0
        ? "Der alte Mann ging langsam durch den dunklen Wald."
        : i === 1
          ? "Plötzlich! Er rennt! Die Angst! Die Gefahr! Alles passiert schnell!"
          : "Sie sprach leise: \"Komm mit mir.\" Er nickte und ging neben ihr.",
    status: "draft",
  }));
}

describe("PacingCurvePanel", () => {
  it("rendert ohne Absturz mit Kapiteln", () => {
    const chapters = makeChapters(3);
    render(<PacingCurvePanel chapters={chapters} />);
    expect(screen.getByTestId("pacing-curve-panel")).toBeTruthy();
  });

  it("zeigt die korrekte Anzahl an Datenpunkten", () => {
    const chapters = makeChapters(5);
    render(<PacingCurvePanel chapters={chapters} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`pacing-dot-${i}`)).toBeTruthy();
    }
  });

  it("ruft onChapterClick bei Klick auf einen Datenpunkt auf", () => {
    const chapters = makeChapters(3);
    const onChapterClick = vi.fn();
    render(
      <PacingCurvePanel chapters={chapters} onChapterClick={onChapterClick} />,
    );
    const dot = screen.getByTestId("pacing-dot-2");
    fireEvent.click(dot);
    expect(onChapterClick).toHaveBeenCalledTimes(1);
    expect(onChapterClick).toHaveBeenCalledWith(2);
  });

  it("verarbeitet leere Kapitel-Liste graceful", () => {
    render(<PacingCurvePanel chapters={[]} />);
    expect(screen.getByTestId("pacing-curve-panel")).toBeTruthy();
    expect(screen.getByText(/Keine Kapitel vorhanden/i)).toBeTruthy();
  });

  it("rendert SVG mit Kurven-Pfad", () => {
    const chapters = makeChapters(4);
    render(<PacingCurvePanel chapters={chapters} />);
    const svg = screen.getByRole("img", { name: /Pacing-Kurve/i });
    expect(svg).toBeTruthy();
    const path = svg.querySelector("path");
    expect(path).toBeTruthy();
    expect(path?.getAttribute("d")).toBeTruthy();
  });

  it("zeigt Climax- und Tiefster-Punkt-Informationen an", () => {
    const chapters = makeChapters(3);
    render(<PacingCurvePanel chapters={chapters} />);
    // Chapter 2 has the most action/emotion, should be climax
    expect(screen.getByText(/Climax:/)).toBeTruthy();
    expect(screen.getByText(/Tiefster Punkt:/)).toBeTruthy();
  });
});
