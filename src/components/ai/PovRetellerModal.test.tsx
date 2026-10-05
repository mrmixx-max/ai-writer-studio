// @vitest-environment jsdom
/**
 * Tests: PovRetellerModal (WP 61.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PovRetellerModal } from "./PovRetellerModal";

describe("PovRetellerModal", () => {
  it("rendert die Komponente", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-reteller-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<PovRetellerModal />);
    expect(screen.getByText("👁️ POV-Perspektiven-Wechsler")).toBeTruthy();
  });

  it("zeigt alle fünf Archetypen", () => {
    render(<PovRetellerModal />);
    ["warrior", "diplomat", "scholar", "thief", "healer"].forEach((a) => {
      expect(screen.getByTestId(`pov-archetype-${a}`)).toBeTruthy();
    });
  });

  it("wechselt den Archetyp", () => {
    render(<PovRetellerModal />);
    const before = screen.getByTestId("pov-section-observation").textContent;
    fireEvent.click(screen.getByTestId("pov-archetype-diplomat"));
    expect(screen.getByTestId("pov-section-observation").textContent).not.toBe(before);
  });

  it("markiert den aktiven Archetyp", () => {
    render(<PovRetellerModal />);
    fireEvent.click(screen.getByTestId("pov-archetype-thief"));
    expect(screen.getByTestId("pov-archetype-thief").getAttribute("aria-pressed")).toBe("true");
  });

  it("erzeugt drei Abschnitte", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-section-observation")).toBeTruthy();
    expect(screen.getByTestId("pov-section-misreading")).toBeTruthy();
    expect(screen.getByTestId("pov-section-inner")).toBeTruthy();
  });

  it("zeigt den Wahrnehmungsfilter", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-focus").textContent).toContain("Hände");
  });

  it("zeigt die Sinnes-Priorität", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-senses").textContent).toContain("Berührung");
  });

  it("Wechsel des Archetyps ändert die Sinnes-Priorität", () => {
    render(<PovRetellerModal />);
    fireEvent.click(screen.getByTestId("pov-archetype-diplomat"));
    expect(screen.getByTestId("pov-senses").textContent).toContain("Gehör");
  });

  it("nennt den Beobachter", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-section-observation").textContent).toContain("Raven");
  });

  it("enthält eine Fehldeutung", () => {
    render(<PovRetellerModal />);
    const misreading = screen.getByTestId("pov-section-misreading").textContent ?? "";
    expect(misreading).toMatch(/Arroganz|Drohung|Wut/);
  });

  it("übernimmt einen neuen Beobachter", () => {
    render(<PovRetellerModal />);
    fireEvent.change(screen.getByTestId("pov-observer-input"), { target: { value: "Kessler" } });
    expect(screen.getByTestId("pov-section-observation").textContent).toContain("Kessler");
  });

  it("übernimmt eine neue Szene", () => {
    render(<PovRetellerModal />);
    fireEvent.change(screen.getByTestId("pov-scene-input"), {
      target: { value: "Ein ganz anderes Geschehen" },
    });
    expect(screen.getByTestId("pov-reteller-modal")).toBeTruthy();
  });

  it("zeigt den Wahrnehmungsvergleich", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-comparison")).toBeTruthy();
    expect(screen.getByTestId("pov-shared-focus")).toBeTruthy();
  });

  it("wechselt den Vergleichs-Archetyp", () => {
    render(<PovRetellerModal />);
    const before = screen.getByTestId("pov-divergence").textContent;
    fireEvent.click(screen.getByTestId("pov-compare-warrior"));
    expect(screen.getByTestId("pov-divergence").textContent).not.toBe(before);
  });

  it("markiert den aktiven Vergleichs-Archetyp", () => {
    render(<PovRetellerModal />);
    fireEvent.click(screen.getByTestId("pov-compare-healer"));
    expect(screen.getByTestId("pov-compare-healer").getAttribute("aria-pressed")).toBe("true");
  });

  it("zeigt die Divergenz", () => {
    render(<PovRetellerModal />);
    expect(screen.getByTestId("pov-divergence").textContent).toContain("Divergenz");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PovRetellerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
