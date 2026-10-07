// @vitest-environment jsdom
/** Tests: Grand9000CitadelSentinelModal (WP 87.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Grand9000CitadelSentinelModal } from "./Grand9000CitadelSentinelModal";

describe("Grand9000CitadelSentinelModal", () => {
  it("rendert ohne Fehler", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByTestId("grand9000-citadel-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/9.000-Tests-Citadel-Siegel/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder für alle Metriken", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByLabelText(/Gesamt-Tests/)).toHaveValue(9050);
    expect(screen.getByLabelText(/Bestanden/)).toHaveValue(9050);
    expect(screen.getByLabelText(/Services/)).toHaveValue(89);
    expect(screen.getByLabelText(/Chunks/)).toHaveValue(65);
    expect(screen.getByLabelText(/i18n-Schlüssel/)).toHaveValue(1650);
    expect(screen.getByLabelText(/Bundle \(KB\)/)).toHaveValue(2800);
    expect(screen.getByLabelText(/Max Latenz \(ms\)/)).toHaveValue(14);
    expect(screen.getByLabelText(/Heap \(MB\)/)).toHaveValue(95);
  });

  it("zeigt Issuer Key Eingabe", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByDisplayValue("AIWS-CITADEL-9K")).toBeInTheDocument();
  });

  it("zeigt Audit-Sektion mit Status", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/⚔ CITADEL AUDIT ⚔/)).toBeInTheDocument();
    expect(screen.getByText(/✓ BESTANDEN/)).toBeInTheDocument();
  });

  it("zeigt alle 8 Prüfungen", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText("Test-Schallmauer (9.000+)")).toBeInTheDocument();
    expect(screen.getByText("Test-Bestand (0 Fehler)")).toBeInTheDocument();
    expect(screen.getByText("Service-Registrierung")).toBeInTheDocument();
    expect(screen.getByText("Lazy-Chunk-Coverage")).toBeInTheDocument();
    expect(screen.getByText("i18n-Vollständigkeit (4 Sprachen)")).toBeInTheDocument();
    expect(screen.getByText("Bundle-Größe")).toBeInTheDocument();
    expect(screen.getByText("Maximale Latenz")).toBeInTheDocument();
    expect(screen.getByText("Heap-Allokation")).toBeInTheDocument();
  });

  it("zeigt Citadel-Siegel", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/IMPERIALES 9.000-TESTS SIEGEL/)).toBeInTheDocument();
    expect(screen.getByText(/svg/i)).toBeInTheDocument();
  });

  it("zeigt Zertifikat-Details", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/ZERTIFIKAT-DETAILS/)).toBeInTheDocument();
  });

  it("zeigt Audit-Bericht", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/VOLLSTÄNDIGER AUDIT-BERICHT/)).toBeInTheDocument();
  });

  it("zeigt Benchmark-Cockpit", () => {
    render(<Grand9000CitadelSentinelModal />);
    expect(screen.getByText(/BENCHMARK-COCKPIT/)).toBeInTheDocument();
  });

  it("aktualisiert Werte bei Eingabe", () => {
    render(<Grand9000CitadelSentinelModal />);
    const input = screen.getByLabelText(/Gesamt-Tests/);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "9100" } });
    expect(input).toHaveValue(9100);
  });
});