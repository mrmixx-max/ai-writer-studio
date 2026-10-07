// @vitest-environment jsdom
/** Tests: CrowdMurmurGeneratorModal (WP 89.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrowdMurmurGeneratorModal } from "./CrowdMurmurGeneratorModal";

describe("CrowdMurmurGeneratorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByTestId("crowd-murmur-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/Menschenmengen-Gemurmel/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByDisplayValue("Marktplatz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Stimmungs-Auswahl", () => {
    render(<CrowdMurmurGeneratorModal />);
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    // First combobox is for mood
    expect(comboboxes[0]).toBeInTheDocument();
  });

  it("zeigt Tageszeit-Auswahl", () => {
    render(<CrowdMurmurGeneratorModal />);
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt Mengen-Übersicht", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/MENGEN-ÜBERSICHT/)).toBeInTheDocument();
  });

  it("zeigt alle drei Schichten", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/VORDERGRUND/)).toBeInTheDocument();
    expect(screen.getByText(/MITTELGRUND/)).toBeInTheDocument();
    expect(screen.getByText(/HINTERGRUND/)).toBeInTheDocument();
  });

  it("zeigt generierte Snippets", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/GENERIERTE SNIPPETS/)).toBeInTheDocument();
  });

  it("zeigt formatierte Ausgabe", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/FORMATIERTE AUSGABE/)).toBeInTheDocument();
  });

  it("erklärt 3-Schichten-Dialogmatrix", () => {
    render(<CrowdMurmurGeneratorModal />);
    expect(screen.getByText(/3-SCHICHTEN-DIALOGMATRIX/)).toBeInTheDocument();
  });
});