// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TonalIllusionSynthesizerModal } from "./TonalIllusionSynthesizerModal";

describe("TonalIllusionSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByTestId("tonal-illusion-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/Shepard-Tone- & Akustik-Illusionen-Synthesizer/)).toBeInTheDocument();
  });

  it("listet alle vier Pareidolie-Quellen", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getAllByText(/Regenrauschen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Windrauschen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Schenkengemurmel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Maschinenbrummen/).length).toBeGreaterThan(0);
  });

  it("zeigt die endlose Shepard-Ton-Leiter", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/SHEPARD-TON-LEITER \(ENDLOS\)/)).toBeInTheDocument();
  });

  it("zeigt die Gaußsche Amplituden-Hüllkurve", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/GAUSSSCHE AMPLITUDEN-HÜLLKURVE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Oktave/).length).toBeGreaterThan(0);
  });

  it("zeigt die flüsternden Silben der Pareidolie", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/AKUSTISCHE PAREIDOLIE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Modulation/).length).toBeGreaterThan(0);
  });

  it("zeigt die Echtzeit-Player-Parameter", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/ECHTZEIT-PLAYER-PARAMETER/)).toBeInTheDocument();
    expect(screen.getByText(/Master-Gain:/)).toBeInTheDocument();
  });

  it("nennt die Zentrale 440 Hz", () => {
    render(<TonalIllusionSynthesizerModal />);
    expect(screen.getByText(/Zentrale 440 Hz/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<TonalIllusionSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
