// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NauticalNavalSimulatorModal } from "./NauticalNavalSimulatorModal";

describe("NauticalNavalSimulatorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByTestId("nautical-naval-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByText(/Segelschiff-Physik & Seeschlachten-Simulator/)).toBeInTheDocument();
  });

  it("listet alle vier Schiffstypen", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getAllByText(/Schaluppe/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Brigg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fregatte/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Linienschiff/).length).toBeGreaterThan(0);
  });

  it("listet alle vier Munitionsarten", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getAllByText(/Vollkugel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kettengeschoss/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kartätsche/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Karronade/).length).toBeGreaterThan(0);
  });

  it("zeigt die Windrosen- und Segel-Physik", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByText(/WINDROSEN- & SEGEL-PHYSIK/)).toBeInTheDocument();
    expect(screen.getByText(/Krängung:/)).toBeInTheDocument();
    expect(screen.getByText(/Abdrift:/)).toBeInTheDocument();
  });

  it("zeigt die Breitseiten-Ballistik", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByText(/BREITSEITEN-BALLISTIK/)).toBeInTheDocument();
    expect(screen.getByText(/Rumpf \d+% · Takelage \d+%/)).toBeInTheDocument();
  });

  it("zeigt das Seeschlachten-Ergebnis mit Vorteil", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByText(/SEEGEFECHT — VORTEIL:/)).toBeInTheDocument();
    expect(screen.getByText(/Angreifer:/)).toBeInTheDocument();
    expect(screen.getByText(/Verteidiger:/)).toBeInTheDocument();
  });

  it("zeigt die Seeschlachten-Prosa", () => {
    render(<NauticalNavalSimulatorModal />);
    expect(screen.getByText(/SEESCHLACHTEN-PROSA/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<NauticalNavalSimulatorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
