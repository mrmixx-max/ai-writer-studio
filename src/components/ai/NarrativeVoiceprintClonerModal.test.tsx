// @vitest-environment jsdom
/**
 * Tests: NarrativeVoiceprintClonerModal (WP 81.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NarrativeVoiceprintClonerModal } from "./NarrativeVoiceprintClonerModal";

describe("NarrativeVoiceprintClonerModal", () => {
  it("rendert die Komponente", () => {
    render(<NarrativeVoiceprintClonerModal />);
    expect(screen.getByTestId("voiceprint-cloner-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<NarrativeVoiceprintClonerModal />);
    expect(screen.getByText("🎭 Neuraler Autoren-Stimmabdruck & Voiceprint-Kloner")).toBeTruthy();
  });

  it("zeigt Stimmabdruck", () => {
    render(<NarrativeVoiceprintClonerModal />);
    expect(screen.getByTestId("voiceprint-profile")).toBeTruthy();
  });

  it("zeigt Stiltreue", () => {
    render(<NarrativeVoiceprintClonerModal />);
    expect(screen.getByTestId("voiceprint-match")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<NarrativeVoiceprintClonerModal />);
    fireEvent.change(screen.getByTestId("voiceprint-text-input"), {
      target: { value: "Ein neuer Text." },
    });
    expect(screen.getByTestId("voiceprint-profile")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<NarrativeVoiceprintClonerModal />);
    expect(screen.getByTestId("voiceprint-text").textContent).toContain("STIMMABDRUCK");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<NarrativeVoiceprintClonerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
