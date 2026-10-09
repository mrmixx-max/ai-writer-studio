// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PsychologicalGaslightingWeaverModal } from "./PsychologicalGaslightingWeaverModal";

describe("PsychologicalGaslightingWeaverModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getByTestId("gaslighting-modal")).toBeInTheDocument();
  });

  it("zeigt den Titel", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getByText(/🕯️ Gaslighting- & Manipulations-Weaver/)).toBeInTheDocument();
  });

  it("zeigt TAKTIKEN", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getByText(/TAKTIKEN/)).toBeInTheDocument();
  });

  it("zeigt SUBTEXT-DIALOG", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getByText(/SUBTEXT-DIALOG/)).toBeInTheDocument();
  });

  it("zeigt MANIPULATIONS-VERLAUF", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getByText(/MANIPULATIONS-VERLAUF/)).toBeInTheDocument();
  });

  it("zeigt alle 4 Taktik-Namen", () => {
    render(<PsychologicalGaslightingWeaverModal />);
    expect(screen.getAllByText(/Realitäts-Inversion \(Gaslighting\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Love-Bombing & Entzug/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Täter-Opfer-Umkehr \(DARVO\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Triangulation/).length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<PsychologicalGaslightingWeaverModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
