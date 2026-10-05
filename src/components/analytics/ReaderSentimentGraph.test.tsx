// @vitest-environment jsdom
/**
 * Tests: ReaderSentimentGraph (WP 47.1 — Leser-Empathie & Sympathiekurve)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderSentimentGraph } from "./ReaderSentimentGraph";
import type { ChapterEmpathyData } from "@/services/analytics/readerSentimentGraph";

const PROTAGONIST: ChapterEmpathyData[] = [
  { chapter: 1, vulnerability: 30, agency: 40, warmth: 50 },
  { chapter: 2, vulnerability: 50, agency: 60, warmth: 70 },
  { chapter: 3, vulnerability: 70, agency: 80, warmth: 90 },
  { chapter: 4, vulnerability: 60, agency: 70, warmth: 80 },
];

const ANTAGONIST: ChapterEmpathyData[] = [
  { chapter: 1, vulnerability: 20, agency: 30, warmth: 10 },
  { chapter: 2, vulnerability: 30, agency: 40, warmth: 20 },
  { chapter: 3, vulnerability: 40, agency: 50, warmth: 30 },
  { chapter: 4, vulnerability: 50, agency: 60, warmth: 40 },
];

describe("ReaderSentimentGraph", () => {
  it("rendert den Graphen", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("reader-sentiment-graph")).toBeTruthy();
  });

  it("zeigt Kapitelzahl und Trend", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    const text = screen.getByTestId("reader-sentiment-graph").textContent ?? "";
    expect(text).toContain("4 Kapitel");
    expect(text).toContain("Trend");
  });

  it("rendert Empathie-Metriken-Tabelle", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("sentiment-metrics")).toBeTruthy();
    expect(screen.getByTestId("sentiment-row-1")).toBeTruthy();
    expect(screen.getByTestId("sentiment-row-4")).toBeTruthy();
  });

  it("zeigt Overall-Wert", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("sentiment-row-1").textContent).toContain("40");
  });

  it("zeigt Protagonist vs. Antagonist", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("sentiment-comparison")).toBeTruthy();
    expect(screen.getByTestId("sentiment-max-divergence").textContent).toContain("Divergenz");
  });

  it("zeigt Verräter-Schock-Index", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("sentiment-betrayal")).toBeTruthy();
    expect(screen.getByTestId("sentiment-shock-index").textContent).toContain("/ 100");
  });

  it("Verräter-Kapitel änderbar", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    fireEvent.change(screen.getByTestId("sentiment-betrayal-chapter"), {
      target: { value: "2" },
    });
    expect(screen.getByTestId("sentiment-shock-index").textContent).not.toBe("0 / 100");
  });

  it("rendert Sympathiekurve als SVG", () => {
    render(<ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />);
    expect(screen.getByTestId("sentiment-curve")).toBeTruthy();
    expect(screen.getByTestId("sentiment-point-1")).toBeTruthy();
  });

  it("Klick auf Zeile ruft onSelectChapter", () => {
    const onSelect = vi.fn();
    render(
      <ReaderSentimentGraph
        protagonistData={PROTAGONIST}
        antagonistData={ANTAGONIST}
        onSelectChapter={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("sentiment-row-2"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("kommt mit leeren Daten zurecht", () => {
    render(<ReaderSentimentGraph protagonistData={[]} antagonistData={[]} />);
    expect(screen.getByTestId("sentiment-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(
      <ReaderSentimentGraph protagonistData={PROTAGONIST} antagonistData={ANTAGONIST} />,
    );
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
