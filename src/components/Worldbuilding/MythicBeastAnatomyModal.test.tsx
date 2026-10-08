// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MythicBeastAnatomyModal } from "./MythicBeastAnatomyModal";

describe("MythicBeastAnatomyModal", () => {
  it("rendert ohne Fehler", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByTestId("mythic-beast-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByText(/Mythologisches Bestiarium & Anatomie-Studio/)).toBeInTheDocument();
  });

  it("zeigt Kreaturname im Eingabefeld", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByDisplayValue("Nachtgreif")).toBeInTheDocument();
  });

  it("listet alle sechs Lebensräume", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getAllByText(/Tiefsee/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hochgebirge/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unterwelt\/Höhlen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Urwald/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wüste/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vulkanische Zone/).length).toBeGreaterThan(0);
  });

  it("zeigt biologische Adaption", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByText(/BIOLOGISCHE ADAPTION/)).toBeInTheDocument();
    expect(screen.getByText(/Röhrenknochen/)).toBeInTheDocument();
  });

  it("zeigt mittelalterlichen Volksglauben", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByText(/MITTELALTERLICHER VOLKSGLAUBE/)).toBeInTheDocument();
  });

  it("zeigt Naturforscher-Tagebuch", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByText(/NATURFORSCHER-TAGEBUCH/)).toBeInTheDocument();
    expect(screen.getByText(/Eintrag 1/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<MythicBeastAnatomyModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<MythicBeastAnatomyModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
