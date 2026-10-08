// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropheticOracleSynthesizerModal } from "./PropheticOracleSynthesizerModal";

describe("PropheticOracleSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getByTestId("prophetic-oracle-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getByText(/Pythisches Orakel- & Prophezeiungs-Studio/)).toBeInTheDocument();
  });

  it("listet alle vier Orakel-Archetypen", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getAllByText(/Die Pythische Trance/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Das Eiserne Dekret/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Die Ominöse Warnung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Das Paradoxon/).length).toBeGreaterThan(0);
  });

  it("zeigt die hermeneutische Doppel-Matrix", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getAllByText(/HERMENEUTISCHE DOPPEL-MATRIX/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Oberflächen-Glaube:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wahre Erfüllung:/).length).toBeGreaterThan(0);
  });

  it("zeigt das Hexameter-Metrum", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getAllByText(/Silben ·/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Zäsur nach Fuß/).length).toBeGreaterThan(0);
  });

  it("zeigt die Fehldeutungs-Wahrscheinlichkeit", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getAllByText(/Fehldeutung/).length).toBeGreaterThan(0);
  });

  it("zeigt den dominanten Archetyp", () => {
    render(<PropheticOracleSynthesizerModal />);
    expect(screen.getByText(/DOMINANTER ARCHETYP/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<PropheticOracleSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
