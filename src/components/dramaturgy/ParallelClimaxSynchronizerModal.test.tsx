// @vitest-environment jsdom
/** Tests: ParallelClimaxSynchronizerModal (WP 93.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParallelClimaxSynchronizerModal } from "./ParallelClimaxSynchronizerModal";

describe("ParallelClimaxSynchronizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("parallel-climax-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByText(/Paralleler Klimax/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByDisplayValue("Die Schlacht um Eldoria")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Synchronisations-Profil", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-sync-profil")).toBeInTheDocument();
  });

  it("zeigt Strang-Details", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-strand-details")).toBeInTheDocument();
  });

  it("zeigt Match-Cuts", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-match-cuts")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Szenen", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-beispiel-szenen")).toBeInTheDocument();
  });

  it("zeigt Strang-Anzahl & Beat-Struktur", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-strand-anzahl")).toBeInTheDocument();
  });

  it("zeigt kinematische Match-Cut-Hooks", () => {
    render(<ParallelClimaxSynchronizerModal />);
    expect(screen.getByTestId("summary-kinematic-hooks")).toBeInTheDocument();
  });
});