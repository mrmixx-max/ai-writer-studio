// @vitest-environment jsdom
/**
 * Tests: CulinaryFeastSynthesizerModal (WP 78.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CulinaryFeastSynthesizerModal } from "./CulinaryFeastSynthesizerModal";

describe("CulinaryFeastSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<CulinaryFeastSynthesizerModal />);
    expect(screen.getByTestId("culinary-feast-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<CulinaryFeastSynthesizerModal />);
    expect(screen.getByText("🍽️ Kulinarischer Gastronomie- & Gelage-Synthesizer")).toBeTruthy();
  });

  it("zeigt Festmahl", () => {
    render(<CulinaryFeastSynthesizerModal />);
    expect(screen.getByTestId("feast-output")).toBeTruthy();
  });

  it("wechselt Biom", () => {
    render(<CulinaryFeastSynthesizerModal />);
    fireEvent.change(screen.getByTestId("feast-biome-select"), { target: { value: "coastal" } });
    expect(screen.getByTestId("feast-output")).toBeTruthy();
  });

  it("wechselt Stand", () => {
    render(<CulinaryFeastSynthesizerModal />);
    fireEvent.change(screen.getByTestId("feast-class-select"), { target: { value: "peasant" } });
    expect(screen.getByTestId("feast-output")).toBeTruthy();
  });

  it("reagiert auf Name-Eingabe", () => {
    render(<CulinaryFeastSynthesizerModal />);
    fireEvent.change(screen.getByTestId("feast-name-input"), {
      target: { value: "Neues Festmahl" },
    });
    expect(screen.getByTestId("feast-output")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<CulinaryFeastSynthesizerModal />);
    expect(screen.getByTestId("feast-text").textContent).toContain("FESTMAHL");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<CulinaryFeastSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
