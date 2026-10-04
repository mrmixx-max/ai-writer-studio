// @vitest-environment jsdom
/**
 * Tests: BookTrailerStudio (WP 44.1 — Social Buchtrailer-Studio)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookTrailerStudio } from "./BookTrailerStudio";

describe("BookTrailerStudio", () => {
  it("rendert das Studio", () => {
    render(<BookTrailerStudio />);
    expect(screen.getByTestId("book-trailer-studio")).toBeTruthy();
  });

  it("bietet beide Formate an", () => {
    render(<BookTrailerStudio />);
    expect(screen.getByTestId("trailer-format-vertical")).toBeTruthy();
    expect(screen.getByTestId("trailer-format-horizontal")).toBeTruthy();
  });

  it("zeigt 5 Keyframes", () => {
    render(<BookTrailerStudio />);
    expect(screen.getByTestId("trailer-keyframe-hook")).toBeTruthy();
    expect(screen.getByTestId("trailer-keyframe-particles")).toBeTruthy();
    expect(screen.getByTestId("trailer-keyframe-title")).toBeTruthy();
    expect(screen.getByTestId("trailer-keyframe-cover-rotate")).toBeTruthy();
    expect(screen.getByTestId("trailer-keyframe-cta")).toBeTruthy();
  });

  it("Formwechsel ändert die Abmessungen", () => {
    render(<BookTrailerStudio />);
    const text = () => screen.getByTestId("book-trailer-studio").textContent ?? "";
    expect(text()).toContain("1080×1920");
    fireEvent.click(screen.getByTestId("trailer-format-horizontal"));
    expect(text()).toContain("1920×1080");
  });

  it("Titeleingabe wirkt auf die Titelschrift-Vorschau", () => {
    render(<BookTrailerStudio />);
    fireEvent.change(screen.getByTestId("trailer-input-title"), {
      target: { value: "Neuer Titel" },
    });
    // Zum Titel-Keyframe springen (6–9 s), dort wird der Titel gezeigt.
    fireEvent.click(screen.getByTestId("trailer-keyframe-title"));
    expect(screen.getByTestId("trailer-preview-text").textContent).toContain("Neuer Titel");
  });

  it("Klick auf Keyframe setzt die Vorschauzeit", () => {
    render(<BookTrailerStudio />);
    fireEvent.click(screen.getByTestId("trailer-keyframe-cta"));
    const preview = screen.getByTestId("trailer-preview-text").textContent ?? "";
    expect(preview.length).toBeGreaterThan(0);
  });

  it("Scrubber ändert die Vorschau", () => {
    render(<BookTrailerStudio />);
    fireEvent.change(screen.getByTestId("trailer-scrub"), { target: { value: "7000" } });
    expect(screen.getByTestId("book-trailer-studio").textContent).toContain("7.0 s");
  });

  it("Export erzeugt SVG-Ausgabe", () => {
    render(<BookTrailerStudio />);
    fireEvent.click(screen.getByTestId("trailer-export"));
    expect(screen.getByTestId("trailer-svg-output")).toBeTruthy();
  });

  it("SVG-Ausgabe enthält svg-Tag", () => {
    render(<BookTrailerStudio />);
    fireEvent.click(screen.getByTestId("trailer-export"));
    expect(screen.getByTestId("trailer-svg-output").textContent).toContain("<svg");
  });

  it("Vorschau zeigt Opacity/Scale/Rotation", () => {
    render(<BookTrailerStudio />);
    const text = screen.getByTestId("trailer-preview").textContent ?? "";
    expect(text).toMatch(/Opacity/);
    expect(text).toMatch(/Scale/);
    expect(text).toMatch(/Rotation/);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<BookTrailerStudio />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
