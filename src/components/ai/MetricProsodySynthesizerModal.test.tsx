// @vitest-environment jsdom
/**
 * Tests: MetricProsodySynthesizerModal (WP 76.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetricProsodySynthesizerModal } from "./MetricProsodySynthesizerModal";

describe("MetricProsodySynthesizerModal", () => {
  it("rendert die Komponente", () => {
    render(<MetricProsodySynthesizerModal />);
    expect(screen.getByTestId("metric-prosody-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<MetricProsodySynthesizerModal />);
    expect(screen.getByText("📜 Metrik-, Sonett- & Balladen-Synthesizer")).toBeTruthy();
  });

  it("zeigt Gedicht", () => {
    render(<MetricProsodySynthesizerModal />);
    expect(screen.getByTestId("poem-output")).toBeTruthy();
  });

  it("zeigt Analyse", () => {
    render(<MetricProsodySynthesizerModal />);
    expect(screen.getByTestId("poem-analysis")).toBeTruthy();
  });

  it("wechselt zu Petrarca", () => {
    render(<MetricProsodySynthesizerModal />);
    fireEvent.click(screen.getByTestId("poem-form-petrarch"));
    expect(screen.getByTestId("poem-output")).toBeTruthy();
  });

  it("wechselt zu Ballade", () => {
    render(<MetricProsodySynthesizerModal />);
    fireEvent.click(screen.getByTestId("poem-form-ballad"));
    expect(screen.getByTestId("poem-output")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<MetricProsodySynthesizerModal />);
    fireEvent.change(screen.getByTestId("poem-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("poem-output")).toBeTruthy();
  });

  it("reagiert auf Analyse-Eingabe", () => {
    render(<MetricProsodySynthesizerModal />);
    fireEvent.change(screen.getByTestId("poem-analysis-input"), {
      target: { value: "Die Sonne scheint hell" },
    });
    expect(screen.getByTestId("poem-analysis")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<MetricProsodySynthesizerModal />);
    expect(screen.getByTestId("poem-text").textContent).toContain("Form:");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<MetricProsodySynthesizerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
