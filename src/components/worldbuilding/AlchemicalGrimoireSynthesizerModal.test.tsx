// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlchemicalGrimoireSynthesizerModal } from "./AlchemicalGrimoireSynthesizerModal";

describe("AlchemicalGrimoireSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByTestId("alchemical-grimoire-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByText(/Alchemistisches Grimoire- & Zauber-Studio/)).toBeInTheDocument();
  });

  it("zeigt Axiom-Auswahl mit allen vier Axiomen", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getAllByText(/Sympathische Alchemie/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Runen-Gravur/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Elementar-Bindung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ältere Zauberei/).length).toBeGreaterThan(0);
  });

  it("zeigt Reagenzien-Gitter", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByText(/REAGENZIEN-GITTER/)).toBeInTheDocument();
    expect(screen.getByText(/Drachenblut \(feurig\)/)).toBeInTheDocument();
  });

  it("zeigt Explosions- und Rückschlaggefahr", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByText(/Explosionsgefahr/)).toBeInTheDocument();
    expect(screen.getByText(/Rückschlaggefahr/)).toBeInTheDocument();
  });

  it("zeigt Inkantation mit Metrum", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByText(/INKANTATION/)).toBeInTheDocument();
    expect(screen.getByText(/Silben/)).toBeInTheDocument();
  });

  it("rendert die illuminierte Zauberkreis-Seite", () => {
    const { container } = render(<AlchemicalGrimoireSynthesizerModal />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AlchemicalGrimoireSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<AlchemicalGrimoireSynthesizerModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });
});
