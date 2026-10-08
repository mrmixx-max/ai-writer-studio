// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialecticStreamOfConsciousnessModal } from "@/components/ai/DialecticStreamOfConsciousnessModal";

describe("DialecticStreamOfConsciousnessModal", () => {
  it("rendert ohne Fehler", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByTestId("dialectic-stream-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/Zweigleisiger Bewusstseinsstrom-Synthesizer/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByDisplayValue("K")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Küche um 3 Uhr morgens")).toBeInTheDocument();
    expect(screen.getByDisplayValue("888")).toBeInTheDocument();
    // select value tested via option text
    expect(screen.getByText(/Atmend \(nur Kommas\)/)).toBeInTheDocument();
  });

  it("zeigt Spur A: Sensorische Wahrnehmung", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/SPUR A: SENSORISCHE WAHRNEHMUNG/)).toBeInTheDocument();
  });

  it("zeigt Spur B: Unwillkürliche Erinnerungen", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/SPUR B: UNWILLKÜRLICHE ERINNERUNGEN/)).toBeInTheDocument();
  });

  it("zeigt verschmolzenen Strom", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/VERSCHMOLZENER STROM/)).toBeInTheDocument();
  });

  it("zeigt vollständigen Fliesstext", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/KOMPLETTER FLIESSTEXT/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Kombination", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("erklärt theoretischen Hintergrund", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/THEORETISCHER HINTERGRUND: ZWEIGLEISIGER BEWUSSTSEINSSTROM/)).toBeInTheDocument();
  });

  it("listet fünf Interpunktions-Levels", () => {
    render(<DialecticStreamOfConsciousnessModal />);
    expect(screen.getByText(/Fluss \(keine Satzzeichen\)/)).toBeInTheDocument();
    expect(screen.getByText(/Atmend \(nur Kommas\)/)).toBeInTheDocument();
    expect(screen.getByText(/Fragmentiert \(Punkte \+ Kommas\)/)).toBeInTheDocument();
    expect(screen.getByText(/Strukturiert \(volle Interpunktion\)/)).toBeInTheDocument();
    expect(screen.getByText(/Klar \(innere Monologe\)/)).toBeInTheDocument();
  });
});