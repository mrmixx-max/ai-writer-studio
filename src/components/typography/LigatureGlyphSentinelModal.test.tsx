// @vitest-environment jsdom
/** Tests: LigatureGlyphSentinelModal (WP 89.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LigatureGlyphSentinelModal } from "./LigatureGlyphSentinelModal";

describe("LigatureGlyphSentinelModal", () => {
  it("rendert ohne Fehler", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByTestId("ligature-sentinel-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/Ligaturen- & Morphemgrenzen-Wächter/)).toBeInTheDocument();
  });

  it("zeigt Eingabe-Textarea", () => {
    render(<LigatureGlyphSentinelModal />);
    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes.length).toBeGreaterThanOrEqual(2);
    // Text is in the textarea value
    expect((textboxes[0] as HTMLTextAreaElement).value).toContain("Auf-fahrt");
  });

  it("zeigt Auto-Korrektur Checkbox", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/Auto-Korrektur/)).toBeInTheDocument();
  });

  it("zeigt Korrigierten Text", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/Korrigierter Text/)).toBeInTheDocument();
  });

  it("zeigt Statistiken", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/STATISTIKEN/)).toBeInTheDocument();
    expect(screen.getByText(/Gesamte Ligaturen/)).toBeInTheDocument();
  });

  it("zeigt Ligatur-Verletzungen", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/LIGATUR-VERLETZUNGEN/)).toBeInTheDocument();
  });

  it("zeigt Morphemgrenzen-Details", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/MORPHEMGRENZEN-DETAILS/)).toBeInTheDocument();
  });

  it("zeigt Unterstützte Ligatur-Regeln", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/UNTERSTÜTZTE LIGATUR-REGELN/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Texte", () => {
    render(<LigatureGlyphSentinelModal />);
    expect(screen.getByText(/BEISPIEL-TEXTE/)).toBeInTheDocument();
  });
});