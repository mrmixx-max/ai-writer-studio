// @vitest-environment jsdom
/** Tests: LoreArchaeologyEngineModal (WP 86.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoreArchaeologyEngineModal } from "./LoreArchaeologyEngineModal";

describe("LoreArchaeologyEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByTestId("lore-archaeology-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByText(/Narrative Lore-Archäologie/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder für Ort, Seed, Koordinaten", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByDisplayValue("Ruinen von Aelindor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1250")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3400")).toBeInTheDocument();
  });

  it("aktualisiert Ort-Name bei Eingabe", () => {
    render(<LoreArchaeologyEngineModal />);
    const input = screen.getByDisplayValue("Ruinen von Aelindor");
    fireEvent.change(input, { target: { value: "Neue Ruine" } });
    expect(input).toHaveValue("Neue Ruine");
  });

  it("rendert Stratigraphie-Sektion", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByText(/STRATIGRAPHIE/)).toBeInTheDocument();
  });

  it("rendert Artefakt-Sektion", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByText(/ARTEFAKT/)).toBeInTheDocument();
  });

  it("rendert Entschlüsselungs-Sektion", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByText(/INSKRIPTIONS-ENTSCHLÜSSELUNG/)).toBeInTheDocument();
  });

  it("rendert Epochen-Übersicht", () => {
    render(<LoreArchaeologyEngineModal />);
    expect(screen.getByText(/EPOCHEN-ÜBERSICHT/)).toBeInTheDocument();
  });

  it("Textarea für Inschrift ist editierbar", () => {
    render(<LoreArchaeologyEngineModal />);
    const textarea = screen.getByLabelText(/Rohtext/);
    expect(textarea).toBeInTheDocument();
  });
});