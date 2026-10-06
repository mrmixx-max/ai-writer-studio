// @vitest-environment jsdom
/**
 * Tests: DopaminePacingSynthesizerModal (WP 72.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DopaminePacingSynthesizerModal } from "./DopaminePacingSynthesizerModal";

describe("DopaminePacingSynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-pacing-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByText("🧠 Dopamin-Pacing & Curiosity-Loops")).toBeTruthy();
  });

  it("zeigt die Pacing-Bewertung", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-verdict")).toBeTruthy();
  });

  it("zeigt die Dopamin-Kurve", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-curve")).toBeTruthy();
  });

  it("zeigt die Kurve als Text", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-curve-text").textContent).toContain("§");
  });

  it("zeigt Curiosity-Loops", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-loops")).toBeTruthy();
  });

  it("zeigt Cliffhangers", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-cliffhangers")).toBeTruthy();
  });

  it("zeigt Statistik", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-stats")).toBeTruthy();
    expect(screen.getByTestId("dopamine-avg").textContent).toContain("Durchschnitt");
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<DopaminePacingSynthesizerModal />);
    fireEvent.change(screen.getByTestId("dopamine-text-input"), {
      target: { value: "Plötzlich! Gefahr! Geheimnis!" },
    });
    expect(screen.getByTestId("dopamine-curve")).toBeTruthy();
  });

  it("reagiert auf Seed-Eingabe", () => {
    render(<DopaminePacingSynthesizerModal />);
    fireEvent.change(screen.getByTestId("dopamine-seed-input"), { target: { value: "99" } });
    expect(screen.getByTestId("dopamine-curve")).toBeTruthy();
  });

  it("kommt mit leerem Text zurecht", () => {
    render(<DopaminePacingSynthesizerModal initialText="" />);
    expect(screen.getByTestId("dopamine-no-loops")).toBeTruthy();
    expect(screen.getByTestId("dopamine-no-cliffhangers")).toBeTruthy();
  });

  it("zeigt Balken für jeden Absatz", () => {
    render(<DopaminePacingSynthesizerModal />);
    expect(screen.getByTestId("dopamine-bar-1")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<DopaminePacingSynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
