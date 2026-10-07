// @vitest-environment jsdom
/** Tests: ChoralHymnSynthesizerModal (WP 92.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoralHymnSynthesizerModal } from "./ChoralHymnSynthesizerModal";

describe("ChoralHymnSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("choral-hymn-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByText(/Schlachtruf-.*Hymnen-Synthesizer/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByDisplayValue("Eiserner Marsch")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Hymnen-Profil", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("summary-hymn-profil")).toBeInTheDocument();
  });

  it("zeigt Audio-Vorschau", () => {
    render(<ChoralHymnSynthesizerModal />);
    // Checkbox für Audio-Vorschau
    expect(screen.getByRole("checkbox", { name: /Audio-Vorschau/ })).toBeInTheDocument();
  });

  it("zeigt Hymnen-Typen & BPM-Bereiche", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("summary-hymnen-typen")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Hymnen", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("summary-beispiel-hymnen")).toBeInTheDocument();
  });

  it("zeigt Kirchenmodi & Frequenzen", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("summary-kirchenmodi")).toBeInTheDocument();
  });

  it("erklärt antiphonalen Wechselgesang", () => {
    render(<ChoralHymnSynthesizerModal />);
    expect(screen.getByTestId("summary-antiphonal")).toBeInTheDocument();
  });
});