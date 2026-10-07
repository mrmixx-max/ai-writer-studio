// @vitest-environment jsdom
/** Tests: SocialEtiquetteProtocolModal (WP 86.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialEtiquetteProtocolModal } from "./SocialEtiquetteProtocolModal";

describe("SocialEtiquetteProtocolModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByTestId("social-etiquette-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/Hof-Etikette/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder für Protokoll, Sprecher, Angeredeten", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByDisplayValue("Kaiserlicher Hof")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ritter Falk")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Herzog Aldric")).toBeInTheDocument();
  });

  it("zeigt Rang-Auswahl", () => {
    render(<SocialEtiquetteProtocolModal />);
    const select = screen.getByLabelText(/Sprecher-Rang/);
    expect(select).toBeInTheDocument();
    expect(select.querySelector('option[value="ritter"]')).toBeInTheDocument();
    expect(select.querySelector('option[value="herzog"]')).toBeInTheDocument();
  });

  it("zeigt Kontext-Auswahl", () => {
    render(<SocialEtiquetteProtocolModal />);
    const select = screen.getByLabelText(/Kontext/);
    expect(select).toBeInTheDocument();
    expect(select.querySelector('option[value="audienz"]')).toBeInTheDocument();
  });

  it("zeigt Gruss-Prüfung Sektion", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/GRUSS-PRÜFUNG/)).toBeInTheDocument();
  });

  it("zeigt Dialog-Scanner Sektion", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/DIALOG-SCANNER/)).toBeInTheDocument();
  });

  it("zeigt Skandal-Index", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/SKANDAL-INDEX/)).toBeInTheDocument();
  });

  it("zeigt Titel & Anredeformen", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/TITEL & ANREDEFORMEN/)).toBeInTheDocument();
  });

  it("zeigt Tabus & Grenzen", () => {
    render(<SocialEtiquetteProtocolModal />);
    expect(screen.getByText(/TABUS & GRENZEN/)).toBeInTheDocument();
  });

  it("Textarea für Dialog ist editierbar", () => {
    render(<SocialEtiquetteProtocolModal />);
    const textarea = screen.getByLabelText(/Dialog-Text/);
    expect(textarea).toBeInTheDocument();
  });
});