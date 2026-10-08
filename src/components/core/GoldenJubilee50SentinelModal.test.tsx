// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoldenJubilee50SentinelModal } from "./GoldenJubilee50SentinelModal";

describe("GoldenJubilee50SentinelModal", () => {
  it("rendert ohne Fehler", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByTestId("golden-jubilee-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByText(/50. Goldenes Jubiläums-Siegel & Sentinel/)).toBeInTheDocument();
  });

  it("meldet das goldene Jubiläum", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getAllByText(/50. GOLDENES JUBILÄUM/).length).toBeGreaterThan(0);
  });

  it("zeigt das Voll-Spektrum-Audit", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByText(/VOLL-SPEKTRUM-AUDIT/)).toBeInTheDocument();
    expect(screen.getAllByText(/Test-Bestand \(10.280\+\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Service-Registrierung \(105\+\)/).length).toBeGreaterThan(0);
  });

  it("rendert das goldene Jubiläums-Siegel als SVG", () => {
    const { container } = render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByText(/GOLDENES 50TH-JUBILEE-SIEGEL/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.innerHTML).toContain("GOLDENES JUBILÄUM");
  });

  it("zeigt die SHA-512-Signatur", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByText(/SHA-512-Signatur:/)).toBeInTheDocument();
  });

  it("blendet die Retrospektive erst nach Klick ein", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.queryByText(/MEILENSTEIN-RETROSPEKTIVE-MATRIX/)).toBeNull();
    fireEvent.click(screen.getByText(/Retrospektive anzeigen/));
    expect(screen.getByText(/MEILENSTEIN-RETROSPEKTIVE-MATRIX/)).toBeInTheDocument();
  });

  it("zeigt den Zeitstrahl von M1 bis M50", () => {
    render(<GoldenJubilee50SentinelModal />);
    fireEvent.click(screen.getByText(/Retrospektive anzeigen/));
    expect(screen.getAllByText(/M1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/M50/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Wachstum von v1.0.0 bis v6.2.0/)).toBeInTheDocument();
  });

  it("zeigt das Audit-Protokoll", () => {
    render(<GoldenJubilee50SentinelModal />);
    expect(screen.getByText(/AUDIT-PROTOKOLL/)).toBeInTheDocument();
    expect(screen.getByText(/GOLDENES JUBILÄUMS-AUDIT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben (auch nicht im SVG)", () => {
    const { container } = render(<GoldenJubilee50SentinelModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
