// @vitest-environment jsdom
/**
 * Tests: UniversalFormatTransmuterModal (WP 80.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UniversalFormatTransmuterModal } from "./UniversalFormatTransmuterModal";

describe("UniversalFormatTransmuterModal", () => {
  it("rendert die Komponente", () => {
    render(<UniversalFormatTransmuterModal />);
    expect(screen.getByTestId("universal-format-transmuter-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<UniversalFormatTransmuterModal />);
    expect(screen.getByText("🔄 Omnidirektionaler Universal-Format-Transmuter")).toBeTruthy();
  });

  it("zeigt Ergebnis", () => {
    render(<UniversalFormatTransmuterModal />);
    expect(screen.getByTestId("transmuter-output")).toBeTruthy();
  });

  it("wechselt Quellformat", () => {
    render(<UniversalFormatTransmuterModal />);
    fireEvent.change(screen.getByTestId("transmuter-source-select"), { target: { value: "prose" } });
    expect(screen.getByTestId("transmuter-output")).toBeTruthy();
  });

  it("wechselt Zielformat", () => {
    render(<UniversalFormatTransmuterModal />);
    fireEvent.change(screen.getByTestId("transmuter-target-select"), { target: { value: "comic" } });
    expect(screen.getByTestId("transmuter-output")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<UniversalFormatTransmuterModal />);
    fireEvent.change(screen.getByTestId("transmuter-text-input"), {
      target: { value: "Ein neuer Satz." },
    });
    expect(screen.getByTestId("transmuter-output")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<UniversalFormatTransmuterModal />);
    expect(screen.getByTestId("transmuter-text").textContent).toContain("TRANSMUTATION");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<UniversalFormatTransmuterModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
