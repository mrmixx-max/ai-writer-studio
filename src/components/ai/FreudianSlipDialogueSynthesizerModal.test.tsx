// @vitest-environment jsdom
/** Tests: FreudianSlipDialogueSynthesizerModal (WP 94.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FreudianSlipDialogueSynthesizerModal } from "./FreudianSlipDialogueSynthesizerModal";

describe("FreudianSlipDialogueSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("freudian-slip-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByText(/Freudscher Fehlleistungs/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByDisplayValue("Der Unfall")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Thomas")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Verdrängter-Inhalt Textarea", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByText(/Verdrängter Inhalt/)).toBeInTheDocument();
  });

  it("zeigt generierten Dialog", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("summary-dialog")).toBeInTheDocument();
  });

  it("zeigt Leakage-Marker", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("summary-leakage")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Szenarien", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("summary-beispiel")).toBeInTheDocument();
  });

  it("erklärt Vermeidungs-Strategien", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("summary-vermeidung")).toBeInTheDocument();
  });

  it("zeigt theoretischen Hintergrund", () => {
    render(<FreudianSlipDialogueSynthesizerModal />);
    expect(screen.getByTestId("summary-theorie")).toBeInTheDocument();
  });
});