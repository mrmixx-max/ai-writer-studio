// @vitest-environment jsdom
/** Tests: MetaphorAlchemySynthesizerModal (WP 95.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetaphorAlchemySynthesizerModal } from "./MetaphorAlchemySynthesizerModal";

describe("MetaphorAlchemySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("metaphor-alchemy-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByText(/Metaphern-Alchemie/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByDisplayValue("Trauer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Architektur")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt generierte Metaphern", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-metaphern")).toBeInTheDocument();
  });

  it("zeigt Statistik", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-statistik")).toBeInTheDocument();
  });

  it("zeigt Klischee-Check", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-klischee-check")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Kombinationen", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-beispiel")).toBeInTheDocument();
  });

  it("erklärt Mapping-Typen", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-mapping-typen")).toBeInTheDocument();
  });

  it("listet verfügbare Domänen", () => {
    render(<MetaphorAlchemySynthesizerModal />);
    expect(screen.getByTestId("summary-domänen")).toBeInTheDocument();
  });
});