// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AntagonistMoralJustificationModal } from "./AntagonistMoralJustificationModal";

describe("AntagonistMoralJustificationModal (Meilenstein 63.0 / v7.5.0)", () => {
  it("rendert ohne Fehler", () => {
    render(<AntagonistMoralJustificationModal />);
    expect(screen.getByTestId("antagonist-moral-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AntagonistMoralJustificationModal />);
    expect(
      screen.getByText("🎭 Schurken-Selbstgerechtigkeits-Synthesizer"),
    ).toBeTruthy();
  });

  it("zeigt PHILOSOPHIEN", () => {
    render(<AntagonistMoralJustificationModal />);
    expect(screen.getByText("PHILOSOPHIEN")).toBeTruthy();
  });

  it("zeigt MONOLOG", () => {
    render(<AntagonistMoralJustificationModal />);
    expect(screen.getByText("MONOLOG")).toBeTruthy();
  });

  it("zeigt VERFÜHRUNGS-REGLER", () => {
    render(<AntagonistMoralJustificationModal />);
    expect(screen.getByText("VERFÜHRUNGS-REGLER")).toBeTruthy();
  });

  it("zeigt alle 4 Philosophie-Namen", () => {
    render(<AntagonistMoralJustificationModal />);
    const namen = [
      "Der utilitaristische Märtyrer",
      "Der traumatisierte Vergeltungs-Spiegel",
      "Der darwinistische Aufsteiger",
      "Der wohlwollende Despot",
    ];
    for (const name of namen) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AntagonistMoralJustificationModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
