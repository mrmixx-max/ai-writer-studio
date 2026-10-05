// @vitest-environment jsdom
/**
 * Tests: MicroclimateWeatherSynthesizerModal (WP 65.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicroclimateWeatherSynthesizerModal } from "./MicroclimateWeatherSynthesizerModal";

describe("MicroclimateWeatherSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-weather-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByText("🌡️ Mikroklima- & Sensorik-Wetter-Synthesizer")).toBeTruthy();
  });

  it("zeigt die sensorischen Eindrücke", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-impressions")).toBeTruthy();
    expect(screen.getByTestId("microclimate-sense-sight")).toBeTruthy();
    expect(screen.getByTestId("microclimate-sense-sound")).toBeTruthy();
    expect(screen.getByTestId("microclimate-sense-smell")).toBeTruthy();
    expect(screen.getByTestId("microclimate-sense-taste")).toBeTruthy();
    expect(screen.getByTestId("microclimate-sense-touch")).toBeTruthy();
  });

  it("zeigt den barometrischen Druck", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-pressure")).toBeTruthy();
    expect(screen.getByTestId("microclimate-pressure-value")).toBeTruthy();
  });

  it("zeigt das Körperempfinden", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-body-feeling").textContent?.length).toBeGreaterThan(10);
  });

  it("zeigt die Vorahnung", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-foreboding").textContent?.length).toBeGreaterThan(10);
  });

  it("reagiert auf Lagen-Auswahl", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    fireEvent.change(screen.getByTestId("microclimate-select"), {
      target: { value: "desert-scorch" },
    });
    expect(screen.getByTestId("microclimate-weather-synthesizer-modal").textContent).toContain("Wüstenglut");
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    fireEvent.change(screen.getByTestId("microclimate-text-input"), {
      target: { value: "Der Hafen war still." },
    });
    expect(screen.getByTestId("microclimate-prose").textContent).toContain("Der Hafen war still.");
  });

  it("zeigt die eingebettete Szene", () => {
    render(<MicroclimateWeatherSynthesizerModal />);
    expect(screen.getByTestId("microclimate-result")).toBeTruthy();
    expect(screen.getByTestId("microclimate-prose").textContent?.length).toBeGreaterThan(20);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<MicroclimateWeatherSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
