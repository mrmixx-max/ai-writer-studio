// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiteraryAgentPitchDeckModal } from "./LiteraryAgentPitchDeckModal";

describe("LiteraryAgentPitchDeckModal", () => {
  it("rendert ohne Fehler", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByTestId("literary-pitch-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/Agentur-Pitch-Deck & Query-Letter-Studio/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder mit Beispielwerten", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByDisplayValue("Das Zwölfgestirn")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Erik Gieske")).toBeInTheDocument();
  });

  it("listet alle sechs Genres", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getAllByText(/Literarische Fiktion/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Thriller/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fantasy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Science-Fiction/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Historischer Roman/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Romance/).length).toBeGreaterThan(0);
  });

  it("zeigt die Normseiten-Konformität", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/Normseiten-Konformität:/)).toBeInTheDocument();
    expect(screen.getByText(/Genre-Bandbreite:/)).toBeInTheDocument();
  });

  it("zeigt den Query Letter", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/QUERY LETTER/)).toBeInTheDocument();
    expect(screen.getAllByText(/Mit freundlichen Grüßen/).length).toBeGreaterThan(0);
  });

  it("zeigt die Comp-Title-Positionierung", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/COMP-TITLE-POSITIONIERUNG/)).toBeInTheDocument();
    expect(screen.getAllByText(/Für Leser von/).length).toBeGreaterThan(0);
  });

  it("zeigt das Einreichungs-Dossier mit PDF-Gliederung", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/1-KLICK-EINREICHUNGS-DOSSIER/)).toBeInTheDocument();
    expect(screen.getByText(/PDF-Gliederung:/)).toBeInTheDocument();
  });

  it("zeigt die E-Mail-Vorlage", () => {
    render(<LiteraryAgentPitchDeckModal />);
    expect(screen.getByText(/E-MAIL-VORLAGE/)).toBeInTheDocument();
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<LiteraryAgentPitchDeckModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
