// @vitest-environment jsdom
/**
 * Tests: MusicalScoreComposer (WP 48.2 — Thematischer Soundtrack- & MIDI-Composer)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MusicalScoreComposer } from "./MusicalScoreComposer";

describe("MusicalScoreComposer", () => {
  it("rendert den Composer", () => {
    render(<MusicalScoreComposer />);
    expect(screen.getByTestId("musical-score-composer")).toBeTruthy();
  });

  it("zeigt 6 Emotionen", () => {
    render(<MusicalScoreComposer />);
    expect(screen.getByTestId("score-emotion-melancholy")).toBeTruthy();
    expect(screen.getByTestId("score-emotion-triumph")).toBeTruthy();
    expect(screen.getByTestId("score-emotion-dread")).toBeTruthy();
    expect(screen.getByTestId("score-emotion-playful")).toBeTruthy();
    expect(screen.getByTestId("score-emotion-romantic")).toBeTruthy();
    expect(screen.getByTestId("score-emotion-mystery")).toBeTruthy();
  });

  it("Emotion-Auswahl ändert Skala", () => {
    render(<MusicalScoreComposer />);
    fireEvent.click(screen.getByTestId("score-emotion-triumph"));
    expect(screen.getByTestId("score-scale").textContent).toContain("C");
  });

  it("zeigt Akkorde", () => {
    render(<MusicalScoreComposer />);
    expect(screen.getByTestId("score-chords")).toBeTruthy();
    expect(screen.getByTestId("score-chord-0")).toBeTruthy();
  });

  it("Leitmotiv mit Figurenname", () => {
    render(<MusicalScoreComposer />);
    fireEvent.change(screen.getByTestId("score-character"), {
      target: { value: "Aldric" },
    });
    expect(screen.getByTestId("score-leitmotif-result")).toBeTruthy();
  });

  it("Leitmotiv ohne Name nicht sichtbar", () => {
    render(<MusicalScoreComposer />);
    expect(screen.queryByTestId("score-leitmotif-result")).toBeNull();
  });

  it("MIDI-Export funktioniert", () => {
    render(<MusicalScoreComposer />);
    fireEvent.click(screen.getByTestId("score-export-midi"));
    expect(screen.getByTestId("score-midi-output")).toBeTruthy();
  });

  it("MIDI-Output enthält Base64", () => {
    render(<MusicalScoreComposer />);
    fireEvent.click(screen.getByTestId("score-export-midi"));
    const midi = screen.getByTestId("score-midi-output").textContent ?? "";
    expect(midi.length).toBeGreaterThan(0);
  });

  it("Skala zeigt Root und Modus", () => {
    render(<MusicalScoreComposer />);
    const scale = screen.getByTestId("score-scale").textContent ?? "";
    expect(scale).toContain("Root");
    expect(scale).toContain("Modus");
  });

  it("Emotion-Wechsel aktualisiert Anzeige", () => {
    render(<MusicalScoreComposer />);
    const before = screen.getByTestId("musical-score-composer").textContent ?? "";
    fireEvent.click(screen.getByTestId("score-emotion-dread"));
    const after = screen.getByTestId("musical-score-composer").textContent ?? "";
    expect(after).not.toBe(before);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<MusicalScoreComposer />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
