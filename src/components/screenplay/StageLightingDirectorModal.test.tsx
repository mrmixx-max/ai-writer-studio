// @vitest-environment jsdom
/** Tests: StageLightingDirectorModal (WP 88.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageLightingDirectorModal } from "./StageLightingDirectorModal";

describe("StageLightingDirectorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByTestId("stage-lighting-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByText(/Bühnen-Lichtregie/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByDisplayValue("Akt 1, Szene 1 - Schlosshof bei Nacht")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Szenen-Übersicht", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByText(/SZENEN-ÜBERSICHT/)).toBeInTheDocument();
  });

  it("zeigt Cues", () => {
    render(<StageLightingDirectorModal />);
    const cues = screen.getAllByText(/Cue 1/);
    expect(cues.length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt Regie-Skript", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByText(/VOLLSTÄNDIGES REGIE-SKRIPT/)).toBeInTheDocument();
  });

  it("zeigt Kelvin-Matrix", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByText(/KELVIN-STIMMUNGS-MATRIX/)).toBeInTheDocument();
  });

  it("zeigt Lichtquellen-Details", () => {
    render(<StageLightingDirectorModal />);
    expect(screen.getByText(/KEY/)).toBeInTheDocument();
    expect(screen.getByText(/FILL/)).toBeInTheDocument();
  });
});