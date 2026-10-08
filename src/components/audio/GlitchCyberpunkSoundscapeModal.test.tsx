// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlitchCyberpunkSoundscapeModal } from "./GlitchCyberpunkSoundscapeModal";

describe("GlitchCyberpunkSoundscapeModal", () => {
  it("rendert ohne Fehler", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getByTestId("glitch-cyberpunk-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getByText(/Glitch-Cyberpunk- & Netrunning-Soundscape/)).toBeInTheDocument();
  });

  it("listet alle fünf Soundscape-Schichten", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getAllByText(/Dark-Synth-Bass/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/60-Hz-Serverbrummen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bitcrushed Rauschimpuls/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Netrunning-Rückkopplung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HUD-Signalton/).length).toBeGreaterThan(0);
  });

  it("listet alle fünf Netrunning-Effekte", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getAllByText(/Modem-Handshake/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Datenstrom/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Firewall-Durchbruch/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ICE-Pick/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Schwarze Wand/).length).toBeGreaterThan(0);
  });

  it("zeigt den WebAudio-Patch", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getByText(/WEBAUDIO-PATCH/)).toBeInTheDocument();
    expect(screen.getByText(/Master-Gain:/)).toBeInTheDocument();
  });

  it("zeigt den Studio-Player", () => {
    render(<GlitchCyberpunkSoundscapeModal />);
    expect(screen.getByText(/STUDIO-PLAYER/)).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<GlitchCyberpunkSoundscapeModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
