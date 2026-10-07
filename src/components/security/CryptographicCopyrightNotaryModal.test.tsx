// @vitest-environment jsdom
/** Tests: CryptographicCopyrightNotaryModal (WP 93.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CryptographicCopyrightNotaryModal } from "./CryptographicCopyrightNotaryModal";

describe("CryptographicCopyrightNotaryModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByTestId("copyright-notary-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByText(/Gerichtsfester Urheberrechts-Notar/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByDisplayValue("Max Mustermann")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Das große Werk")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Dokument-Eingabe", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByTestId("summary-eingabe")).toBeInTheDocument();
  });

  it("zeigt Notarisieren-Button", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByRole("button", { name: /Notarisieren/ })).toBeInTheDocument();
  });

  it("zeigt Beispiel-Dokumente", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByTestId("summary-beispiel")).toBeInTheDocument();
  });

  it("zeigt Architektur & Sicherheit", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByTestId("summary-architektur")).toBeInTheDocument();
  });

  it("zeigt Merkle-Baum & Beweis", () => {
    render(<CryptographicCopyrightNotaryModal />);
    expect(screen.getByTestId("summary-merkle")).toBeInTheDocument();
  });
});