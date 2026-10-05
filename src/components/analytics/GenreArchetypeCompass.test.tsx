// @vitest-environment jsdom
/**
 * Tests: GenreArchetypeCompass (WP 53.2 — Genre-Tropen & Archetypen-Kompass)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenreArchetypeCompass } from "./GenreArchetypeCompass";
import type { Manuscript } from "@/services/analytics/genreArchetypeCompass";

const SAMPLE_MANUSCRIPT: Manuscript = {
  chapters: [
    { number: 1, tropes: ["corpse-early", "closed-circle"] },
    { number: 2, tropes: ["false-alibi", "red-herring"] },
    { number: 3, tropes: ["finale-reconstruction"] },
  ],
};

const EMPTY_MANUSCRIPT: Manuscript = { chapters: [] };

describe("GenreArchetypeCompass", () => {
  it("rendert die Komponente", () => {
    render(<GenreArchetypeCompass />);
    expect(screen.getByTestId("genre-archetype-compass")).toBeTruthy();
  });

  it("zeigt Genre-Titel", () => {
    render(<GenreArchetypeCompass />);
    expect(screen.getByText("🧭 Genre-Tropen-Kompass")).toBeTruthy();
  });

  it("lädt die Tropen-Checkliste für Whodunit", () => {
    render(<GenreArchetypeCompass initialGenre="whodunit" />);
    expect(screen.getByTestId("trope-corpse-early")).toBeTruthy();
    expect(screen.getByTestId("trope-closed-circle")).toBeTruthy();
    expect(screen.getByTestId("trope-finale-reconstruction")).toBeTruthy();
  });

  it("zeigt Kern-Tropen hervorgehoben", () => {
    render(<GenreArchetypeCompass initialGenre="whodunit" />);
    const tropeElements = screen.getAllByTestId(/trope-/);
    expect(tropeElements.length).toBeGreaterThan(0);
  });

  it("wechselt Genre bei Auswahl", () => {
    render(<GenreArchetypeCompass initialGenre="whodunit" />);
    const select = screen.getByTestId("genre-select");
    fireEvent.change(select, { target: { value: "heist" } });
    // Heist hat "planning" als Trope
    expect(screen.getByTestId("trope-planning")).toBeTruthy();
  });

  it("zeigt Fehlende-Tropen-Warnung bei Manuskript", () => {
    render(<GenreArchetypeCompass manuscript={SAMPLE_MANUSCRIPT} initialGenre="whodunit" />);
    expect(screen.getByTestId("trope-missing-warning")).toBeTruthy();
  });

  it("berechnet Subversions-Score", () => {
    render(<GenreArchetypeCompass manuscript={SAMPLE_MANUSCRIPT} initialGenre="whodunit" />);
    expect(screen.getByTestId("subversion-score")).toBeTruthy();
  });

  it("zeigt Erfüllungsrate als Balken", () => {
    render(<GenreArchetypeCompass manuscript={SAMPLE_MANUSCRIPT} initialGenre="whodunit" />);
    expect(screen.getByTestId("fulfillment-visualization")).toBeTruthy();
  });

  it("zeigt Warnung bei vielen fehlenden Tropen", () => {
    render(<GenreArchetypeCompass manuscript={EMPTY_MANUSCRIPT} initialGenre="whodunit" />);
    const warning = screen.getByTestId("trope-missing-warning");
    expect(warning.textContent).toContain("Gefahr");
  });

  it("zeigt Perfekt-Hinweis bei vollständigem Manuskript", () => {
    const completeManuscript: Manuscript = {
      chapters: [
        { number: 1, tropes: ["corpse-early", "closed-circle", "false-alibi"] },
        { number: 2, tropes: ["red-herring"] },
        { number: 3, tropes: ["finale-reconstruction"] },
      ],
    };
    render(<GenreArchetypeCompass manuscript={completeManuscript} initialGenre="whodunit" />);
    const warning = screen.getByTestId("trope-missing-warning");
    expect(warning.textContent).toContain("Perfekt abgestimmt");
  });

  it("funktioniert ohne Manuskript", () => {
    render(<GenreArchetypeCompass manuscript={undefined} initialGenre="whodunit" />);
    expect(screen.getByTestId("genre-archetype-compass")).toBeTruthy();
    expect(screen.getByTestId("trope-corpse-early")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<GenreArchetypeCompass manuscript={SAMPLE_MANUSCRIPT} initialGenre="whodunit" />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });

  it("zeigt alle Genres in der Auswahl", () => {
    render(<GenreArchetypeCompass />);
    const select = screen.getByTestId("genre-select") as HTMLSelectElement;
    expect(select.options.length).toBe(5);
  });
});