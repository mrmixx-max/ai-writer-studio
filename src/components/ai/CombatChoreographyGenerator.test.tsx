// @vitest-environment jsdom
/**
 * Tests: CombatChoreographyGenerator (WP 56.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CombatChoreographyGenerator } from "./CombatChoreographyGenerator";

describe("CombatChoreographyGenerator", () => {
  it("rendert die Komponente", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-choreography-generator")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByText("⚔️ Kampf-Choreograf")).toBeTruthy();
  });

  it("zeigt die Kämpfer mit Waffen", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-fighter-Raven").textContent).toContain("Langschwert");
    expect(screen.getByTestId("combat-fighter-Kessler").textContent).toContain("Dolch");
  });

  it("erzeugt Choreografie-Beats", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-beat-1")).toBeTruthy();
    expect(screen.getByTestId("combat-beat-10")).toBeTruthy();
  });

  it("Tempo-Wechsel ändert die Beat-Anzahl", () => {
    render(<CombatChoreographyGenerator />);
    fireEvent.click(screen.getByTestId("combat-tempo-measured"));
    expect(screen.queryByTestId("combat-beat-10")).toBeNull();
    expect(screen.getByTestId("combat-beat-6")).toBeTruthy();
  });

  it("markiert das aktive Tempo", () => {
    render(<CombatChoreographyGenerator />);
    fireEvent.click(screen.getByTestId("combat-tempo-frantic"));
    expect(screen.getByTestId("combat-tempo-frantic").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("combat-tempo-kinetic").getAttribute("aria-pressed")).toBe("false");
  });

  it("schaltet Hindernisse um", () => {
    render(<CombatChoreographyGenerator />);
    const before = screen.getByTestId("combat-choreography").textContent;
    fireEvent.click(screen.getByTestId("combat-obstacle-smoke"));
    expect(screen.getByTestId("combat-obstacle-smoke").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("combat-choreography").textContent).not.toBe(before);
  });

  it("entfernt Hindernisse beim zweiten Klick", () => {
    render(<CombatChoreographyGenerator />);
    fireEvent.click(screen.getByTestId("combat-obstacle-rain"));
    expect(screen.getByTestId("combat-obstacle-rain").getAttribute("aria-pressed")).toBe("false");
  });

  it("zeigt den Anatomie-Wächter", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-guard")).toBeTruthy();
    expect(screen.getByTestId("combat-guard-status")).toBeTruthy();
  });

  it("meldet Verstöße des Wächters", () => {
    render(<CombatChoreographyGenerator />);
    // Die Demo-Kombination (Langschwert einhändig + Nachladen) ist unmöglich.
    const status = screen.getByTestId("combat-guard-status").textContent ?? "";
    expect(status).toContain("Verstoß");
  });

  it("listet die Verstöße auf", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-guard-violations")).toBeTruthy();
  });

  it("zeigt die Rhythmus-Analyse", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-pacing")).toBeTruthy();
    expect(screen.getByTestId("combat-avg-length")).toBeTruthy();
    expect(screen.getByTestId("combat-staccato")).toBeTruthy();
  });

  it("zeigt den Rhythmus-Score", () => {
    render(<CombatChoreographyGenerator />);
    expect(screen.getByTestId("combat-rhythm-score").textContent).toContain("Rhythmus-Score");
  });

  it("meldet fehlende Kämpfer bei nur einer Figur", () => {
    render(<CombatChoreographyGenerator initialCombatants={[{ name: "Solo" }]} />);
    expect(screen.getByTestId("combat-empty")).toBeTruthy();
  });

  it("kommt mit leerer Besetzung zurecht", () => {
    render(<CombatChoreographyGenerator initialCombatants={[]} />);
    expect(screen.getByTestId("combat-empty")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<CombatChoreographyGenerator />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
