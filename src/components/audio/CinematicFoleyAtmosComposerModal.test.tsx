// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CinematicFoleyAtmosComposerModal } from "./CinematicFoleyAtmosComposerModal";

describe("CinematicFoleyAtmosComposerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CinematicFoleyAtmosComposerModal />);
    expect(screen.getByTestId("cinematic-foley-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CinematicFoleyAtmosComposerModal />);
    expect(
      screen.getByText(/Kinematische Foley- & Raum-Atmos-Engine/),
    ).toBeInTheDocument();
  });

  it("zeigt Foley-Schichten", () => {
    render(<CinematicFoleyAtmosComposerModal />);
    expect(screen.getByText(/FOLEY-SCHICHTEN/)).toBeInTheDocument();
  });

  it("zeigt Szenen-Synchronisation", () => {
    render(<CinematicFoleyAtmosComposerModal />);
    expect(screen.getByText(/SZENEN-SYNCHRONISATION/)).toBeInTheDocument();
  });

  it("zeigt WebAudio-Mixer", () => {
    render(<CinematicFoleyAtmosComposerModal />);
    expect(screen.getByText(/WEB-AUDIO-MIXER/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CinematicFoleyAtmosComposerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
