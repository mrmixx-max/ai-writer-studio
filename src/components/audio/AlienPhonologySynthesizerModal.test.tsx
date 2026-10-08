// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlienPhonologySynthesizerModal } from "./AlienPhonologySynthesizerModal";

describe("AlienPhonologySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByTestId("alien-phonology-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/Nicht-menschliche Alien-Phonologie-Engine/)).toBeInTheDocument();
  });

  it("listet alle drei Lautapparate", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getAllByText(/Insektoid \/ Chitin/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hydro-Akustik/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kristallin \/ Mineralisch/).length).toBeGreaterThan(0);
  });

  it("zeigt den biomechanischen Lautapparat mit Mechanismus", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/LAUTAPPARAT:/)).toBeInTheDocument();
    expect(screen.getByText(/Mechanismus:/)).toBeInTheDocument();
    expect(screen.getByText(/Stridulation/)).toBeInTheDocument();
  });

  it("zeigt die Conlang-Übersetzungs-Matrix", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/CONLANG-ÜBERSETZUNGS-MATRIX/)).toBeInTheDocument();
    expect(screen.getAllByText(/das fließende Gedächtnis/).length).toBeGreaterThan(0);
  });

  it("zeigt die Äußerung mit Sinntranslation", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/ÄUSSERUNG & SINNTRANSLATION/)).toBeInTheDocument();
  });

  it("zeigt die WebAudio-Synthese-Parameter", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/WEBAUDIO-SYNTHESE-PARAMETER/)).toBeInTheDocument();
    expect(screen.getByText(/Oszillator:/)).toBeInTheDocument();
    expect(screen.getByText(/Infraschall:/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<AlienPhonologySynthesizerModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AlienPhonologySynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
