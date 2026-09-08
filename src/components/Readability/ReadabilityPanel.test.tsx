// @vitest-environment jsdom
// Component-Tests: ReadabilityPanel (Sprint 25, Agent 4).
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadabilityPanel } from "./ReadabilityPanel";

const SAMPLE =
  "The cat sat on the mat. It was a hot day. The dog ran in the park. " +
  "We had fun in the sun.";

describe("ReadabilityPanel", () => {
  it("rendert Eingabe und Analysieren-Button", () => {
    render(<ReadabilityPanel />);
    expect(screen.getByTestId("readability-panel")).toBeTruthy();
    expect(screen.getByTestId("readability-input")).toBeTruthy();
    expect(screen.getByTestId("readability-analyze")).toBeTruthy();
  });

  it("rendert 6 Metrik-Karten mit Ampel nach Analyse", () => {
    render(<ReadabilityPanel />);
    fireEvent.change(screen.getByTestId("readability-input"), { target: { value: SAMPLE } });
    fireEvent.click(screen.getByTestId("readability-analyze"));
    expect(screen.getByTestId("readability-results")).toBeTruthy();
    for (const key of [
      "flesch-kincaid",
      "flesch-ease",
      "gunning-fog",
      "coleman-liau",
      "ari",
      "smog",
    ]) {
      expect(screen.getByTestId(`readability-metric-${key}`)).toBeTruthy();
      expect(screen.getByTestId(`readability-ampel-${key}`).textContent).toMatch(/LEICHT|MITTEL|SCHWER/);
    }
    expect(screen.getByTestId("readability-age")).toBeTruthy();
    expect(screen.getByTestId("readability-level")).toBeTruthy();
    expect(screen.getByTestId("readability-chart")).toBeTruthy();
  });

  it("Vergleichs-Modus zeigt zweiten Text an", () => {
    render(<ReadabilityPanel />);
    fireEvent.click(screen.getByTestId("readability-compare-toggle"));
    expect(screen.getByTestId("readability-input-2")).toBeTruthy();
    fireEvent.change(screen.getByTestId("readability-input"), { target: { value: SAMPLE } });
    fireEvent.change(screen.getByTestId("readability-input-2"), {
      target: {
        value:
          "The unprecedented characterization of electroencephalographic phenomena necessitates comprehensive reconceptualization.",
      },
    });
    fireEvent.click(screen.getByTestId("readability-analyze"));
    expect(screen.getByTestId("readability-compare")).toBeTruthy();
  });

  it("leerer Text erzeugt keine Ergebnisse", () => {
    render(<ReadabilityPanel />);
    fireEvent.change(screen.getByTestId("readability-input"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("readability-analyze"));
    expect(screen.queryByTestId("readability-results")).toBeNull();
  });
});
