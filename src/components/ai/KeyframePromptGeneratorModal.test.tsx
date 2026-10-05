// @vitest-environment jsdom
/**
 * Tests: KeyframePromptGeneratorModal (WP 66.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyframePromptGeneratorModal } from "./KeyframePromptGeneratorModal";

describe("KeyframePromptGeneratorModal", () => {
  it("rendert die Komponente", () => {
    render(<KeyframePromptGeneratorModal />);
    expect(screen.getByTestId("keyframe-prompt-generator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<KeyframePromptGeneratorModal />);
    expect(screen.getByText("🖼️ Keyframe Prompt Studio")).toBeTruthy();
  });

  it("zeigt das Keyframe-Paar", () => {
    render(<KeyframePromptGeneratorModal />);
    expect(screen.getByTestId("keyframe-pair")).toBeTruthy();
  });

  it("reagiert auf Startframe-Eingabe", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-start-input"), {
      target: { value: "A spaceship lands" },
    });
    expect(screen.getByTestId("keyframe-pair").textContent).toContain("spaceship lands");
  });

  it("reagiert auf Endframe-Eingabe", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-end-input"), {
      target: { value: "The ship explodes" },
    });
    expect(screen.getByTestId("keyframe-pair").textContent).toContain("ship explodes");
  });

  it("reagiert auf Engine-Auswahl", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-engine-select"), {
      target: { value: "leonardo" },
    });
    expect(screen.getByTestId("keyframe-prompt-generator-modal").textContent).toContain("Leonardo");
  });

  it("reagiert auf Seitenverhältnis-Auswahl", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-aspect-select"), {
      target: { value: "2.39:1" },
    });
    expect(screen.getByTestId("keyframe-pair").textContent).toContain("2.39:1");
  });

  it("reagiert auf Kamera-Auswahl", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-camera-select"), {
      target: { value: "imax-70mm" },
    });
    expect(screen.getByTestId("keyframe-pair").textContent).toContain("IMAX");
  });

  it("reagiert auf Paar-Anzahl-Slider", () => {
    render(<KeyframePromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("keyframe-count-input"), {
      target: { value: "4" },
    });
    expect(screen.getByTestId("keyframe-pair-3")).toBeTruthy();
  });

  it("zeigt die vollständige Ausgabe", () => {
    render(<KeyframePromptGeneratorModal />);
    expect(screen.getByTestId("keyframe-formatted").textContent).toContain("START FRAME");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<KeyframePromptGeneratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
