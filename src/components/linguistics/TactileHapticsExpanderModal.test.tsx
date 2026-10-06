// @vitest-environment jsdom
/**
 * Tests: TactileHapticsExpanderModal (WP 78.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TactileHapticsExpanderModal } from "./TactileHapticsExpanderModal";

describe("TactileHapticsExpanderModal", () => {
  it("rendert die Komponente", () => {
    render(<TactileHapticsExpanderModal />);
    expect(screen.getByTestId("tactile-haptics-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<TactileHapticsExpanderModal />);
    expect(screen.getByText("🖐️ Taktile Haptik- & Oberflächen-Matrix")).toBeTruthy();
  });

  it("zeigt Analyse", () => {
    render(<TactileHapticsExpanderModal />);
    expect(screen.getByTestId("haptics-analysis")).toBeTruthy();
  });

  it("zeigt erweiterte Beschreibung", () => {
    render(<TactileHapticsExpanderModal />);
    expect(screen.getByTestId("haptics-expanded")).toBeTruthy();
  });

  it("reagiert auf Gegenstands-Eingabe", () => {
    render(<TactileHapticsExpanderModal />);
    fireEvent.change(screen.getByTestId("haptics-object-input"), {
      target: { value: "ein glattes Pflaster" },
    });
    expect(screen.getByTestId("haptics-analysis")).toBeTruthy();
  });

  it("reagiert auf Beschreibungs-Eingabe", () => {
    render(<TactileHapticsExpanderModal />);
    fireEvent.change(screen.getByTestId("haptics-description-input"), {
      target: { value: "Die Oberfläche war rau." },
    });
    expect(screen.getByTestId("haptics-expanded")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<TactileHapticsExpanderModal />);
    expect(screen.getByTestId("haptics-text").textContent).toContain("HAPTISCHE ANALYSE");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<TactileHapticsExpanderModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
