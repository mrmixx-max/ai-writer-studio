// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OmniverseNarrativeArchitectModal } from "./OmniverseNarrativeArchitectModal";

describe("OmniverseNarrativeArchitectModal", () => {
  it("rendert ohne Fehler", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByTestId("omniverse-architect-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/360° Omniverse Story-Architekt/)).toBeInTheDocument();
  });

  it("zeigt ganzheitlichen Zustand mit Health-Score", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/GANZHEITLICHER ZUSTAND/)).toBeInTheDocument();
    expect(screen.getByText(/Gesundheitsscore/)).toBeInTheDocument();
  });

  it("zeigt das Inkonsistenz-Frühwarnsystem", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/INKONSISTENZ-FRÜHWARNSYSTEM/)).toBeInTheDocument();
  });

  it("meldet zu schnelles Reiten und gefallene Währung", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/travelTooFast/)).toBeInTheDocument();
    expect(screen.getByText(/fallenCurrency/)).toBeInTheDocument();
  });

  it("zeigt System-Verknüpfungen", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/SYSTEM-VERKNÜPFUNGEN/)).toBeInTheDocument();
    expect(screen.getAllByText(/\[map\]/).length).toBeGreaterThan(0);
  });

  it("bietet 1-Klick-Synchronisation", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/1-Klick-Synchronisation/)).toBeInTheDocument();
  });

  it("zeigt den Synchronisations-Bericht", () => {
    render(<OmniverseNarrativeArchitectModal />);
    expect(screen.getByText(/SYNCHRONISATIONS-BERICHT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<OmniverseNarrativeArchitectModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
