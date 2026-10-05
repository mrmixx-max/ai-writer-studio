// @vitest-environment jsdom
/**
 * Tests: ParallelTimelineEngine (WP 51.1 — Zeitreise- & Multiversum-Kausalitätswächter)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParallelTimelineEngine } from "./ParallelTimelineEngine";

describe("ParallelTimelineEngine", () => {
  it("rendert den Kausalitätswächter", () => {
    render(<ParallelTimelineEngine />);
    expect(screen.getByTestId("parallel-timeline-engine")).toBeTruthy();
  });

  it("zeigt Zeitleisten", () => {
    render(<ParallelTimelineEngine />);
    const text = screen.getByTestId("parallel-timeline-engine").textContent ?? "";
    expect(text).toContain("Zeitleisten");
  });

  it("zeigt Gantt-Übersicht", () => {
    render(<ParallelTimelineEngine />);
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
  });

  it("Ereignis hinzufügen funktioniert", () => {
    render(<ParallelTimelineEngine />);
    fireEvent.change(screen.getByTestId("timeline-event-name"), {
      target: { value: "Test-Ereignis" },
    });
    fireEvent.click(screen.getByTestId("timeline-add-event"));
    expect(screen.getByTestId("timeline-events").textContent).toContain("Test-Ereignis");
  });

  it("Ereignis-Liste zeigt Ereignisse", () => {
    render(<ParallelTimelineEngine />);
    fireEvent.change(screen.getByTestId("timeline-event-name"), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByTestId("timeline-add-event"));
    expect(screen.getByTestId("timeline-events")).toBeTruthy();
  });

  it("Paradoxa-Anzeige vorhanden", () => {
    render(<ParallelTimelineEngine />);
    expect(screen.getByTestId("timeline-no-paradoxes")).toBeTruthy();
  });

  it("Zeitlinien-Auswahl funktioniert", () => {
    render(<ParallelTimelineEngine />);
    fireEvent.change(screen.getByTestId("timeline-select"), {
      target: { value: "tl-b" },
    });
    expect((screen.getByTestId("timeline-select") as HTMLSelectElement).value).toBe("tl-b");
  });

  it("Ereignisjahr änderbar", () => {
    render(<ParallelTimelineEngine />);
    fireEvent.change(screen.getByTestId("timeline-event-year"), {
      target: { value: "1985" },
    });
    expect((screen.getByTestId("timeline-event-year") as HTMLInputElement).value).toBe("1985");
  });

  it("Hinzufügen ohne Name deaktiviert", () => {
    render(<ParallelTimelineEngine />);
    expect((screen.getByTestId("timeline-add-event") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Hinzufügen mit Name aktiviert", () => {
    render(<ParallelTimelineEngine />);
    fireEvent.change(screen.getByTestId("timeline-event-name"), {
      target: { value: "Test" },
    });
    expect((screen.getByTestId("timeline-add-event") as HTMLButtonElement).disabled).toBe(false);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ParallelTimelineEngine />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
