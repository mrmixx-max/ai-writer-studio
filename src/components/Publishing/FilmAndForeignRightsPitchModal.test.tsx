// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FilmAndForeignRightsPitchModal } from "./FilmAndForeignRightsPitchModal";

describe("FilmAndForeignRightsPitchModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<FilmAndForeignRightsPitchModal />);
    expect(getByTestId("rights-pitch-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<FilmAndForeignRightsPitchModal />);
    expect(
      screen.getByText("🎬 Film-, TV- & Auslandsrechte-Pitch-Deck")
    ).toBeTruthy();
  });

  it("zeigt FILM-DOSSIER", () => {
    render(<FilmAndForeignRightsPitchModal />);
    expect(screen.getByText("FILM-DOSSIER")).toBeTruthy();
  });

  it("zeigt AUSLANDSRECHTE", () => {
    render(<FilmAndForeignRightsPitchModal />);
    expect(screen.getByText("AUSLANDSRECHTE")).toBeTruthy();
  });

  it("zeigt PDF-EXPORT", () => {
    render(<FilmAndForeignRightsPitchModal />);
    expect(screen.getByText("PDF-EXPORT")).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<FilmAndForeignRightsPitchModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
