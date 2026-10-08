// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrbitalAstrodynamicsEngineModal } from "./OrbitalAstrodynamicsEngineModal";

describe("OrbitalAstrodynamicsEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getByTestId("orbital-astrodynamics-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getByText(/Orbital-Astrodynamik & Raumflug-Rechner/)).toBeInTheDocument();
  });

  it("listet alle sechs Himmelskörper", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getAllByText(/Erde/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mond/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mars/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Venus/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jupiter/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Saturn/).length).toBeGreaterThan(0);
  });

  it("zeigt die Funkverzögerung", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getByText(/LICHTGESCHWINDIGKEITS-FUNKVERZÖGERUNG/)).toBeInTheDocument();
    expect(screen.getByText(/Einweg:/)).toBeInTheDocument();
  });

  it("zeigt den Flugbahn-Rechner", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getByText(/FLUGBAHN-RECHNER/)).toBeInTheDocument();
    expect(screen.getByText(/Delta-v:/)).toBeInTheDocument();
  });

  it("zeigt das Cockpit-Logbuch", () => {
    render(<OrbitalAstrodynamicsEngineModal />);
    expect(screen.getByText(/COCKPIT-LOGBUCH/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<OrbitalAstrodynamicsEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
