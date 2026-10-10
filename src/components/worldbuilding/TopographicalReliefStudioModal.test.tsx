// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopographicalReliefStudioModal } from "./TopographicalReliefStudioModal";

describe("TopographicalReliefStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByTestId("relief-studio-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/Topografisches Höhenschichten- & Relief-Studio/)).toBeInTheDocument();
  });

  it("rendert die hypsometrische Reliefkarte", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/HYPSOMETRISCHE RELIEFKARTE/)).toBeInTheDocument();
  });

  it("listet alle sechs Höhenstufen", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/HÖHENSTUFEN-VERTEILUNG/)).toBeInTheDocument();
    for (const band of ["Meereshöhe", "Tiefland", "Hügelland", "Montane Stufe", "Alpine Stufe", "Nivale Stufe"]) {
      expect(screen.getAllByText(new RegExp(band)).length).toBeGreaterThan(0);
    }
  });

  it("zeigt die taktische Sichtachsen-Analyse", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/TAKTISCHE SICHTACHSEN-ANALYSE/)).toBeInTheDocument();
  });

  it("zeigt das Gefälle der Diagonalen", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/Gefälle Diagonale:/)).toBeInTheDocument();
  });

  it("zeigt den Höhenmeter-Erschöpfungskalkulator", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getByText(/HÖHENMETER-ERSCHÖPFUNGS-KALKULATOR/)).toBeInTheDocument();
    expect(screen.getByText(/Kalorien\/Person:/)).toBeInTheDocument();
    expect(screen.getByText(/Höhenkrankheitsrisiko:/)).toBeInTheDocument();
  });

  it("listet alle vier Gruppenprofile", () => {
    render(<TopographicalReliefStudioModal />);
    expect(screen.getAllByText(/Späher \(leicht\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wanderer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Handelstross/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Heereszug/).length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<TopographicalReliefStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
