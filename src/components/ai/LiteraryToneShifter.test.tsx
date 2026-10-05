// @vitest-environment jsdom
/**
 * Tests: LiteraryToneShifter (WP 55.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiteraryToneShifter } from "./LiteraryToneShifter";

describe("LiteraryToneShifter", () => {
  it("rendert die Komponente", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByTestId("literary-tone-shifter")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByText("🎭 Stil-Transmuter & Tonfall-Shifter")).toBeTruthy();
  });

  it("zeigt alle vier Stil-Presets", () => {
    render(<LiteraryToneShifter />);
    ["hardboiled", "gothic", "epic-fantasy", "hemingway"].forEach((p) => {
      expect(screen.getByTestId(`tone-preset-${p}`)).toBeTruthy();
    });
  });

  it("erzeugt umgeschriebenen Text", () => {
    render(<LiteraryToneShifter />);
    const text = screen.getByTestId("tone-output-text").textContent ?? "";
    expect(text.length).toBeGreaterThan(10);
  });

  it("wechselt den Stil", () => {
    render(<LiteraryToneShifter />);
    const before = screen.getByTestId("tone-output-text").textContent;
    fireEvent.click(screen.getByTestId("tone-preset-gothic"));
    expect(screen.getByTestId("tone-output-text").textContent).not.toBe(before);
  });

  it("markiert das aktive Preset", () => {
    render(<LiteraryToneShifter />);
    fireEvent.click(screen.getByTestId("tone-preset-gothic"));
    expect(screen.getByTestId("tone-preset-gothic").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("tone-preset-hardboiled").getAttribute("aria-pressed")).toBe("false");
  });

  it("zeigt die Preset-Beschreibung", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByTestId("tone-preset-description").textContent).toContain("Zynismus");
  });

  it("bestätigt die Inhalts-Garantie", () => {
    render(<LiteraryToneShifter />);
    const status = screen.getByTestId("tone-preserved-status").textContent ?? "";
    expect(status).toContain("Inhalt erhalten");
  });

  it("listet geschützte Eigennamen", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByTestId("tone-names").textContent).toContain("Miller");
  });

  it("übernimmt neuen Quelltext", () => {
    render(<LiteraryToneShifter />);
    fireEvent.change(screen.getByTestId("tone-source-input"), {
      target: { value: "Schmidt wartete am Kai." },
    });
    expect(screen.getByTestId("tone-output-text").textContent).toContain("Schmidt");
  });

  it("zeigt den Stilvergleich", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByTestId("tone-comparison")).toBeTruthy();
    expect(screen.getByTestId("tone-row-sentences")).toBeTruthy();
    expect(screen.getByTestId("tone-row-avglen")).toBeTruthy();
  });

  it("zeigt die Stil-Divergenz", () => {
    render(<LiteraryToneShifter />);
    expect(screen.getByTestId("tone-divergence").textContent).toContain("Divergenz");
  });

  it("kommt mit leerem Quelltext zurecht", () => {
    render(<LiteraryToneShifter initialText="" />);
    expect(screen.getByTestId("tone-output-text").textContent).toBe("—");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<LiteraryToneShifter />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
