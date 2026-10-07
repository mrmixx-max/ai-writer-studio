// @vitest-environment jsdom
/** Tests: InUniverseEconomyLedgerModal (WP 90.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InUniverseEconomyLedgerModal } from "./InUniverseEconomyLedgerModal";

describe("InUniverseEconomyLedgerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByTestId("economy-ledger-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByText(/In-Universe Währungs/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
    // Select value is tested via role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it("zeigt Währungs-Auswahl", () => {
    render(<InUniverseEconomyLedgerModal />);
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveValue("fantasy");
  });

  it("zeigt Hauptbuch", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByText(/💰 VOLLSTÄNDIGES HAUPBUCH/)).toBeInTheDocument();
  });

  it("zeigt Preis-Übersicht", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByText(/📊 PREIS-ÜBERSICHT/)).toBeInTheDocument();
  });

  it("zeigt Plausibilitäts-Regeln", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByText(/📖 ANWENDUNG & PLAUSIBILITÄTS-REGELN/)).toBeInTheDocument();
  });

  it("zeigt Schnell-Buttons", () => {
    render(<InUniverseEconomyLedgerModal />);
    expect(screen.getByRole('button', { name: /Normal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Belagerung/ })).toBeInTheDocument();
  });
});