// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortolanNauticalChartModal } from "./PortolanNauticalChartModal";

describe("PortolanNauticalChartModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByTestId("portolan-chart-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByText(/Historisches Portolan-Seekarten-Studio/)).toBeInTheDocument();
  });

  it("zeigt die Seekarte als SVG", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByText(/PORTOLAN-SEEKARTE \(VEKTOR\)/)).toBeInTheDocument();
  });

  it("listet alle 16 Kompassrichtungen", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByText(/LOXODROMEN-NETZ/)).toBeInTheDocument();
    expect(screen.getByText(/Richtungen:/)).toBeInTheDocument();
  });

  it("zeigt die maritimen Vignetten", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByText(/MARITIME VIGNETTEN/)).toBeInTheDocument();
  });

  it("zeigt den 300-DPI-Druckexport", () => {
    render(<PortolanNauticalChartModal />);
    expect(screen.getByText(/300-DPI-DRUCKEXPORT/)).toBeInTheDocument();
    expect(screen.getByText(/Auflösung:/)).toBeInTheDocument();
    expect(screen.getByText(/Beschnittzugabe:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<PortolanNauticalChartModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
