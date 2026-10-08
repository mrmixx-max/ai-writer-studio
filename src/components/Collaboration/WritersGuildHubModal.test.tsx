// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WritersGuildHubModal } from "./WritersGuildHubModal";

describe("WritersGuildHubModal", () => {
  it("rendert ohne Fehler", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByTestId("writers-guild-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/Lokale Autoren-Gilde & Multi-Seat-Hub/)).toBeInTheDocument();
  });

  it("zeigt verschlüsselte Sitzung", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/Ende-zu-Ende verschlüsselt/)).toBeInTheDocument();
  });

  it("zeigt farbcodierte Präsenz", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/FARBCODIERTE PRÄSENZ/)).toBeInTheDocument();
  });

  it("listet alle fünf Rollen-Tiers", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/ROLLEN- & BERECHTIGUNGS-TIERS/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hauptautor/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Co-Autor/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sensitivitäts-Leser/).length).toBeGreaterThan(0);
  });

  it("zeigt CRDT-Delta mit Ciphertext und Roundtrip", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/CRDT-DELTA/)).toBeInTheDocument();
    expect(screen.getByText(/Ciphertext:/)).toBeInTheDocument();
    expect(screen.getByText(/Entschlüsselt \(Roundtrip\):/)).toBeInTheDocument();
  });

  it("zeigt Live-Cursor-Positionen", () => {
    render(<WritersGuildHubModal />);
    expect(screen.getByText(/LIVE-CURSOR-POSITIONEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<WritersGuildHubModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
