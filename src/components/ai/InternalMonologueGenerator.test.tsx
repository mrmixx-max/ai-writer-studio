// @vitest-environment jsdom
/**
 * Tests: InternalMonologueGenerator (WP 57.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InternalMonologueGenerator } from "./InternalMonologueGenerator";

describe("InternalMonologueGenerator", () => {
  it("rendert die Komponente", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByTestId("internal-monologue-generator")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByText("🧠 Deep POV & Innerer Monolog")).toBeTruthy();
  });

  it("zeigt alle drei Zustände", () => {
    render(<InternalMonologueGenerator />);
    ["panic", "calculation", "grief"].forEach((s) => {
      expect(screen.getByTestId(`monologue-state-${s}`)).toBeTruthy();
    });
  });

  it("erzeugt einen Monolog", () => {
    render(<InternalMonologueGenerator />);
    const text = screen.getByTestId("monologue-output-text").textContent ?? "";
    expect(text.length).toBeGreaterThan(10);
  });

  it("wechselt den Zustand", () => {
    render(<InternalMonologueGenerator />);
    const before = screen.getByTestId("monologue-output-text").textContent;
    fireEvent.click(screen.getByTestId("monologue-state-grief"));
    expect(screen.getByTestId("monologue-output-text").textContent).not.toBe(before);
  });

  it("markiert den aktiven Zustand", () => {
    render(<InternalMonologueGenerator />);
    fireEvent.click(screen.getByTestId("monologue-state-calculation"));
    expect(screen.getByTestId("monologue-state-calculation").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("monologue-state-panic").getAttribute("aria-pressed")).toBe("false");
  });

  it("zeigt den Zustandsnamen im Ausgabe-Header", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByTestId("monologue-output").textContent).toContain("Rasende Panik");
  });

  it("ändert die Fragmentzahl", () => {
    render(<InternalMonologueGenerator />);
    fireEvent.change(screen.getByTestId("monologue-fragments-input"), { target: { value: "12" } });
    expect(screen.getByTestId("monologue-output").textContent).toContain("12 Fragmente");
  });

  it("übernimmt die Situation", () => {
    render(<InternalMonologueGenerator />);
    fireEvent.change(screen.getByTestId("monologue-situation-input"), {
      target: { value: "im brennenden Haus" },
    });
    expect(screen.getByTestId("monologue-output-text").textContent).toContain("brennenden Haus");
  });

  it("zeigt die POV-Tiefe", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByTestId("monologue-depth")).toBeTruthy();
    expect(screen.getByTestId("monologue-depth-value").textContent).toContain("Tiefe");
  });

  it("erlebte Rede hat keine distanzierenden Marker", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByTestId("monologue-markers").textContent).toBe("0");
  });

  it("zeigt die Sensorik-Treffer", () => {
    render(<InternalMonologueGenerator />);
    expect(screen.getByTestId("monologue-sensory")).toBeTruthy();
  });

  it("bereinigt distanzierende Marker", () => {
    render(<InternalMonologueGenerator />);
    const cleaned = screen.getByTestId("monologue-cleaned").textContent ?? "";
    expect(cleaned.toLowerCase()).not.toContain("dachte");
    expect(cleaned).toContain("zu spät");
  });

  it("meldet die entfernten Marker", () => {
    render(<InternalMonologueGenerator />);
    const removed = Number(screen.getByTestId("monologue-removed").textContent);
    expect(removed).toBeGreaterThan(0);
  });

  it("erhöht die Tiefe nach der Bereinigung", () => {
    render(<InternalMonologueGenerator />);
    const before = Number((screen.getByTestId("monologue-depth-before").textContent ?? "").replace("%", ""));
    const after = Number((screen.getByTestId("monologue-depth-after").textContent ?? "").replace("%", ""));
    expect(after).toBeGreaterThan(before);
  });

  it("übernimmt neuen Bereinigungstext", () => {
    render(<InternalMonologueGenerator />);
    fireEvent.change(screen.getByTestId("monologue-clean-input"), {
      target: { value: "Es war vorbei, dachte sie." },
    });
    expect(screen.getByTestId("monologue-cleaned").textContent).toContain("vorbei");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<InternalMonologueGenerator />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
