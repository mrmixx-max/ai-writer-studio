// @vitest-environment jsdom
/**
 * Tests: MoralCorruptionLedgerModal (Meilenstein 63.0 / v7.5.0)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoralCorruptionLedgerModal } from "./MoralCorruptionLedgerModal";

describe("MoralCorruptionLedgerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<MoralCorruptionLedgerModal />);
    expect(screen.getByTestId("moral-corruption-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<MoralCorruptionLedgerModal />);
    expect(
      screen.getByText("📉 7-Stufen-Hauptbuch des moralischen Verfalls"),
    ).toBeTruthy();
  });

  it("zeigt DIE 7 STUFEN", () => {
    render(<MoralCorruptionLedgerModal />);
    expect(screen.getByText("DIE 7 STUFEN")).toBeTruthy();
  });

  it("zeigt ABSTIEGSKURVE", () => {
    render(<MoralCorruptionLedgerModal />);
    expect(screen.getByText("ABSTIEGSKURVE")).toBeTruthy();
  });

  it("zeigt POINT OF NO RETURN", () => {
    render(<MoralCorruptionLedgerModal />);
    expect(screen.getByText("POINT OF NO RETURN")).toBeTruthy();
  });

  it("zeigt alle 7 Stufennamen", () => {
    render(<MoralCorruptionLedgerModal />);
    const namen = [
      "Edle Absicht",
      "Erster kleiner Kompromiss",
      "Die Vertuschung",
      "Der erste Kollateralschaden",
      "Rationalisierung der Grausamkeit",
      "Die paranoide Säuberung",
      "Totaler moralischer Bankrott",
    ];
    for (const name of namen) {
      expect(screen.getAllByText(name, { exact: false }).length).toBeGreaterThan(0);
    }
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<MoralCorruptionLedgerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBe(null);
  });
});
