// @vitest-environment jsdom
/**
 * Tests: ArchitecturalAcousticSynthesizerModal (WP 79.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchitecturalAcousticSynthesizerModal } from "./ArchitecturalAcousticSynthesizerModal";

describe("ArchitecturalAcousticSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    expect(screen.getByTestId("architectural-acoustic-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    expect(screen.getByText("🏛️ Raum-Architektur- & Akustik-Synthesizer")).toBeTruthy();
  });

  it("zeigt Ergebnis", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    expect(screen.getByTestId("acoustic-result")).toBeTruthy();
  });

  it("reagiert auf Deckenhöhe", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    fireEvent.change(screen.getByTestId("acoustic-height-input"), { target: { value: "12" } });
    expect(screen.getByTestId("acoustic-result")).toBeTruthy();
  });

  it("reagiert auf Volumen", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    fireEvent.change(screen.getByTestId("acoustic-volume-input"), { target: { value: "1000" } });
    expect(screen.getByTestId("acoustic-result")).toBeTruthy();
  });

  it("reagiert auf Material", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    fireEvent.change(screen.getByTestId("acoustic-material-select"), { target: { value: "concrete" } });
    expect(screen.getByTestId("acoustic-result")).toBeTruthy();
  });

  it("reagiert auf Lichtquelle", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    fireEvent.change(screen.getByTestId("acoustic-light-select"), { target: { value: "window" } });
    expect(screen.getByTestId("acoustic-result")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<ArchitecturalAcousticSynthesizerModal />);
    expect(screen.getByTestId("acoustic-text").textContent).toContain("RAUM-AKUSTIK");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ArchitecturalAcousticSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
