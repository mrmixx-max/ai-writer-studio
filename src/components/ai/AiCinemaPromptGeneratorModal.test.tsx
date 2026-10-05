// @vitest-environment jsdom
/**
 * Tests: AiCinemaPromptGeneratorModal (WP 66.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiCinemaPromptGeneratorModal } from "./AiCinemaPromptGeneratorModal";

describe("AiCinemaPromptGeneratorModal", () => {
  it("rendert die Komponente", () => {
    render(<AiCinemaPromptGeneratorModal />);
    expect(screen.getByTestId("ai-cinema-prompt-generator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AiCinemaPromptGeneratorModal />);
    expect(screen.getByText("🎬 AI Cinema Prompt Director")).toBeTruthy();
  });

  it("zeigt die Shot-Liste", () => {
    render(<AiCinemaPromptGeneratorModal />);
    expect(screen.getByTestId("cinema-shot-list")).toBeTruthy();
    expect(screen.getByTestId("cinema-shot-1")).toBeTruthy();
  });

  it("zeigt Konsistenz-Tags", () => {
    render(<AiCinemaPromptGeneratorModal />);
    expect(screen.getByTestId("cinema-consistency-tags")).toBeTruthy();
    expect(screen.getByTestId("cinema-tag-hair")).toBeTruthy();
  });

  it("reagiert auf Szenen-Eingabe", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-scene-input"), {
      target: { value: "A car chase through Tokyo" },
    });
    expect(screen.getByTestId("cinema-shot-1").textContent).toContain("car chase");
  });

  it("reagiert auf Engine-Auswahl", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-engine-select"), {
      target: { value: "runway" },
    });
    expect(screen.getByTestId("cinema-shot-1").textContent).toContain("Camera");
  });

  it("reagiert auf Haarfarbe-Eingabe", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-hair-input"), {
      target: { value: "blonde" },
    });
    expect(screen.getByTestId("cinema-tag-hair").textContent).toContain("blonde");
  });

  it("reagiert auf Kleidung-Eingabe", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-clothing-input"), {
      target: { value: "armor" },
    });
    expect(screen.getByTestId("cinema-tag-clothing").textContent).toContain("armor");
  });

  it("reagiert auf Alter-Eingabe", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-age-input"), {
      target: { value: "elderly" },
    });
    expect(screen.getByTestId("cinema-tag-age").textContent).toContain("elderly");
  });

  it("reagiert auf Beleuchtung-Eingabe", () => {
    render(<AiCinemaPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("cinema-lighting-input"), {
      target: { value: "moonlight" },
    });
    expect(screen.getByTestId("cinema-tag-lighting").textContent).toContain("moonlight");
  });

  it("zeigt die vollständige Shot-Liste", () => {
    render(<AiCinemaPromptGeneratorModal />);
    expect(screen.getByTestId("cinema-formatted").textContent).toContain("Shot 01");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AiCinemaPromptGeneratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
