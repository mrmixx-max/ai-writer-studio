// @vitest-environment jsdom
/** Tests: CombatAuditoryTunnelModal (WP 87.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CombatAuditoryTunnelModal } from "./CombatAuditoryTunnelModal";

describe("CombatAuditoryTunnelModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByTestId("combat-auditory-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/Kampf-Tinnitus/)).toBeInTheDocument();
  });

  it("zeigt Quelle-Auswahl", () => {
    render(<CombatAuditoryTunnelModal />);
    const select = screen.getByLabelText(/Schock-Quelle/);
    expect(select).toBeInTheDocument();
    expect(select.querySelector('option[value="explosion"]')).toBeInTheDocument();
  });

  it("zeigt Seed-Eingabe", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Sprach-Auswahl", () => {
    render(<CombatAuditoryTunnelModal />);
    const select = screen.getByLabelText(/Sprache/);
    expect(select).toBeInTheDocument();
    expect(select.querySelector('option[value="de"]')).toBeInTheDocument();
  });

  it("zeigt Shock-Profil Sektion", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/SHOCK-PROFIL/)).toBeInTheDocument();
  });

  it("zeigt Auditory State Sektion", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/AKTUELLER AUDITORY STATE/)).toBeInTheDocument();
  });

  it("zeigt Schock-Prosa Sektion", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/VISZERALE SCHOCK-PROSA/)).toBeInTheDocument();
  });

  it("zeigt WebAudio Demo Sektion", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/WEBAUDIO API/)).toBeInTheDocument();
  });

  it("zeigt Quellen-Vergleich", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/ALLE QUELLEN IM VERGLEICH/)).toBeInTheDocument();
  });

  it("Start-Button ist vorhanden", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/Animation starten/)).toBeInTheDocument();
  });

  it("Stop-Button ist vorhanden", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText("■ Stop")).toBeInTheDocument();
  });

  it("WebAudio Demo Button ist vorhanden", () => {
    render(<CombatAuditoryTunnelModal />);
    expect(screen.getByText(/WebAudio Demo/)).toBeInTheDocument();
  });
});