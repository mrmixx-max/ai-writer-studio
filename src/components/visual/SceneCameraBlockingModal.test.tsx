// @vitest-environment jsdom
/**
 * Tests: SceneCameraBlockingModal (WP 70.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SceneCameraBlockingModal } from "./SceneCameraBlockingModal";

describe("SceneCameraBlockingModal", () => {
  it("rendert die Komponente", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("scene-camera-blocking-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByText("🎬 3D-Szenen- & Kamera-Blocking")).toBeTruthy();
  });

  it("zeigt die Bühne als SVG", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-stage")).toBeTruthy();
  });

  it("zeigt die Bühnen-Elemente", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-element-fig-a")).toBeTruthy();
    expect(screen.getByTestId("blocking-element-cam-1")).toBeTruthy();
  });

  it("zeigt das Blickfeld", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-frustum")).toBeTruthy();
  });

  it("zeigt die Handlungsachse", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-axis-line")).toBeTruthy();
  });

  it("zeigt den Achsen-Wächter", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-axis")).toBeTruthy();
    expect(screen.getByTestId("blocking-axis-status")).toBeTruthy();
  });

  it("meldet einen Achsensprung beim Kamerawechsel auf die andere Seite", () => {
    render(<SceneCameraBlockingModal />);
    // cam-1 ist aktiv; Klick auf cam-2 (andere Achsenseite).
    fireEvent.click(screen.getByTestId("blocking-element-cam-2"));
    expect(screen.getByTestId("blocking-axis-status").textContent).toContain("ACHSENSPRUNG");
  });

  it("meldet eine eingehaltene Achse bei gleicher Seite", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.click(screen.getByTestId("blocking-element-cam-2"));
    fireEvent.click(screen.getByTestId("blocking-element-cam-2"));
    expect(screen.getByTestId("blocking-axis-status").textContent).toContain("eingehalten");
  });

  it("zeigt die Kameraseite", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-axis").textContent).toContain("Kameraseite");
  });

  it("bewegt eine Figur nach rechts", () => {
    render(<SceneCameraBlockingModal />);
    const before = screen.getByTestId("blocking-ctrl-fig-a").textContent;
    fireEvent.click(screen.getByTestId("blocking-right-fig-a"));
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).not.toBe(before);
  });

  it("bewegt eine Figur nach links", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.click(screen.getByTestId("blocking-left-fig-a"));
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).toContain("1.5");
  });

  it("bewegt eine Figur nach oben", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.click(screen.getByTestId("blocking-up-fig-a"));
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).toContain("2.5");
  });

  it("bewegt eine Figur nach unten", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.click(screen.getByTestId("blocking-down-fig-a"));
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).toContain("3.5");
  });

  it("rotiert eine Figur", () => {
    render(<SceneCameraBlockingModal />);
    const before = screen.getByTestId("blocking-ctrl-fig-a").textContent;
    fireEvent.click(screen.getByTestId("blocking-rot-fig-a"));
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).not.toBe(before);
  });

  it("begrenzt die Bewegung auf die Bühne", () => {
    render(<SceneCameraBlockingModal />);
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByTestId("blocking-left-fig-a"));
    }
    expect(screen.getByTestId("blocking-ctrl-fig-a").textContent).toContain("(0.0");
  });

  it("reagiert auf Einstellungs-Auswahl", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.change(screen.getByTestId("blocking-shot-select"), { target: { value: "wide" } });
    expect(screen.getByTestId("blocking-framing").textContent).toContain("Totale");
  });

  it("reagiert auf Winkel-Auswahl", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.change(screen.getByTestId("blocking-angle-select"), { target: { value: "low" } });
    expect(screen.getByTestId("blocking-framing").textContent).toContain("Untersicht");
  });

  it("reagiert auf Brennweiten-Eingabe", () => {
    render(<SceneCameraBlockingModal />);
    fireEvent.change(screen.getByTestId("blocking-focal-input"), { target: { value: "85" } });
    expect(screen.getByTestId("blocking-framing").textContent).toContain("85mm");
  });

  it("zeigt den Öffnungswinkel", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-camera-setup").textContent).toContain("Öffnungswinkel");
  });

  it("zeigt die Blicklinien", () => {
    render(<SceneCameraBlockingModal />);
    expect(screen.getByTestId("blocking-sight-list")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SceneCameraBlockingModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
