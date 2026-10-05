// @vitest-environment jsdom
/**
 * Tests: PlotTwistSynthesizerModal (WP 58.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlotTwistSynthesizerModal } from "./PlotTwistSynthesizerModal";

describe("PlotTwistSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<PlotTwistSynthesizerModal />);
    expect(screen.getByTestId("plot-twist-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<PlotTwistSynthesizerModal />);
    expect(screen.getByText("💥 Plot-Twist-Synthesizer")).toBeTruthy();
  });

  it("erzeugt einen Twist", () => {
    render(<PlotTwistSynthesizerModal />);
    expect((screen.getByTestId("twist-reveal").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("zeigt alle vier Archetypen", () => {
    render(<PlotTwistSynthesizerModal />);
    ["identity-reveal", "false-objective", "moral-reversal", "sacrifice-choice"].forEach((a) => {
      expect(screen.getByTestId(`twist-archetype-${a}`)).toBeTruthy();
    });
  });

  it("wechselt den Archetyp", () => {
    render(<PlotTwistSynthesizerModal />);
    const before = screen.getByTestId("twist-reveal").textContent;
    fireEvent.click(screen.getByTestId("twist-archetype-sacrifice-choice"));
    expect(screen.getByTestId("twist-reveal").textContent).not.toBe(before);
  });

  it("markiert den aktiven Archetyp", () => {
    render(<PlotTwistSynthesizerModal />);
    fireEvent.click(screen.getByTestId("twist-archetype-moral-reversal"));
    expect(
      screen.getByTestId("twist-archetype-moral-reversal").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("zeigt den Archetyp-Namen", () => {
    render(<PlotTwistSynthesizerModal />);
    fireEvent.click(screen.getByTestId("twist-archetype-identity-reveal"));
    expect(screen.getByTestId("twist-output").textContent).toContain("IDENTITÄTS-ENTHÜLLUNG");
  });

  it("nennt den Antagonisten bei der Identitäts-Enthüllung", () => {
    render(<PlotTwistSynthesizerModal />);
    fireEvent.click(screen.getByTestId("twist-archetype-identity-reveal"));
    expect(screen.getByTestId("twist-reveal").textContent).toContain("Meister Halden");
  });

  it("übernimmt einen neuen Helden", () => {
    render(<PlotTwistSynthesizerModal />);
    fireEvent.click(screen.getByTestId("twist-archetype-sacrifice-choice"));
    fireEvent.change(screen.getByTestId("twist-protagonist-input"), {
      target: { value: "Kira" },
    });
    expect(screen.getByTestId("twist-reveal").textContent).toContain("Kira");
  });

  it("zeigt die Vorbereitungs-Hinweise", () => {
    render(<PlotTwistSynthesizerModal />);
    expect(screen.getByTestId("twist-setup-1")).toBeTruthy();
    expect(screen.getByTestId("twist-setup-2")).toBeTruthy();
  });

  it("zeigt die Wirksamkeit", () => {
    render(<PlotTwistSynthesizerModal />);
    expect(screen.getByTestId("twist-impact")).toBeTruthy();
    expect(screen.getByTestId("twist-surprise")).toBeTruthy();
    expect(screen.getByTestId("twist-preparation")).toBeTruthy();
  });

  it("zeigt die Wirksamkeits-Empfehlung", () => {
    render(<PlotTwistSynthesizerModal />);
    expect((screen.getByTestId("twist-recommendation").textContent ?? "").length).toBeGreaterThan(10);
  });

  it("erzeugt die Konfrontationsszene", () => {
    render(<PlotTwistSynthesizerModal />);
    const text = screen.getByTestId("twist-scene-text").textContent ?? "";
    expect(text.length).toBeGreaterThan(100);
    expect(text).toContain("ARON:");
  });

  it("zeigt die emotionale Wirkung", () => {
    render(<PlotTwistSynthesizerModal />);
    expect(screen.getByTestId("twist-output").textContent).toContain("Wirkung");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PlotTwistSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
