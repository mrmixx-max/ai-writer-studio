// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PantheonCreationMythModal } from "./PantheonCreationMythModal";

describe("PantheonCreationMythModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByTestId("pantheon-myth-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByText(/Götter-Theogonie- & Schöpfungsmythos-Weaver/)).toBeInTheDocument();
  });

  it("zeigt Pantheon-Name im Eingabefeld", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByDisplayValue("Das Zwölfgestirn")).toBeInTheDocument();
  });

  it("listet alle vier Kosmogonien", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getAllByText(/Kosmisches Welten-Ei/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Urgesang aus der Finsternis/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Erschaffung aus dem Leib eines erschlagenen Titanen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Aus dem ewigen Atem/).length).toBeGreaterThan(0);
  });

  it("zeigt Götter-Stammbaum", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByText(/GÖTTER-STAMMBAUM/)).toBeInTheDocument();
  });

  it("zeigt Sakraltext mit Genesis-Versen", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByText(/SAKRALTEXT/)).toBeInTheDocument();
  });

  it("zeigt Kosmogonie-Details", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByText(/KOSMOGONIE:/)).toBeInTheDocument();
    expect(screen.getByText(/Mechanismus:/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Laden", () => {
    render(<PantheonCreationMythModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<PantheonCreationMythModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
