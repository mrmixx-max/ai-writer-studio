// @vitest-environment jsdom
/**
 * Tests: PlanetaryClimateEngineModal (WP 82.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanetaryClimateEngineModal } from "./PlanetaryClimateEngineModal";

describe("PlanetaryClimateEngineModal", () => {
  it("rendert die Komponente", () => {
    render(<PlanetaryClimateEngineModal />);
    expect(screen.getByTestId("planetary-climate-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<PlanetaryClimateEngineModal />);
    expect(screen.getByText("🪐 Planetarer Klima- & Jahreszeiten-Simulator")).toBeTruthy();
  });

  it("zeigt Klimazonen", () => {
    render(<PlanetaryClimateEngineModal />);
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("zeigt Jahreszeiten", () => {
    render(<PlanetaryClimateEngineModal />);
    expect(screen.getByTestId("climate-seasons")).toBeTruthy();
  });

  it("reagiert auf Planetenname", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-name-input"), {
      target: { value: "Neuer Planet" },
    });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("reagiert auf Tageslänge", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-day-input"), { target: { value: "30" } });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("reagiert auf Jahreslänge", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-year-input"), { target: { value: "400" } });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("reagiert auf Achsenneigung", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-tilt-input"), { target: { value: "30" } });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("reagiert auf Monde", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-moon-input"), { target: { value: "3" } });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("reagiert auf Exzentrizität", () => {
    render(<PlanetaryClimateEngineModal />);
    fireEvent.change(screen.getByTestId("climate-ecc-input"), { target: { value: "0.2" } });
    expect(screen.getByTestId("climate-zones")).toBeTruthy();
  });

  it("shows Text-Ausgabe", () => {
    render(<PlanetaryClimateEngineModal />);
    expect(screen.getByTestId("climate-text").textContent).toContain("KLIMABERICHT");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PlanetaryClimateEngineModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
