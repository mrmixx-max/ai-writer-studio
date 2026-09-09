// @vitest-environment jsdom
// Component-Tests: WordStatsPanel (Sprint 25, Agent 6).
// Gesamt-Wörter, Top-Wörter-Liste, Frequenz-Balken, Dialog-Verhältnis,
// Fortschritt, Vergleichs-Modus.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WordStatsPanel } from "./WordStatsPanel";

const SAMPLE =
  "Der Hund bellt laut. Der Hund rennt schnell durch den Garten. Die Katze schläft.";

beforeEach(() => {
  localStorage.clear();
});

function analyzeWith(text: string) {
  render(<WordStatsPanel />);
  fireEvent.change(screen.getByLabelText("Analysetext"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /Analysieren/ }));
}

describe("WordStatsPanel", () => {
  it("rendert Panel mit Eingabe und Analysieren-Button", () => {
    render(<WordStatsPanel />);
    expect(screen.getByTestId("ws-panel")).toBeTruthy();
    expect(screen.getByLabelText("Analysetext")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Analysieren/ })).toBeTruthy();
  });

  it("zeigt Gesamt-Wörter und Top-Wörter nach Analyse", async () => {
    analyzeWith(SAMPLE);
    await waitFor(() => expect(screen.getByTestId("ws-stat-total")).toBeTruthy());
    // 14 Tokens im SAMPLE
    expect(screen.getByTestId("ws-stat-total").textContent).toMatch(/14/);
    // Top-Wort "hund" (2×) in Top-Wörter-Liste UND Frequenz-Balken
    await waitFor(() => expect(screen.getByTestId("ws-frequency-bars")).toBeTruthy());
    expect(screen.getAllByText("hund").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2×/).length).toBeGreaterThanOrEqual(1);
  });

  it("zeigt Worthäufigkeit-Balken und Dialog-Verhältnis", async () => {
    analyzeWith(SAMPLE);
    await waitFor(() => expect(screen.getByTestId("ws-frequency-bars")).toBeTruthy());
    expect(screen.getByTestId("ws-frequency-bars").textContent).toMatch(/Worthäufigkeit/);
    expect(screen.getByTestId("ws-frequency-bars").textContent).toMatch(/Dialog/);
    expect(screen.getByTestId("ws-progress")).toBeTruthy();
  });

  it("Vergleichs-Modus zeigt zweiten Text an", async () => {
    analyzeWith(SAMPLE);
    await waitFor(() => expect(screen.getByTestId("ws-stat-total")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Vergleich/ }));
    expect(screen.getByTestId("ws-compare")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Vergleichstext"), {
      target: { value: "Katze Maus Vogel Fisch" },
    });
    expect(screen.getByTestId("ws-stat-cmp1-total")).toBeTruthy();
    expect(screen.getByTestId("ws-stat-cmp2-total").textContent).toMatch(/4/);
  });

  it("leerer Text ohne Eingabe nutzt lokalen Fallback ohne Absturz", () => {
    render(<WordStatsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Analysieren/ }));
    // analyse von "" -> stats.totalWords 0, Panel bleibt stabil
    expect(screen.getByTestId("ws-panel")).toBeTruthy();
  });
});
