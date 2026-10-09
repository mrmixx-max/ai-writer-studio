// @vitest-environment jsdom
// CharacterWardrobeLookbookModal – UI-Tests (Meilenstein 59.0 / v7.1.0)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterWardrobeLookbookModal } from "./CharacterWardrobeLookbookModal";

describe("CharacterWardrobeLookbookModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CharacterWardrobeLookbookModal />);
    expect(screen.getByTestId("character-wardrobe-modal")).toBeTruthy();
  });

  it("zeigt Titel an", () => {
    render(<CharacterWardrobeLookbookModal />);
    expect(screen.getByText(/Charakter-Garderoben- & Kostüm-Lookbook/)).toBeTruthy();
  });

  it("zeigt Garderoben-Raster", () => {
    render(<CharacterWardrobeLookbookModal />);
    expect(screen.getByText(/GARDEROBEN-RASTER/)).toBeTruthy();
  });

  it("zeigt Kontinuitäts-Wächter", () => {
    render(<CharacterWardrobeLookbookModal />);
    expect(screen.getByText(/KONTINUITÄTS-WÄCHTER/)).toBeTruthy();
  });

  it("zeigt Lookbook-Export", () => {
    render(<CharacterWardrobeLookbookModal />);
    expect(screen.getByText(/LOOKBOOK-EXPORT/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CharacterWardrobeLookbookModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
