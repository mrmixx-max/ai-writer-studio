// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Flagship60SingularityCockpitModal } from "./Flagship60SingularityCockpitModal";

describe("Flagship60SingularityCockpitModal", () => {
  it("rendert ohne Fehler", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByTestId("flagship60-cockpit-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/10.000-Singularitäts-Siegel & 6.0 Cockpit/)).toBeInTheDocument();
  });

  it("meldet den Durchbruch der 10.000er-Schallmauer", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/10.000-TEST-SCHALLMAUER DURCHBROCHEN/)).toBeInTheDocument();
  });

  it("zeigt das 10.000er-Gesamt-Audit", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/10.000er-GESAMT-AUDIT/)).toBeInTheDocument();
    expect(screen.getAllByText(/10.000-Test-Schallmauer/).length).toBeGreaterThan(0);
  });

  it("rendert das Diamant-Singularitäts-Siegel als SVG", () => {
    const { container } = render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/DIAMANT-SINGULARITÄTS-SIEGEL/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.innerHTML).toContain("10.000");
  });

  it("zeigt die SHA-512-Signatur", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/SHA-512-Signatur:/)).toBeInTheDocument();
  });

  it("zeigt das Magnum-Opus-Universal-Archiv", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/MAGNUM-OPUS-UNIVERSAL-ARCHIV/)).toBeInTheDocument();
    expect(screen.getByText(/Roman \(Volltext\)/)).toBeInTheDocument();
    expect(screen.getByText(/Charakter-Bibel/)).toBeInTheDocument();
  });

  it("zeigt das Audit-Protokoll", () => {
    render(<Flagship60SingularityCockpitModal />);
    expect(screen.getByText(/AUDIT-PROTOKOLL/)).toBeInTheDocument();
    expect(screen.getByText(/SINGULARITÄTS-AUDIT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben (auch nicht im SVG)", () => {
    const { container } = render(<Flagship60SingularityCockpitModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
