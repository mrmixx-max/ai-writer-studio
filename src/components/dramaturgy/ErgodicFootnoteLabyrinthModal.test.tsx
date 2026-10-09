// @vitest-environment jsdom
/** Tests: ErgodicFootnoteLabyrinthModal (Meilenstein 60.0 / v7.2.0) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErgodicFootnoteLabyrinthModal } from "./ErgodicFootnoteLabyrinthModal";

describe("ErgodicFootnoteLabyrinthModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    expect(screen.getByTestId("ergodic-footnote-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    expect(screen.getByText(/Ergodisches Fußnoten-Labyrinth-Studio/)).toBeInTheDocument();
  });

  it("zeigt Fußnoten-Hierarchie", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    expect(screen.getByText(/FUSSNOTEN-HIERARCHIE/)).toBeInTheDocument();
  });

  it("zeigt Kommentatoren", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    expect(screen.getByText(/KOMMENTATOREN/)).toBeInTheDocument();
  });

  it("zeigt Lesepfade", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    expect(screen.getByText(/LESEPFADER/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    render(<ErgodicFootnoteLabyrinthModal />);
    const container = screen.getByTestId("ergodic-footnote-modal");
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
