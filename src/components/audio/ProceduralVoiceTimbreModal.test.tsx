// @vitest-environment jsdom
/**
 * Tests: ProceduralVoiceTimbreModal (WP 70.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProceduralVoiceTimbreModal } from "./ProceduralVoiceTimbreModal";

describe("ProceduralVoiceTimbreModal", () => {
  it("rendert die Komponente", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByTestId("procedural-voice-timbre-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByText("🎙️ Stimmfarben- & Akzent-Synthesizer")).toBeTruthy();
  });

  it("zeigt die Formanten-Parameter", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByTestId("timbre-parameters")).toBeTruthy();
    expect(screen.getByTestId("timbre-param-pitch")).toBeTruthy();
    expect(screen.getByTestId("timbre-param-fry")).toBeTruthy();
  });

  it("zeigt alle sechs Parameter", () => {
    render(<ProceduralVoiceTimbreModal />);
    ["pitch", "formant", "fry", "breath", "tremor", "rate"].forEach((id) => {
      expect(screen.getByTestId(`timbre-param-${id}`)).toBeTruthy();
    });
  });

  it("reagiert auf Altersänderung", () => {
    render(<ProceduralVoiceTimbreModal />);
    const before = screen.getByTestId("timbre-param-pitch").textContent;
    fireEvent.change(screen.getByTestId("timbre-age-input"), { target: { value: "80" } });
    const after = screen.getByTestId("timbre-param-pitch").textContent;
    expect(after).not.toBe(before);
  });

  it("reagiert auf Geschlechts-Auswahl", () => {
    render(<ProceduralVoiceTimbreModal />);
    const before = screen.getByTestId("timbre-param-pitch").textContent;
    fireEvent.change(screen.getByTestId("timbre-gender-select"), { target: { value: "male" } });
    expect(screen.getByTestId("timbre-param-pitch").textContent).not.toBe(before);
  });

  it("reagiert auf Stimmungs-Auswahl", () => {
    render(<ProceduralVoiceTimbreModal />);
    fireEvent.change(screen.getByTestId("timbre-mood-select"), { target: { value: "anxious" } });
    expect(screen.getByTestId("timbre-param-tremor").textContent).not.toContain("0 Hz");
  });

  it("reagiert auf Statur-Auswahl", () => {
    render(<ProceduralVoiceTimbreModal />);
    const before = screen.getByTestId("timbre-param-formant").textContent;
    fireEvent.change(screen.getByTestId("timbre-build-select"), { target: { value: "heavy" } });
    expect(screen.getByTestId("timbre-param-formant").textContent).not.toBe(before);
  });

  it("transformiert Text beim Akzent-Wechsel", () => {
    render(<ProceduralVoiceTimbreModal />);
    fireEvent.change(screen.getByTestId("timbre-accent-select"), { target: { value: "bavarian" } });
    expect(screen.getByTestId("timbre-transformed").textContent).toContain("ned");
  });

  it("zeigt die angewendeten Regeln", () => {
    render(<ProceduralVoiceTimbreModal />);
    fireEvent.change(screen.getByTestId("timbre-accent-select"), { target: { value: "bavarian" } });
    expect(screen.getByTestId("timbre-rules").textContent.length).toBeGreaterThan(0);
  });

  it("zeigt bei neutral keine Regeln", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.queryByTestId("timbre-rules")).toBeNull();
  });

  it("reagiert auf Sprechproben-Eingabe", () => {
    render(<ProceduralVoiceTimbreModal />);
    fireEvent.change(screen.getByTestId("timbre-phrase-input"), {
      target: { value: "ich bin nicht da" },
    });
    fireEvent.change(screen.getByTestId("timbre-accent-select"), { target: { value: "berlin" } });
    expect(screen.getByTestId("timbre-transformed").textContent).toContain("ick");
  });

  it("hat einen Vorschau-Button", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByTestId("timbre-play")).toBeTruthy();
  });

  it("zeigt den Stimm-Abstand", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByTestId("timbre-distance").textContent).toMatch(/[0-9.]+/);
  });

  it("zeigt die Originalphrase", () => {
    render(<ProceduralVoiceTimbreModal />);
    expect(screen.getByTestId("timbre-compare").textContent).toContain("Original");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ProceduralVoiceTimbreModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
