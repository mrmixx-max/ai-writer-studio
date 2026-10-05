// @vitest-environment jsdom
/**
 * Tests: AtmosphereProseGenerator (WP 55.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtmosphereProseGenerator } from "./AtmosphereProseGenerator";

describe("AtmosphereProseGenerator", () => {
  it("rendert die Komponente", () => {
    render(<AtmosphereProseGenerator />);
    expect(screen.getByTestId("atmosphere-prose-generator")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AtmosphereProseGenerator />);
    expect(screen.getByText("🌫️ Schauplatz- & Sensorik-Generator")).toBeTruthy();
  });

  it("erzeugt Schauplatz-Text", () => {
    render(<AtmosphereProseGenerator />);
    const text = screen.getByTestId("atmosphere-output").textContent ?? "";
    expect(text.length).toBeGreaterThan(50);
  });

  it("nennt den Ort", () => {
    render(<AtmosphereProseGenerator initialLocation="Alte Mühle" />);
    expect(screen.getByTestId("atmosphere-output").textContent).toContain("Alte Mühle");
  });

  it("erreicht mindestens 4 Sinne", () => {
    render(<AtmosphereProseGenerator />);
    const count = screen.getByTestId("atmosphere-sense-count").textContent ?? "";
    expect(count).toContain("Ziel erreicht");
  });

  it("zeigt alle fünf Sinnes-Badges", () => {
    render(<AtmosphereProseGenerator />);
    ["sight", "sound", "smell", "taste", "touch"].forEach((s) => {
      expect(screen.getByTestId(`atmosphere-sense-${s}`)).toBeTruthy();
    });
  });

  it("reagiert auf Stimmungswechsel", () => {
    render(<AtmosphereProseGenerator />);
    const before = screen.getByTestId("atmosphere-output").textContent;
    fireEvent.change(screen.getByTestId("atmosphere-mood-select"), {
      target: { value: "serene" },
    });
    expect(screen.getByTestId("atmosphere-output").textContent).not.toBe(before);
  });

  it("reagiert auf Tageszeit", () => {
    render(<AtmosphereProseGenerator />);
    fireEvent.change(screen.getByTestId("atmosphere-time-select"), {
      target: { value: "dawn" },
    });
    expect(screen.getByTestId("atmosphere-output").textContent).toContain("Dämmerung");
  });

  it("reagiert auf Wetter", () => {
    render(<AtmosphereProseGenerator />);
    fireEvent.change(screen.getByTestId("atmosphere-weather-select"), {
      target: { value: "fog" },
    });
    expect((screen.getByTestId("atmosphere-output").textContent ?? "").toLowerCase()).toContain(
      "nebel",
    );
  });

  it("übernimmt einen neuen Ort", () => {
    render(<AtmosphereProseGenerator />);
    fireEvent.change(screen.getByTestId("atmosphere-location-input"), {
      target: { value: "Der Leuchtturm" },
    });
    expect(screen.getByTestId("atmosphere-output").textContent).toContain("Der Leuchtturm");
  });

  it("erzeugt eine Übergangspassage", () => {
    render(<AtmosphereProseGenerator />);
    const t = screen.getByTestId("atmosphere-transition").textContent ?? "";
    expect(t.length).toBeGreaterThan(20);
  });

  it("übernimmt Zeitsprung und Folgeszene", () => {
    render(<AtmosphereProseGenerator />);
    fireEvent.change(screen.getByTestId("atmosphere-timeskip-input"), {
      target: { value: "drei Tage später" },
    });
    fireEvent.change(screen.getByTestId("atmosphere-tolocation-input"), {
      target: { value: "Das Kloster" },
    });
    const t = screen.getByTestId("atmosphere-transition").textContent ?? "";
    expect(t).toContain("drei Tage später");
    expect(t).toContain("Das Kloster");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AtmosphereProseGenerator />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
