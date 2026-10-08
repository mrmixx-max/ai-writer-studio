// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuantumNarrativeConvergenceModal } from "./QuantumNarrativeConvergenceModal";

describe("QuantumNarrativeConvergenceModal", () => {
  it("rendert ohne Fehler", () => {
    render(<QuantumNarrativeConvergenceModal />);
    expect(screen.getByTestId("quantum-narrative-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<QuantumNarrativeConvergenceModal />);
    expect(screen.getByText(/Multi-POV-Konvergenz- & Showdown-Orchestrator/)).toBeInTheDocument();
  });

  it("zeigt Synchronraster", () => {
    render(<QuantumNarrativeConvergenceModal />);
    expect(screen.getByText(/SYNCHRONASTER/)).toBeInTheDocument();
  });

  it("zeigt Handoff-Weaving", () => {
    render(<QuantumNarrativeConvergenceModal />);
    expect(screen.getByText(/HANDOFF-WEAVING/)).toBeInTheDocument();
  });

  it("zeigt Kausalitäts-Kaskade", () => {
    render(<QuantumNarrativeConvergenceModal />);
    expect(screen.getByText(/KAUSALITÄTS-KASKADE/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<QuantumNarrativeConvergenceModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
