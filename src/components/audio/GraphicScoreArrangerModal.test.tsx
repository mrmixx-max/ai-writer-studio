// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphicScoreArrangerModal } from "./GraphicScoreArrangerModal";

describe("GraphicScoreArrangerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getByTestId("graphic-score-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getByText(/Grafische Partitur & Avantgarde-Soundtrack/)).toBeInTheDocument();
  });

  it("rendert die druckfertige Partitur als SVG", () => {
    const { container } = render(<GraphicScoreArrangerModal />);
    expect(screen.getByText(/DRUCKFERTIGE PARTITUR/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("zeigt die Spannungs-zu-Klang-Matrix", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getByText(/SPANNUNGS-ZU-KLANG-MATRIX/)).toBeInTheDocument();
    expect(screen.getAllByText(/Intensität/).length).toBeGreaterThan(0);
  });

  it("zeigt den WebAudio-Synthese-Patch", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getByText(/WEBAUDIO-SYNTHESE-PATCH/)).toBeInTheDocument();
    expect(screen.getByText(/Klangbänder über/)).toBeInTheDocument();
  });

  it("listet alle sechs Klangskulpturen", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getByText(/KLANGSKULPTUREN-VOKABULAR/)).toBeInTheDocument();
    expect(screen.getAllByText(/Drone/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mikrotonale Reibung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wuchtiges Crescendo/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cluster/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Glissando-Kurve/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stille/).length).toBeGreaterThan(0);
  });

  it("zeigt die Gesamtdauer", () => {
    render(<GraphicScoreArrangerModal />);
    expect(screen.getAllByText(/Klangbänder/).length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben (auch nicht im SVG)", () => {
    const { container } = render(<GraphicScoreArrangerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
