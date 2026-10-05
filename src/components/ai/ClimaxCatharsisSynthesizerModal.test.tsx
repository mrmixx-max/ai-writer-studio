// @vitest-environment jsdom
/**
 * Tests: ClimaxCatharsisSynthesizerModal (WP 59.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClimaxCatharsisSynthesizerModal } from "./ClimaxCatharsisSynthesizerModal";

describe("ClimaxCatharsisSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByTestId("climax-catharsis-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByText("🔥 Klimax- & Katharsis-Synthesizer")).toBeTruthy();
  });

  it("erzeugt die Klimax", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect((screen.getByTestId("climax-text").textContent ?? "").length).toBeGreaterThan(50);
  });

  it("erzeugt die Katharsis", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect((screen.getByTestId("catharsis-text").textContent ?? "").length).toBeGreaterThan(30);
  });

  it("übernimmt die äußere Gefahr", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByTestId("climax-text").textContent).toContain("Seil begann zu reißen");
  });

  it("übernimmt den Ort", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByTestId("climax-text").textContent).toContain("Brücke");
  });

  it("zeigt alle fünf Charakterschwächen", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    ["pride", "fear", "guilt", "isolation", "revenge"].forEach((f) => {
      expect(screen.getByTestId(`climax-flaw-${f}`)).toBeTruthy();
    });
  });

  it("wechselt die Charakterschwäche", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    const before = screen.getByTestId("climax-text").textContent;
    fireEvent.click(screen.getByTestId("climax-flaw-revenge"));
    expect(screen.getByTestId("climax-text").textContent).not.toBe(before);
  });

  it("markiert die aktive Schwäche", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    fireEvent.click(screen.getByTestId("climax-flaw-guilt"));
    expect(screen.getByTestId("climax-flaw-guilt").getAttribute("aria-pressed")).toBe("true");
  });

  it("zeigt den Schwächen-Namen", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    fireEvent.click(screen.getByTestId("climax-flaw-pride"));
    expect(screen.getByTestId("climax-output").textContent).toContain("HOCHMUT");
  });

  it("zeigt die innere Wandlung", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect((screen.getByTestId("climax-transformation").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("zeigt die Intensitätskurve", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByTestId("climax-curve")).toBeTruthy();
    expect(screen.getByTestId("climax-curve-bar-0")).toBeTruthy();
  });

  it("zeigt die Kurvenanalyse", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    expect(screen.getByTestId("climax-peak")).toBeTruthy();
    expect(screen.getByTestId("climax-ending")).toBeTruthy();
    expect(screen.getByTestId("climax-drop")).toBeTruthy();
  });

  it("bewertet die Kurvenform", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    const text = screen.getByTestId("climax-wellformed").textContent ?? "";
    expect(text.length).toBeGreaterThan(10);
  });

  it("erkennt die Charakterschwäche im Text", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    const result = screen.getByTestId("climax-flaw-result").textContent ?? "";
    expect(result).toContain("Erkannt");
  });

  it("übernimmt den Helden", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    fireEvent.change(screen.getByTestId("climax-protagonist-input"), {
      target: { value: "Jonas" },
    });
    expect(screen.getByTestId("climax-catharsis-synthesizer-modal").textContent).toContain("Jonas");
  });

  it("meldet keine Schwäche bei neutralem Text", () => {
    render(<ClimaxCatharsisSynthesizerModal />);
    fireEvent.change(screen.getByTestId("climax-flaw-text-input"), {
      target: { value: "Der Fluss floss ruhig." },
    });
    expect(screen.getByTestId("climax-flaw-result").textContent).toContain("Keine");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ClimaxCatharsisSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
