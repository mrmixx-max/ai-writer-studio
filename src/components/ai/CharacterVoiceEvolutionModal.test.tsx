// @vitest-environment jsdom
/**
 * Tests: CharacterVoiceEvolutionModal (WP 64.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharacterVoiceEvolutionModal } from "./CharacterVoiceEvolutionModal";

describe("CharacterVoiceEvolutionModal", () => {
  it("rendert die Komponente", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByTestId("character-voice-evolution-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByText("🎙️ Figurenstimmen-Evolutions-Modulator")).toBeTruthy();
  });

  it(" zeigt die Vorher/Nachher-Gegenüberstellung", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByTestId("voice-comparison")).toBeTruthy();
    expect(screen.getByTestId("voice-before-verbosity")).toBeTruthy();
    expect(screen.getByTestId("voice-after-verbosity")).toBeTruthy();
  });

  it("senkt die Gesprächigkeit nach Zäsuren", () => {
    render(<CharacterVoiceEvolutionModal />);
    const before = screen.getByTestId("voice-before-verbosity").textContent ?? "";
    const after = screen.getByTestId("voice-after-verbosity").textContent ?? "";
    const beforeVal = parseInt(before.replace(/\D/g, ""), 10);
    const afterVal = parseInt(after.replace(/\D/g, ""), 10);
    expect(afterVal).toBeLessThan(beforeVal);
  });

  it("erhöht den Zynismus nach Zäsuren", () => {
    render(<CharacterVoiceEvolutionModal />);
    const before = screen.getByTestId("voice-before-cynicism").textContent ?? "";
    const after = screen.getByTestId("voice-after-cynismus").textContent ?? "";
    const beforeVal = parseInt(before.replace(/\D/g, ""), 10);
    const afterVal = parseInt(after.replace(/\D/g, ""), 10);
    expect(afterVal).toBeGreaterThan(beforeVal);
  });

  it("senkt die Naivität nach Zäsuren", () => {
    render(<CharacterVoiceEvolutionModal />);
    const before = screen.getByTestId("voice-before-naivety").textContent ?? "";
    const after = screen.getByTestId("voice-after-naivety").textContent ?? "";
    const beforeVal = parseInt(before.replace(/\D/g, ""), 10);
    const afterVal = parseInt(after.replace(/\D/g, ""), 10);
    expect(afterVal).toBeLessThan(beforeVal);
  });

  it("reagiert auf Figurennamen-Eingabe", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.change(screen.getByTestId("voice-character-input"), {
      target: { value: "Kael" },
    });
    expect(screen.getByTestId("character-voice-evolution-modal").textContent).toContain("Kael");
  });

  it("fügt eine Zäsur hinzu", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.click(screen.getByTestId("voice-add-trauma"));
    expect(screen.getByTestId("voice-trauma-3")).toBeTruthy();
  });

  it("entfernt eine Zäsur", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.click(screen.getByTestId("voice-trauma-remove-0"));
    expect(screen.queryByTestId("voice-trauma-2")).toBeNull();
  });

  it("reagiert auf Trauma-Typ-Auswahl", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.change(screen.getByTestId("voice-trauma-type-0"), {
      target: { value: "growth" },
    });
    expect(screen.getByTestId("character-voice-evolution-modal").textContent).toContain("Wachstum");
  });

  it("reagiert auf Kapitel-Eingabe", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.change(screen.getByTestId("voice-trauma-chapter-0"), {
      target: { value: "12" },
    });
    expect(screen.getByTestId("voice-trauma-chapter-0").getAttribute("value")).toBe("12");
  });

  it("reagiert auf Label-Eingabe", () => {
    render(<CharacterVoiceEvolutionModal />);
    fireEvent.change(screen.getByTestId("voice-trauma-label-0"), {
      target: { value: "Neues Trauma" },
    });
    expect(screen.getByTestId("voice-trauma-label-0").getAttribute("value")).toBe("Neues Trauma");
  });

  it("zeigt die Wandels-Analyse", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByTestId("voice-shift-analysis")).toBeTruthy();
    expect(screen.getByTestId("voice-total-shift")).toBeTruthy();
  });

  it("meldet deutlichen Wandel", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByTestId("voice-significantly-changed").textContent).toContain("Deutlicher Wandel");
  });

  it("zeigt den vollständigen Vergleich", () => {
    render(<CharacterVoiceEvolutionModal />);
    expect(screen.getByTestId("voice-comparison-text").textContent).toContain("VORHER");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<CharacterVoiceEvolutionModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
