// @vitest-environment jsdom
/**
 * Tests: RelationshipChemistry (WP 52.1 — Beziehungs-Chemie- & Funken-Matrix)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelationshipChemistry } from "./RelationshipChemistry";

describe("RelationshipChemistry", () => {
  it("rendert die Matrix", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("relationship-chemistry")).toBeTruthy();
  });

  it("zeigt Metriken", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("chemistry-metrics")).toBeTruthy();
    expect(screen.getByTestId("chemistry-banter")).toBeTruthy();
    expect(screen.getByTestId("chemistry-ratio")).toBeTruthy();
  });

  it("zeigt Phasen-Tracker", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("chemistry-phase")).toBeTruthy();
    expect(screen.getByTestId("chemistry-phase-hostility")).toBeTruthy();
    expect(screen.getByTestId("chemistry-phase-devotion")).toBeTruthy();
  });

  it("zeigt Dialog-Vorschau", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("chemistry-dialogue")).toBeTruthy();
    expect(screen.getByTestId("chemistry-line-0")).toBeTruthy();
  });

  it("zeigt Spannungs-Abfall-Warnung", () => {
    render(<RelationshipChemistry />);
    // 5 Kapitel ohne Szene < Threshold 6, also keine Warnung
    expect(screen.getByTestId("chemistry-no-drop")).toBeTruthy();
  });

  it("Banter-Index ist eine Zahl", () => {
    render(<RelationshipChemistry />);
    const banter = screen.getByTestId("chemistry-banter").textContent ?? "";
    expect(banter).toMatch(/^\d+(\.\d+)?$/);
  });

  it("Schlagabtausch-Quote ist Prozent", () => {
    render(<RelationshipChemistry />);
    const ratio = screen.getByTestId("chemistry-ratio").textContent ?? "";
    expect(ratio).toMatch(/%$/);
  });

  it("Unterbrechungen sind sichtbar", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("chemistry-interruptions")).toBeTruthy();
  });

  it("Neckereien sind sichtbar", () => {
    render(<RelationshipChemistry />);
    expect(screen.getByTestId("chemistry-teasing")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<RelationshipChemistry />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
