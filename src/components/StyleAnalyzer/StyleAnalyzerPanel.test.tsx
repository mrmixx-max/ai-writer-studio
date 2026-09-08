// @vitest-environment jsdom
// Tests: StyleAnalyzerPanel (Sprint 22, Agent 6).
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StyleAnalyzerPanel } from "./StyleAnalyzerPanel";

const SAMPLE =
  "Er ging durch die dunkle Nacht. Plötzlich hörte er einen Schrei. " +
  "„Hilfe!“, rief eine Stimme aus dem Nebel. Er rannte los, so schnell er konnte.";

describe("StyleAnalyzerPanel", () => {
  it("rendert Text-Eingabe und Analyse-Button", () => {
    render(<StyleAnalyzerPanel />);
    expect(screen.getByLabelText("Zu analysierender Text")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Aktuellen Text analysieren/i }),
    ).toBeInTheDocument();
  });

  it("analysiert den Text und rendert den Autoren-Vergleich", async () => {
    const user = userEvent.setup();
    render(<StyleAnalyzerPanel />);
    await user.type(screen.getByLabelText("Zu analysierender Text"), SAMPLE);
    await user.click(screen.getByRole("button", { name: /Aktuellen Text analysieren/i }));

    // Profil-Karten
    expect(screen.getByText("SATZLÄNGE")).toBeInTheDocument();
    expect(screen.getByText("WORTSCHATZ")).toBeInTheDocument();
    // Vergleichsbalken für alle 10 Autoren
    const cmp = screen.getByLabelText("Autoren-Vergleich");
    expect(within(cmp).getByText("Edgar Wallace")).toBeInTheDocument();
    expect(within(cmp).getByText("Ernest Hemingway")).toBeInTheDocument();
    // Ähnlichster-Autor-Highlight
    expect(screen.getByTestId("style-best-match")).toBeInTheDocument();
    // Fingerprint
    expect(screen.getByRole("img", { name: /Stil-Fingerprint/ })).toBeInTheDocument();
  });

  it("Multi-Select blendet Autoren aus dem Vergleich aus", async () => {
    const user = userEvent.setup();
    render(<StyleAnalyzerPanel />);
    await user.type(screen.getByLabelText("Zu analysierender Text"), SAMPLE);
    await user.click(screen.getByRole("button", { name: /Aktuellen Text analysieren/i }));

    const toggle = screen.getByRole("button", { name: "Edgar Wallace" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("style-comparison-Edgar Wallace")).toBeNull();
  });
});
