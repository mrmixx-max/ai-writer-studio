// @vitest-environment jsdom
/**
 * Tests: PhilosophicalDebateEngineModal (WP 74.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhilosophicalDebateEngineModal } from "./PhilosophicalDebateEngineModal";

describe("PhilosophicalDebateEngineModal", () => {
  it("rendert die Komponente", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("philosophical-debate-engine-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByText("⚖️ Philosophische Dialektik & Moral-Dilemma-Engine")).toBeTruthy();
  });

  it("zeigt Positionen", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("debate-positions")).toBeTruthy();
  });

  it("zeigt Argumente", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("debate-arguments")).toBeTruthy();
  });

  it("zeigt Dilemma", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("debate-dilemma")).toBeTruthy();
  });

  it("zeigt Synthesis", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("debate-synthesis")).toBeTruthy();
  });

  it("reagiert auf Thema-Eingabe", () => {
    render(<PhilosophicalDebateEngineModal />);
    fireEvent.change(screen.getByTestId("debate-topic-input"), {
      target: { value: "Neues Thema" },
    });
    expect(screen.getByTestId("debate-positions")).toBeTruthy();
  });

  it("reagiert auf Seed-Eingabe", () => {
    render(<PhilosophicalDebateEngineModal />);
    fireEvent.change(screen.getByTestId("debate-seed-input"), { target: { value: "99" } });
    expect(screen.getByTestId("debate-positions")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<PhilosophicalDebateEngineModal />);
    expect(screen.getByTestId("debate-text").textContent).toContain("PHILOSOPHISCHE DEBATTE");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PhilosophicalDebateEngineModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
