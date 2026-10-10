// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CyberneticAugmentationLedgerModal } from "./CyberneticAugmentationLedgerModal";

describe("CyberneticAugmentationLedgerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CyberneticAugmentationLedgerModal />);
    expect(screen.getByTestId("cybernetic-augmentation-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CyberneticAugmentationLedgerModal />);
    expect(screen.getByText(/Cyberware- & Transhumanismus-Hauptbuch/)).toBeInTheDocument();
  });

  it("listet alle fünf Augmentierungs-Slots", () => {
    render(<CyberneticAugmentationLedgerModal />);
    expect(screen.getAllByText(/Neuro-Interface \(Neural Lace\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sensorische Cyberoptik/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Künstliche Gliedmaßen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Biosynthetische Organe/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Subdermale Panzerung/).length).toBeGreaterThan(0);
  });

  it("zeigt den Menschlichkeitsverlust-Index", () => {
    render(<CyberneticAugmentationLedgerModal />);
    expect(screen.getByText(/MENSCHLICHKEITSVERLUST- & DISSOCIATIONS-INDEX/)).toBeInTheDocument();
    expect(screen.getByText(/Dissoziations-Index:/)).toBeInTheDocument();
  });

  it("zeigt die Glitch-Prosa", () => {
    render(<CyberneticAugmentationLedgerModal />);
    expect(screen.getByText(/GLITCH- & HUD-PROSA/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CyberneticAugmentationLedgerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
