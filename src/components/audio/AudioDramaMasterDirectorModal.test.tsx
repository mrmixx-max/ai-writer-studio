// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioDramaMasterDirectorModal } from "./AudioDramaMasterDirectorModal";

describe("AudioDramaMasterDirectorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByTestId("audio-drama-director-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/Full-Cast Hörspiel-Master-Regiepult/)).toBeInTheDocument();
  });

  it("zeigt Cast mit Stimmprofilen", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/CAST & STIMMPROFILE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Stimmprofil:/).length).toBeGreaterThan(0);
  });

  it("zeigt alle vier Master-Spuren", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/4-SPUR-MASTER-ZEITLEISTE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Stimm-Spur/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Foley-Geräusch-Spur/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ambient-Schleife/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Musik-Leitmotiv-Spur/).length).toBeGreaterThan(0);
  });

  it("zeigt WebAudio-Vorhören mit Mixdown", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/WEB-AUDIO-VORHÖREN/)).toBeInTheDocument();
    expect(screen.getByText(/Spitzenwert:/)).toBeInTheDocument();
  });

  it("zeigt den Cuesheet-CSV-Export", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/DAW-EXPORT — CUESHEET/)).toBeInTheDocument();
    expect(screen.getByText(/Cue,Start,Dauer,Spur,Label,Rolle/)).toBeInTheDocument();
  });

  it("zeigt den EDL-Export", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/DAW-EXPORT — EDL/)).toBeInTheDocument();
    expect(screen.getByText(/FCM: NON-DROP FRAME/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<AudioDramaMasterDirectorModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AudioDramaMasterDirectorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
