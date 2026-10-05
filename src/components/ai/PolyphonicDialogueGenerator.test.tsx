// @vitest-environment jsdom
/**
 * Tests: PolyphonicDialogueGenerator (WP 54.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolyphonicDialogueGenerator } from "./PolyphonicDialogueGenerator";

describe("PolyphonicDialogueGenerator", () => {
  it("rendert die Komponente", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByTestId("polyphonic-dialogue-generator")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByText("💬 Polyphoner Dialog-Generator")).toBeTruthy();
  });

  it("erzeugt standardmäßig 8 Beiträge", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByTestId("dialogue-turn-1")).toBeTruthy();
    expect(screen.getByTestId("dialogue-turn-8")).toBeTruthy();
  });

  it("zeigt die Besetzung", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByTestId("dialogue-character-Detective")).toBeTruthy();
    expect(screen.getByTestId("dialogue-character-Verdächtige")).toBeTruthy();
  });

  it("ändert die Beitragszahl", () => {
    render(<PolyphonicDialogueGenerator />);
    fireEvent.change(screen.getByTestId("dialogue-turns-input"), { target: { value: "12" } });
    expect(screen.getByTestId("dialogue-turn-12")).toBeTruthy();
  });

  it("übernimmt das Gesprächsziel, wenn Figuren keine Absicht haben", () => {
    render(
      <PolyphonicDialogueGenerator
        initialCharacters={[{ name: "A", pattern: { tempo: 0.9 } }, { name: "B", pattern: { tempo: 0.9 } }]}
      />,
    );
    fireEvent.change(screen.getByTestId("dialogue-conflict-input"), {
      target: { value: "ein Alibi prüfen" },
    });
    expect(screen.getByTestId("dialogue-script").textContent).toContain("Alibi");
  });

  it("bevorzugt die Figuren-Absicht vor dem Gesprächsziel", () => {
    render(<PolyphonicDialogueGenerator />);
    fireEvent.change(screen.getByTestId("dialogue-conflict-input"), {
      target: { value: "ein Alibi prüfen" },
    });
    // Detective hat eine eigene Absicht — sie gewinnt.
    expect(screen.getByTestId("dialogue-script").textContent).toContain("Geständnis");
  });

  it("blendet Körpersprache-Aktionen aus", () => {
    render(<PolyphonicDialogueGenerator />);
    fireEvent.click(screen.getByTestId("dialogue-actions-toggle"));
    expect(screen.queryByTestId("dialogue-action-1")).toBeNull();
  });

  it("zeigt die Polyphonie-Analyse", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByTestId("dialogue-polyphony")).toBeTruthy();
    expect(screen.getByTestId("dialogue-rhythm-index")).toBeTruthy();
  });

  it("berechnet Sprechanteile", () => {
    render(<PolyphonicDialogueGenerator />);
    expect(screen.getByTestId("dialogue-share-Detective")).toBeTruthy();
    expect(screen.getByTestId("dialogue-share-Verdächtige")).toBeTruthy();
  });

  it("zeigt die mittlere Beitragslänge", () => {
    render(<PolyphonicDialogueGenerator />);
    const len = Number(screen.getByTestId("dialogue-avg-length").textContent);
    expect(len).toBeGreaterThan(0);
  });

  it("meldet fehlende Besetzung bei nur einer Figur", () => {
    render(<PolyphonicDialogueGenerator initialCharacters={[{ name: "Solo" }]} />);
    expect(screen.getByTestId("dialogue-empty")).toBeTruthy();
  });

  it("kommt mit leerer Besetzung zurecht", () => {
    render(<PolyphonicDialogueGenerator initialCharacters={[]} />);
    expect(screen.getByTestId("dialogue-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PolyphonicDialogueGenerator />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
