// @vitest-environment jsdom
/** Tests: PolyrhythmicSentenceStreamModal (WP 94.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PolyrhythmicSentenceStreamModal } from "./PolyrhythmicSentenceStreamModal";

describe("PolyrhythmicSentenceStreamModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("polyrhythmic-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByText(/Polyrhythmischer Satzmelodie/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByDisplayValue("Todesangst")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Rhythmus-Analyse", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("summary-rhythmus-analyse")).toBeInTheDocument();
  });

  it("zeigt generierte Sätze", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("summary-generierte-saetze")).toBeInTheDocument();
  });

  it("zeigt Volltext", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("summary-volltext")).toBeInTheDocument();
  });

  it("zeigt Rhythmus-Archetypen", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("summary-archetypen")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Konfigurationen", () => {
    render(<PolyrhythmicSentenceStreamModal />);
    expect(screen.getByTestId("summary-beispiel")).toBeInTheDocument();
  });
});