// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Flagship70SovereignCockpitModal } from "./Flagship70SovereignCockpitModal";

describe("Flagship70SovereignCockpitModal", () => {
  it("rendert ohne Fehler", () => {
    render(<Flagship70SovereignCockpitModal />);
    expect(screen.getByTestId("flagship70-cockpit-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<Flagship70SovereignCockpitModal />);
    expect(screen.getByText(/Flaggschiff 7.0 Cockpit & Obsidian-Siegel/)).toBeInTheDocument();
  });

  it("zeigt 7.0-Gesamt-Audit", () => {
    render(<Flagship70SovereignCockpitModal />);
    expect(screen.getByText(/7.0-GESAMT-AUDIT/)).toBeInTheDocument();
  });

  it("zeigt Obsidian-Siegel", () => {
    render(<Flagship70SovereignCockpitModal />);
    expect(screen.getByText(/OBSIDIAN-SIEGEL/)).toBeInTheDocument();
  });

  it("zeigt Obsidian-Archiv", () => {
    render(<Flagship70SovereignCockpitModal />);
    expect(screen.getByText(/OBSIDIAN-ARCHIV/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<Flagship70SovereignCockpitModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
