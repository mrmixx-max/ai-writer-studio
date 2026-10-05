// @vitest-environment jsdom
/**
 * Tests: SentenceCadenceOrchestratorModal (WP 63.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SentenceCadenceOrchestratorModal } from "./SentenceCadenceOrchestratorModal";

describe("SentenceCadenceOrchestratorModal", () => {
  it("rendert die Komponente", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("sentence-cadence-orchestrator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByText("🎼 Kadenz- & Satzrhythmus-Orchestrator")).toBeTruthy();
  });

  it("zeigt die Wellenform", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-waveform")).toBeTruthy();
    expect(screen.getByTestId("cadence-bar-0")).toBeTruthy();
  });

  it("zählt die Kategorien", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-count-staccato")).toBeTruthy();
    expect(screen.getByTestId("cadence-count-medium")).toBeTruthy();
    expect(screen.getByTestId("cadence-count-wave")).toBeTruthy();
  });

  it("zeigt den Monotonie-Alarm", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-monotony")).toBeTruthy();
  });

  it("meldet kein Monotonie-Problem bei abwechslungsreichem Text", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-no-warnings")).toBeTruthy();
  });

  it("warnt bei monotonem Text", () => {
    render(
      <SentenceCadenceOrchestratorModal
        initialText="Der Mann ging über die Straße. Die Frau wartete an der Ecke. Ein Wagen hielt am Rand. Der Hund bellte einmal laut. Ein Kind lief nach Hause. Die Sonne stand am Himmel."
      />,
    );
    expect(screen.getByTestId("cadence-warning-0")).toBeTruthy();
  });

  it("zeigt den Rhythmus-Score", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-score-value").textContent).toContain("%");
  });

  it("zeigt die Streuung", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-score").textContent).toContain("Streuung");
  });

  it("schaltet die Politur ein", () => {
    render(<SentenceCadenceOrchestratorModal />);
    const before = screen.getByTestId("cadence-preview-text").textContent;
    fireEvent.click(screen.getByTestId("cadence-toggle-polish"));
    expect(screen.getByTestId("cadence-toggle-polish").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("cadence-preview").textContent).toContain("POLIERTER TEXT");
    expect(screen.getByTestId("cadence-preview-text").textContent).not.toBe(before);
  });

  it("zeigt Politur-Statistiken", () => {
    render(<SentenceCadenceOrchestratorModal />);
    expect(screen.getByTestId("cadence-polish-stats").textContent).toContain("zerlegt");
  });

  it("übernimmt einen neuen Text", () => {
    render(<SentenceCadenceOrchestratorModal />);
    fireEvent.change(screen.getByTestId("cadence-text-input"), {
      target: { value: "Ein Satz. Noch einer." },
    });
    expect(screen.getByTestId("cadence-preview-text").textContent).toContain("Ein Satz");
  });

  it("kommt mit leerem Text zurecht", () => {
    render(<SentenceCadenceOrchestratorModal initialText="" />);
    expect(screen.getByTestId("cadence-preview-text").textContent).toBe("—");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SentenceCadenceOrchestratorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
