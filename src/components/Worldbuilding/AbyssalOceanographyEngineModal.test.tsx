// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AbyssalOceanographyEngineModal } from "./AbyssalOceanographyEngineModal";

describe("AbyssalOceanographyEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByTestId("abyssal-oceanography-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByText(/Tiefsee-Ozeanografie & Abyssale Zonen/)).toBeInTheDocument();
  });

  it("listet alle fünf pelagialen Tiefenstufen", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getAllByText(/Epipelagial \(Sonnenzone\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mesopelagial \(Dämmerzone\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bathypelagial \(Tiefsee\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Abyssopelagial \(Abgrund\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hadopelagial \(Tiefseegraben\)/).length).toBeGreaterThan(0);
  });

  it("zeigt die Tiefenmessung mit Druck und Licht", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByText(/TIEFENMESSUNG/)).toBeInTheDocument();
    expect(screen.getByText(/Hydrostatischer Druck:/)).toBeInTheDocument();
    expect(screen.getByText(/Restlicht:/)).toBeInTheDocument();
  });

  it("zeigt das Biolumineszenz-Spektrum", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByText(/BIOLUMINESZENZ-SPEKTRUM/)).toBeInTheDocument();
  });

  it("zeigt die klaustrophobische Tiefsee-Prosa", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByText(/KLAUSTROPHOBISCHE TIEFSEE-PROSA/)).toBeInTheDocument();
  });

  it("zeigt das Ozean-Profil", () => {
    render(<AbyssalOceanographyEngineModal />);
    expect(screen.getByText(/OZEAN-PROFIL/)).toBeInTheDocument();
    expect(screen.getByText(/Tiefste Zone:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AbyssalOceanographyEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
