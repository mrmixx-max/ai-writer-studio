// @vitest-environment jsdom
/**
 * Tests: ReaderEmpathyHeatmapModal (WP 71.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderEmpathyHeatmapModal } from "./ReaderEmpathyHeatmapModal";

describe("ReaderEmpathyHeatmapModal", () => {
  it("rendert die Komponente", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("reader-empathy-heatmap-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByText("💓 Leser-Empathie- & Tränen-Heatmap")).toBeTruthy();
  });

  it("zeigt die Durchschnittswerte", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-averages")).toBeTruthy();
    expect(screen.getByTestId("empathy-avg-tears")).toBeTruthy();
    expect(screen.getByTestId("empathy-avg-adrenaline")).toBeTruthy();
  });

  it("zeigt die Heatmap mit Absätzen", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-heatmap")).toBeTruthy();
    expect(screen.getByTestId("empathy-paragraph-1")).toBeTruthy();
  });

  it("zeigt die Glow-Schicht für einen Absatz", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-glow-1-tears")).toBeTruthy();
  });

  it("zeigt die Werte je Absatz", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-values-1").textContent).toContain("%");
  });

  it("zeigt Hotspots", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-hotspots")).toBeTruthy();
  });

  it("zeigt den emotionalen Höhepunkt", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-climax").textContent).toContain("Absatz");
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<ReaderEmpathyHeatmapModal />);
    fireEvent.change(screen.getByTestId("empathy-text-input"), {
      target: { value: "Sie weinte bitterlich, Tränen der Trauer, Verlust, Abschied, sie schluchzte." },
    });
    expect(screen.getByTestId("empathy-paragraph-1")).toBeTruthy();
  });

  it("kommt mit leerem Text zurecht", () => {
    render(<ReaderEmpathyHeatmapModal initialText="" />);
    expect(screen.getByTestId("empathy-empty")).toBeTruthy();
    expect(screen.getByTestId("empathy-no-hotspots")).toBeTruthy();
  });

  it("filtert Reaktionen aus", () => {
    render(<ReaderEmpathyHeatmapModal />);
    // Tränen-Filter aus → Glow für Tränen verschwindet.
    fireEvent.click(screen.getByTestId("empathy-filter-tears"));
    expect(screen.queryByTestId("empathy-glow-1-tears")).toBeNull();
  });

  it("filtert Reaktionen wieder ein", () => {
    render(<ReaderEmpathyHeatmapModal />);
    fireEvent.click(screen.getByTestId("empathy-filter-tears"));
    expect(screen.queryByTestId("empathy-glow-1-tears")).toBeNull();
    fireEvent.click(screen.getByTestId("empathy-filter-tears"));
    expect(screen.getByTestId("empathy-glow-1-tears")).toBeTruthy();
  });

  it("hat vier Filter-Buttons", () => {
    render(<ReaderEmpathyHeatmapModal />);
    ["tears", "goosebumps", "laughter", "adrenaline"].forEach((k) => {
      expect(screen.getByTestId(`empathy-filter-${k}`)).toBeTruthy();
    });
  });

  it("zeigt die Zusammenfassung", () => {
    render(<ReaderEmpathyHeatmapModal />);
    expect(screen.getByTestId("empathy-summary-text").textContent).toContain("Empathie-Heatmap");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ReaderEmpathyHeatmapModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
