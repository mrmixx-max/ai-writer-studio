// @vitest-environment jsdom
/**
 * Tests: SuspenseEcgGraph (WP 50.2 — Szenen-Spannungs-EKG)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuspenseEcgGraph } from "./SuspenseEcgGraph";

describe("SuspenseEcgGraph", () => {
  it("rendert das EKG", () => {
    render(<SuspenseEcgGraph />);
    expect(screen.getByTestId("suspense-ecg-graph")).toBeTruthy();
  });

  it("zeigt Satzanzahl", () => {
    render(<SuspenseEcgGraph />);
    const text = screen.getByTestId("suspense-ecg-graph").textContent ?? "";
    expect(text).toContain("Sätze");
  });

  it("zeigt Cliffhanger-Score", () => {
    render(<SuspenseEcgGraph />);
    expect(screen.getByTestId("ecg-cliffhanger-score").textContent).toContain("/100");
  });

  it("EKG-Kurve wird gerendert", () => {
    render(<SuspenseEcgGraph />);
    expect(screen.getByTestId("ecg-curve")).toBeTruthy();
  });

  it("Satz-für-Satz-Ansicht zeigt Sätze", () => {
    render(<SuspenseEcgGraph />);
    expect(screen.getByTestId("ecg-readings")).toBeTruthy();
    expect(screen.getByTestId("ecg-reading-0")).toBeTruthy();
  });

  it("Analysieren aktualisiert Anzeige", () => {
    render(<SuspenseEcgGraph />);
    fireEvent.change(screen.getByTestId("ecg-scene"), {
      target: { value: "Ein Satz. Noch ein Satz." },
    });
    fireEvent.click(screen.getByTestId("ecg-analyze"));
    expect(screen.getByTestId("ecg-cliffhanger-score")).toBeTruthy();
  });

  it("Cliffhanger-Score-Text korrekt", () => {
    render(<SuspenseEcgGraph />);
    const score = screen.getByTestId("ecg-cliffhanger-score").textContent ?? "";
    expect(score).toMatch(/^\d+\/100$/);
  });

  it("EKG-Punkte werden gerendert", () => {
    render(<SuspenseEcgGraph />);
    expect(screen.getByTestId("ecg-point-0")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SuspenseEcgGraph />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
