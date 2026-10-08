// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobiusPlotTopologyModal } from "./MobiusPlotTopologyModal";

describe("MobiusPlotTopologyModal", () => {
  it("rendert ohne Fehler", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByTestId("mobius-topology-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/Möbius- & Ouroboros-Plot-Topologie/)).toBeInTheDocument();
  });

  it("listet alle vier topologischen Modelle", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getAllByText(/Ouroboros-Zyklus/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Möbius-Inversion/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Matrjoschka-Verschachtelung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Palindrom-Plot/).length).toBeGreaterThan(0);
  });

  it("rendert den Möbius-Canvas als SVG", () => {
    const { container } = render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/INTERAKTIVER MÖBIUS-CANVAS/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("zeigt den Schleifen-Kausalitäts-Prüfer", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/SCHLEIFEN-KAUSALITÄTS-PRÜFER/)).toBeInTheDocument();
    expect(screen.getByText(/Kausalkette geschlossen/)).toBeInTheDocument();
  });

  it("meldet die kohärente Topologie", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/KEINE PARADOXA — TOPOLOGIE KOHÄRENT/)).toBeInTheDocument();
  });

  it("zeigt die Modell-Anforderung", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/MODELL-ANFORDERUNG/)).toBeInTheDocument();
    expect(screen.getByText(/Das Ende begründet den Anfang/)).toBeInTheDocument();
  });

  it("listet die Plot-Knoten", () => {
    render(<MobiusPlotTopologyModal />);
    expect(screen.getByText(/PLOT-KNOTEN/)).toBeInTheDocument();
    expect(screen.getByText(/Der Junge findet das Tagebuch/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben (auch nicht im SVG)", () => {
    const { container } = render(<MobiusPlotTopologyModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
