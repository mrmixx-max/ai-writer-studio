// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SensoryEpiphanySynthesizerModal } from "@/components/ai/SensoryEpiphanySynthesizerModal";

describe("SensoryEpiphanySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByTestId("sensory-epiphany-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/Transzendentale Epiphanie- & Gnadenmoment-Synthesizer/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByDisplayValue("Elara")).toBeInTheDocument();
    expect(screen.getByDisplayValue("999")).toBeInTheDocument();
    expect(screen.getByText(/Visuell \(Sehen\)/)).toBeInTheDocument();
  });

  it("zeigt drei Phasen der Epiphanie", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/PHASE 1: STILLSTAND/)).toBeInTheDocument();
    expect(screen.getByText(/PHASE 2: EINSTURZ/)).toBeInTheDocument();
    expect(screen.getByText(/PHASE 3: KATHARSIS/)).toBeInTheDocument();
  });

  it("zeigt vollständigen Fliesstext", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/VOLLSTÄNDIGER FLIESSTEXT ANZEIGEN/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Kombination", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("erklärt theoretischen Hintergrund", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/THEORETISCHER HINTERGRUND: DIE DREI-PHASEN-EPIPHANIE/)).toBeInTheDocument();
  });

  it("listet fünf Sinne", () => {
    render(<SensoryEpiphanySynthesizerModal />);
    expect(screen.getByText(/Visuell \(Sehen\)/)).toBeInTheDocument();
    expect(screen.getByText(/Auditiv \(Hören\)/)).toBeInTheDocument();
    expect(screen.getByText(/Olfaktorisch \(Riechen\)/)).toBeInTheDocument();
    expect(screen.getByText(/Taktile \(Fühlen\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gustatorisch \(Schmecken\)/)).toBeInTheDocument();
  });
});