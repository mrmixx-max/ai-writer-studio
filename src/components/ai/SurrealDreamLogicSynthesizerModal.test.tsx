// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurrealDreamLogicSynthesizerModal } from "@/components/ai/SurrealDreamLogicSynthesizerModal";

describe("SurrealDreamLogicSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByTestId("surreal-dream-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/Surrealer Traumlogik- & Visions-Synthesizer/)).toBeInTheDocument();
  });

  it("listet alle vier Traum-Dimensionen", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getAllByText(/Nicht-euklidische Raumfaltung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Zeitliche Dehnung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Identitäts-Verschmelzung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Emotionale Verschiebung/).length).toBeGreaterThan(0);
  });

  it("zeigt traum-eigene Gesetze", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/TRAUM-EIGENE GESETZE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Gesetz:/).length).toBeGreaterThan(0);
  });

  it("zeigt prophetische Symbolik", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/PROPHETISCHE SYMBOLIK/)).toBeInTheDocument();
  });

  it("zeigt Traum-Prosa", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/TRAUM-PROSA/)).toBeInTheDocument();
  });

  it("zeigt Traum-Kohärenz", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/Traum-Kohärenz/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<SurrealDreamLogicSynthesizerModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<SurrealDreamLogicSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
