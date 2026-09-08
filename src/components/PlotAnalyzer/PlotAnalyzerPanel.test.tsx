// @vitest-environment jsdom
// Component-Tests: PlotAnalyzerPanel (Sprint 25, Agent 5) — Eingabe,
// Analyse-Start (injizierter Client), Kurve, Acts, Charakter-Boegen.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlotAnalyzerPanel } from "./PlotAnalyzerPanel";
import type { PlotAnalysis } from "@/services/plot/plotAnalyzer";

const MOCK_RESULT: PlotAnalysis = {
  arc: {
    exposition: [
      {
        id: "p1",
        title: "Der Brief",
        description: "Anna findet den Brief.",
        position: 10,
        type: "inciting-incident",
        characters: ["Anna"],
        tension: 5,
      },
    ],
    risingAction: [],
    climax: [
      {
        id: "p2",
        title: "Showdown",
        description: "Kampf mit dem Wächter.",
        position: 75,
        type: "climax",
        characters: ["Anna", "Wächter"],
        tension: 9,
      },
    ],
    fallingAction: [],
    resolution: [
      {
        id: "p3",
        title: "Versöhnung",
        description: "Frieden mit dem Wächter.",
        position: 95,
        type: "resolution",
        characters: ["Anna"],
        tension: 2,
      },
    ],
  },
  pacing: "medium",
  tensionCurve: [
    { position: 0, tension: 5 },
    { position: 10, tension: 5 },
    { position: 75, tension: 9 },
    { position: 95, tension: 2 },
    { position: 100, tension: 2 },
  ],
  suggestions: ["Stärke die Mitte mit einer zweiten Komplikation."],
};

describe("PlotAnalyzerPanel", () => {
  it("rendert Eingabe und deaktivierten Start bei leerem Text", () => {
    render(<PlotAnalyzerPanel analyze={vi.fn()} />);
    expect(screen.getByTestId("plot-analyzer-panel")).toBeInTheDocument();
    expect(screen.getByTestId("plot-text-input")).toBeInTheDocument();
    expect(screen.getByTestId("plot-start")).toBeDisabled();
  });

  it("Analyse-Start zeigt Spannungskurve, Acts und Plot-Points", async () => {
    const user = userEvent.setup();
    const analyze = vi.fn(async () => MOCK_RESULT);
    render(<PlotAnalyzerPanel initialText="Eines Tages fand Anna einen Brief." analyze={analyze} />);
    await user.click(screen.getByTestId("plot-start"));
    await waitFor(() => expect(screen.getByTestId("plot-result")).toBeInTheDocument());
    expect(analyze).toHaveBeenCalledOnce();
    // Spannungskurve
    expect(screen.getByTestId("plot-tension-curve")).toBeInTheDocument();
    // Act-Struktur: 5 Phasen mit Zaehlern
    expect(screen.getByTestId("plot-act-structure")).toBeInTheDocument();
    expect(screen.getByTestId("plot-act-climax-count")).toHaveTextContent("1");
    expect(screen.getByTestId("plot-act-risingAction-count")).toHaveTextContent("0");
    // Plot-Points
    expect(screen.getByTestId("plot-point-p2")).toHaveTextContent("Showdown");
    // Klimax + Tempo
    expect(screen.getByTestId("plot-climax")).toHaveTextContent("Showdown");
    expect(screen.getByTestId("plot-pacing")).toHaveTextContent("MEDIUM");
    // Vorschlag
    expect(screen.getByTestId("plot-suggestion-0")).toHaveTextContent("zweiten Komplikation");
  });

  it("zeigt Charakter-Boegen je Figur", async () => {
    const user = userEvent.setup();
    render(
      <PlotAnalyzerPanel
        initialText="Eines Tages fand Anna einen Brief."
        analyze={vi.fn(async () => MOCK_RESULT)}
      />,
    );
    await user.click(screen.getByTestId("plot-start"));
    await waitFor(() => expect(screen.getByTestId("plot-character-arcs")).toBeInTheDocument());
    expect(screen.getByTestId("plot-character-Anna")).toHaveTextContent("3 Stationen");
    expect(screen.getByTestId("plot-character-Wächter")).toBeInTheDocument();
  });

  it("zeigt Fehler bei Client-Ausfall", async () => {
    const user = userEvent.setup();
    render(
      <PlotAnalyzerPanel
        initialText="Irgendein Text."
        analyze={vi.fn(async () => {
          throw new Error("Provider down");
        })}
      />,
    );
    await user.click(screen.getByTestId("plot-start"));
    await waitFor(() => expect(screen.getByTestId("plot-error")).toBeInTheDocument());
    expect(screen.getByTestId("plot-error")).toHaveTextContent("Provider down");
  });
});
