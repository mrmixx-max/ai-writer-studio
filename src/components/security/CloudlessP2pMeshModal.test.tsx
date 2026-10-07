// @vitest-environment jsdom
/** Tests: CloudlessP2pMeshModal (WP 91.2 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CloudlessP2pMeshModal } from "./CloudlessP2pMeshModal";

describe("CloudlessP2pMeshModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByTestId("cloudless-p2p-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/Cloud-freies P2P-Mesh/)).toBeInTheDocument();
  });

  it("zeigt Konfiguration", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/KONFIGURATION/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByDisplayValue("Mein Laptop")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Desktop-PC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Geräte-Status", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/GERÄTE-STATUS/)).toBeInTheDocument();
  });

  it("zeigt Steuerung", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/STEUERUNG/)).toBeInTheDocument();
  });

  it("zeigt Aktivitäten-Log", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/AKTIVITÄTS-LOG/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Sync-Delta", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/BEISPIEL-SYNC-DELTA/)).toBeInTheDocument();
  });

  it("zeigt Architektur & Sicherheit", () => {
    render(<CloudlessP2pMeshModal />);
    expect(screen.getByText(/ARCHITEKTUR & SICHERHEIT/)).toBeInTheDocument();
  });
});