// @vitest-environment jsdom
/**
 * Tests: AiFilmDirectorTimelineModal (WP 67.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiFilmDirectorTimelineModal } from "./AiFilmDirectorTimelineModal";

describe("AiFilmDirectorTimelineModal", () => {
  it("rendert die Komponente", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("ai-film-director-timeline-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByText("🎬 AI Film Director Timeline")).toBeTruthy();
  });

  it("zeigt das Shot-Grid", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-grid")).toBeTruthy();
    expect(screen.getByTestId("timeline-shot-1")).toBeTruthy();
  });

  it("zeigt Timecodes in den Kacheln", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-shot-1").textContent).toContain("00:00");
  });

  it("zeigt Kamera-Icons", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-shot-1").textContent).toMatch(/[🎥🎬🔍🏃📷🔄]/u);
  });

  it("reagiert auf Szenen-Eingabe", () => {
    render(<AiFilmDirectorTimelineModal />);
    fireEvent.change(screen.getByTestId("timeline-scene-input"), {
      target: { value: "A car chase" },
    });
    expect(screen.getByTestId("timeline-shot-1").textContent).toContain("car chase");
  });

  it("reagiert auf Shot-Anzahl-Slider", () => {
    render(<AiFilmDirectorTimelineModal />);
    fireEvent.change(screen.getByTestId("timeline-count-input"), {
      target: { value: "10" },
    });
    expect(screen.getByTestId("timeline-shot-10")).toBeTruthy();
  });

  it("zeigt Timeline-Einträge", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-entries")).toBeTruthy();
    expect(screen.getByTestId("timeline-entry-0")).toBeTruthy();
  });

  it("zeigt Dialog, Foley und Score in Einträgen", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-entry-0").textContent).toContain("Dialog");
    expect(screen.getByTestId("timeline-entry-0").textContent).toContain("Foley");
    expect(screen.getByTestId("timeline-entry-0").textContent).toContain("Score");
  });

  it("zeigt das Produktions-Dossier", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-dossier")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<AiFilmDirectorTimelineModal />);
    fireEvent.change(screen.getByTestId("timeline-title-input"), {
      target: { value: "My Film" },
    });
    expect(screen.getByTestId("timeline-title-input").getAttribute("value")).toBe("My Film");
  });

  it("zeigt Markdown-Export", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-markdown-content").textContent).toContain("#");
  });

  it("zeigt JSON-Export", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-json-content").textContent).toContain('"title"');
  });

  it("shows CSV-Export", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-csv-content").textContent).toContain("Index,Timecode");
  });

  it("zeigt die vollständige Timeline", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-formatted").textContent).toContain("Shot 01");
  });

  it("hat Kopier-Buttons", () => {
    render(<AiFilmDirectorTimelineModal />);
    expect(screen.getByTestId("timeline-copy-1")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AiFilmDirectorTimelineModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
