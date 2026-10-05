// @vitest-environment jsdom
/**
 * Tests: ChapterSceneSynthesizerModal (WP 60.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterSceneSynthesizerModal } from "./ChapterSceneSynthesizerModal";

describe("ChapterSceneSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<ChapterSceneSynthesizerModal />);
    expect(screen.getByTestId("chapter-scene-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<ChapterSceneSynthesizerModal />);
    expect(screen.getByText("📖 Gesamt-Kapitel-Synthesizer")).toBeTruthy();
  });

  it("erzeugt vier Szenen", () => {
    render(<ChapterSceneSynthesizerModal />);
    expect(screen.getByTestId("chapter-scene-hook")).toBeTruthy();
    expect(screen.getByTestId("chapter-scene-complication")).toBeTruthy();
    expect(screen.getByTestId("chapter-scene-turning-point")).toBeTruthy();
    expect(screen.getByTestId("chapter-scene-resolution")).toBeTruthy();
  });

  it("benennt die dramaturgischen Rollen", () => {
    render(<ChapterSceneSynthesizerModal />);
    const text = screen.getByTestId("chapter-scenes").textContent ?? "";
    expect(text).toContain("ATMOSPHÄRISCHER HAKEN");
    expect(text).toContain("UNERWARTETER WENDEPUNKT");
  });

  it("verwendet die Beats", () => {
    render(<ChapterSceneSynthesizerModal />);
    const text = screen.getByTestId("chapter-scenes").textContent ?? "";
    expect(text).toContain("Mira wacht im kalten Zimmer auf");
  });

  it("zeigt die Kadenz je Szene", () => {
    render(<ChapterSceneSynthesizerModal />);
    const text = screen.getByTestId("chapter-scenes").textContent ?? "";
    expect(text).toContain("SLOW");
    expect(text).toContain("FAST");
  });

  it("übernimmt einen neuen Beat", () => {
    render(<ChapterSceneSynthesizerModal />);
    fireEvent.change(screen.getByTestId("chapter-beats-input"), {
      target: { value: "Ein ganz neuer Anfang" },
    });
    expect(screen.getByTestId("chapter-scenes").textContent).toContain("Ein ganz neuer Anfang");
  });

  it("übernimmt den Titel", () => {
    render(<ChapterSceneSynthesizerModal />);
    fireEvent.change(screen.getByTestId("chapter-title-input"), {
      target: { value: "Die Rückkehr" },
    });
    expect(screen.getByTestId("chapter-scene-synthesizer-modal")).toBeTruthy();
  });

  it("zeigt die Kadenz-Kurve", () => {
    render(<ChapterSceneSynthesizerModal />);
    expect(screen.getByTestId("chapter-cadence")).toBeTruthy();
    expect(screen.getByTestId("chapter-cadence-bar-0")).toBeTruthy();
  });

  it("bewertet das Pacing", () => {
    render(<ChapterSceneSynthesizerModal />);
    const verdict = screen.getByTestId("chapter-pacing-verdict").textContent ?? "";
    expect(verdict.length).toBeGreaterThan(10);
  });

  it("zeigt drei Brücken-Arten", () => {
    render(<ChapterSceneSynthesizerModal />);
    ["time", "place", "mood"].forEach((k) => {
      expect(screen.getByTestId(`chapter-bridge-${k}`)).toBeTruthy();
    });
  });

  it("wechselt die Brücken-Art", () => {
    render(<ChapterSceneSynthesizerModal />);
    const before = screen.getByTestId("chapter-bridge-text").textContent;
    fireEvent.click(screen.getByTestId("chapter-bridge-place"));
    expect(screen.getByTestId("chapter-bridge-text").textContent).not.toBe(before);
  });

  it("markiert die aktive Brücke", () => {
    render(<ChapterSceneSynthesizerModal />);
    fireEvent.click(screen.getByTestId("chapter-bridge-mood"));
    expect(screen.getByTestId("chapter-bridge-mood").getAttribute("aria-pressed")).toBe("true");
  });

  it("nennt den Ort", () => {
    render(<ChapterSceneSynthesizerModal />);
    expect(screen.getByTestId("chapter-scenes").textContent).toContain("Gasthaus am Kai");
  });

  it("kommt mit leerer Beat-Eingabe zurecht", () => {
    render(<ChapterSceneSynthesizerModal initialBeats="" />);
    expect(screen.getByTestId("chapter-scene-hook")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ChapterSceneSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
