// @vitest-environment jsdom
/**
 * Tests: EpigraphAnthology (WP 52.2 — Kapitel-Epigraph- & Motto-Studio)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EpigraphAnthology } from "./EpigraphAnthology";

describe("EpigraphAnthology", () => {
  it("rendert das Studio", () => {
    render(<EpigraphAnthology />);
    expect(screen.getByTestId("epigraph-anthology")).toBeTruthy();
  });

  it("zeigt Text-Eingabe", () => {
    render(<EpigraphAnthology />);
    expect(screen.getByTestId("epigraph-text")).toBeTruthy();
  });

  it("zeigt Quelle und Autor", () => {
    render(<EpigraphAnthology />);
    expect(screen.getByTestId("epigraph-source")).toBeTruthy();
    expect(screen.getByTestId("epigraph-author")).toBeTruthy();
  });

  it("Copyright-Status wird angezeigt", () => {
    render(<EpigraphAnthology />);
    expect(screen.getByTestId("epigraph-copyright")).toBeTruthy();
  });

  it("Pracht-Satz-Vorschau wird angezeigt", () => {
    render(<EpigraphAnthology />);
    expect(screen.getByTestId("epigraph-preview")).toBeTruthy();
  });

  it("Historisch/Fiktiv-Umschalter funktioniert", () => {
    render(<EpigraphAnthology />);
    fireEvent.click(screen.getByTestId("epigraph-kind-fictional"));
    expect(screen.getByTestId("epigraph-anthology").textContent).toContain("Fiktiv");
  });

  it("Fleuron ist standardmäßig aktiv", () => {
    render(<EpigraphAnthology />);
    expect((screen.getByTestId("epigraph-fleuron") as HTMLInputElement).checked).toBe(true);
  });

  it("Kapitel änderbar", () => {
    render(<EpigraphAnthology />);
    fireEvent.change(screen.getByTestId("epigraph-chapter"), {
      target: { value: "5" },
    });
    expect((screen.getByTestId("epigraph-chapter") as HTMLInputElement).value).toBe("5");
  });

  it("Copyright-Status ändert sich bei Autor", () => {
    render(<EpigraphAnthology />);
    fireEvent.change(screen.getByTestId("epigraph-author"), {
      target: { value: "Goethe" },
    });
    expect(screen.getByTestId("epigraph-copyright")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<EpigraphAnthology />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
