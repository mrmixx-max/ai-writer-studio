// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubterraneanSpeleologyEngineModal } from "./SubterraneanSpeleologyEngineModal";

describe("SubterraneanSpeleologyEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getByTestId("speleology-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getByText(/Unterirdischer Höhlen- & Speleologie-Simulator/)).toBeInTheDocument();
  });

  it("listet alle fünf Untertage-Zonen", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getAllByText(/Eingangskluft/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Geothermale Spalte/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unterirdischer Abgrundsee/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Biolumineszenter Pilzwald/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tiefe Magmakammern/).length).toBeGreaterThan(0);
  });

  it("zeigt Gas- und Umweltgefahren", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getAllByText(/schlagwetter/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/erstickung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/giftgas/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/stabilität/).length).toBeGreaterThan(0);
  });

  it("zeigt Temperatur, Sauerstoff und Stabilität", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getAllByText(/Temperatur:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sauerstoff:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stabilität:/).length).toBeGreaterThan(0);
  });

  it("zeigt die Finsternis-Prosa", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getAllByText(/FINSTERNIS-PROSA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Licht erlischt|Lampe stirbt|Dann nichts/).length).toBeGreaterThan(0);
  });

  it("nennt die tiefste Zone", () => {
    render(<SubterraneanSpeleologyEngineModal />);
    expect(screen.getByText(/tiefste Zone: Tiefe Magmakammern/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<SubterraneanSpeleologyEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
