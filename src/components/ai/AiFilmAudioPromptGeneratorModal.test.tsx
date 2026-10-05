// @vitest-environment jsdom
/**
 * Tests: AiFilmAudioPromptGeneratorModal (WP 67.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiFilmAudioPromptGeneratorModal } from "./AiFilmAudioPromptGeneratorModal";

describe("AiFilmAudioPromptGeneratorModal", () => {
  it("rendert die Komponente", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByTestId("ai-film-audio-prompt-generator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByText("🎵 AI Film Audio Prompt Director")).toBeTruthy();
  });

  it("zeigt Spur 1: Voice & Dialog", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByTestId("audio-dialogue")).toBeTruthy();
    expect(screen.getByTestId("audio-dialogue-0")).toBeTruthy();
  });

  it("zeigt Spur 2: Foley & Sound FX", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByTestId("audio-foley")).toBeTruthy();
    expect(screen.getByTestId("audio-foley-0")).toBeTruthy();
  });

  it("zeigt Spur 3: Soundtrack & Score", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByTestId("audio-score")).toBeTruthy();
    expect(screen.getByTestId("audio-score-0")).toBeTruthy();
  });

  it("reagiert auf Engine-Auswahl", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("audio-engine-select"), {
      target: { value: "suno" },
    });
    expect(screen.getByTestId("ai-film-audio-prompt-generator-modal").textContent).toContain("Suno");
  });

  it("reagiert auf Dialog-Eingabe", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("audio-dialogue-input"), {
      target: { value: "New line one\nNew line two" },
    });
    expect(screen.getByTestId("audio-dialogue-1")).toBeTruthy();
  });

  it("reagiert auf Foley-Eingabe", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("audio-foley-input"), {
      target: { value: "New foley" },
    });
    expect(screen.getByTestId("audio-foley-0").textContent).toContain("New foley");
  });

  it("reagiert auf Score-Eingabe", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    fireEvent.change(screen.getByTestId("audio-score-input"), {
      target: { value: "New score" },
    });
    expect(screen.getByTestId("audio-score-0").textContent).toContain("New score");
  });

  it("zeigt die vollständige Ausgabe", () => {
    render(<AiFilmAudioPromptGeneratorModal />);
    expect(screen.getByTestId("audio-formatted").textContent).toContain("SPUR 1");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AiFilmAudioPromptGeneratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
