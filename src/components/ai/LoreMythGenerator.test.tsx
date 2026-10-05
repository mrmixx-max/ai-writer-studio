// @vitest-environment jsdom
/**
 * Tests: LoreMythGenerator (WP 57.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoreMythGenerator } from "./LoreMythGenerator";

describe("LoreMythGenerator", () => {
  it("rendert die Komponente", () => {
    render(<LoreMythGenerator />);
    expect(screen.getByTestId("lore-myth-generator")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<LoreMythGenerator />);
    expect(screen.getByText("📜 Mythen- & Prophezeiungs-Generator")).toBeTruthy();
  });

  it("zeigt alle vier Textsorten", () => {
    render(<LoreMythGenerator />);
    ["oracle", "tavern-song", "creation-myth", "battle-chronicle"].forEach((k) => {
      expect(screen.getByTestId(`lore-kind-${k}`)).toBeTruthy();
    });
  });

  it("erzeugt Verse", () => {
    render(<LoreMythGenerator />);
    const text = screen.getByTestId("lore-text").textContent ?? "";
    expect(text.split("\n").filter((l) => l.trim()).length).toBe(12);
  });

  it("zeigt einen Titel", () => {
    render(<LoreMythGenerator />);
    expect((screen.getByTestId("lore-title").textContent ?? "").length).toBeGreaterThan(5);
  });

  it("wechselt die Textsorte", () => {
    render(<LoreMythGenerator />);
    const before = screen.getByTestId("lore-text").textContent;
    fireEvent.click(screen.getByTestId("lore-kind-tavern-song"));
    expect(screen.getByTestId("lore-text").textContent).not.toBe(before);
  });

  it("markiert die aktive Textsorte", () => {
    render(<LoreMythGenerator />);
    fireEvent.click(screen.getByTestId("lore-kind-battle-chronicle"));
    expect(
      screen.getByTestId("lore-kind-battle-chronicle").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("übernimmt das Thema in den Titel", () => {
    render(<LoreMythGenerator />);
    fireEvent.change(screen.getByTestId("lore-subject-input"), {
      target: { value: "alten Recken" },
    });
    expect(screen.getByTestId("lore-title").textContent).toContain("alten Recken");
  });

  it("ändert die Strophenzahl", () => {
    render(<LoreMythGenerator />);
    fireEvent.change(screen.getByTestId("lore-stanzas-input"), { target: { value: "5" } });
    const text = screen.getByTestId("lore-text").textContent ?? "";
    expect(text.split("\n").filter((l) => l.trim()).length).toBe(20);
  });

  it("überschreibt das Metrum", () => {
    render(<LoreMythGenerator />);
    fireEvent.change(screen.getByTestId("lore-meter-select"), { target: { value: "iambus" } });
    expect(screen.getByTestId("lore-myth-generator")).toBeTruthy();
  });

  it("überschreibt das Reimschema", () => {
    render(<LoreMythGenerator />);
    fireEvent.change(screen.getByTestId("lore-rhyme-select"), { target: { value: "none" } });
    expect(screen.getByTestId("lore-text").textContent).toBeTruthy();
  });

  it("zeigt die Metrum-Analyse", () => {
    render(<LoreMythGenerator />);
    expect(screen.getByTestId("lore-meter-analysis")).toBeTruthy();
    expect(screen.getByTestId("lore-meter-lines").textContent).toBe("12");
  });

  it("berechnet die Silbenzahl", () => {
    render(<LoreMythGenerator />);
    const syl = Number(screen.getByTestId("lore-meter-syllables").textContent);
    expect(syl).toBeGreaterThan(0);
  });

  it("zeigt das erkannte Metrum", () => {
    render(<LoreMythGenerator />);
    expect(screen.getByTestId("lore-meter-detected")).toBeTruthy();
    expect(screen.getByTestId("lore-rhyme-detected")).toBeTruthy();
  });

  it("exportiert ein Epigraph", () => {
    render(<LoreMythGenerator />);
    const ep = screen.getByTestId("lore-epigraph").textContent ?? "";
    expect(ep.length).toBeGreaterThan(20);
    expect(ep).toContain("❦");
  });

  it("übernimmt die Kapitelnummer", () => {
    render(<LoreMythGenerator />);
    fireEvent.change(screen.getByTestId("lore-epigraph-chapter"), { target: { value: "7" } });
    expect(screen.getByTestId("lore-epigraph").textContent).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<LoreMythGenerator />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
