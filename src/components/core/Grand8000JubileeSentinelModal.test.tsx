// @vitest-environment jsdom
/**
 * Tests: Grand8000JubileeSentinelModal (WP 71.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Grand8000JubileeSentinelModal } from "./Grand8000JubileeSentinelModal";

describe("Grand8000JubileeSentinelModal", () => {
  it("rendert die Komponente", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("grand8000-jubilee-sentinel-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByText("💎 8.000-Tests-Diamant-Siegel & Sentinel")).toBeTruthy();
  });

  it("führt das Gesamtsystem-Audit durch", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-audit")).toBeTruthy();
    expect(screen.getByTestId("diamond-check-Registrierte Werkzeuge")).toBeTruthy();
  });

  it("listet alle sechs Audit-Checks", () => {
    render(<Grand8000JubileeSentinelModal />);
    [
      "Registrierte Werkzeuge",
      "Lazy-Chunks",
      "i18n-Schlüssel",
      "Caching-Tabellen",
      "Service-Abdeckung",
      "Bundle-Größe",
    ].forEach((name) => {
      expect(screen.getByTestId(`diamond-check-${name}`)).toBeTruthy();
    });
  });

  it("meldet ein gesundes System", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-healthy").textContent).toContain("integritätsgeprüft");
  });

  it("meldet ein ungesundes System ohne Werkzeuge", () => {
    render(<Grand8000JubileeSentinelModal />);
    fireEvent.change(screen.getByTestId("diamond-tool-input"), { target: { value: "0" } });
    expect(screen.getByTestId("diamond-healthy").textContent).toContain("nicht gesund");
  });

  it("meldet ein ungesundes System ohne Services", () => {
    render(<Grand8000JubileeSentinelModal />);
    fireEvent.change(screen.getByTestId("diamond-service-input"), { target: { value: "0" } });
    expect(screen.getByTestId("diamond-healthy").textContent).toContain("nicht gesund");
  });

  it("zeigt das Diamant-Zertifikat", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-certificate")).toBeTruthy();
    expect(screen.getByTestId("diamond-verified").textContent).toContain("VERIFIZIERT");
  });

  it("ist unter 8000 Tests nicht verifiziert", () => {
    render(<Grand8000JubileeSentinelModal />);
    fireEvent.change(screen.getByTestId("diamond-test-count"), { target: { value: "7999" } });
    expect(screen.getByTestId("diamond-verified").textContent).toContain("Unter 8.000");
  });

  it("zeigt die SHA-256-Prüfsumme", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-hash").textContent).toContain("SHA-256");
    expect(screen.getByTestId("diamond-hash").textContent.length).toBeGreaterThan(40);
  });

  it("zeigt das SVG-Badge", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-svg-content").innerHTML).toContain("<svg");
    expect(screen.getByTestId("diamond-svg-content").innerHTML).toContain("Diamond");
  });

  it("nutzt Design-Tokens im SVG", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-svg-content").innerHTML).toContain("var(--accent)");
  });

  it("zeigt den PDF-Inhalt", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-pdf-content").textContent).toContain("%PDF");
  });

  it("reagiert auf Versions-Eingabe", () => {
    render(<Grand8000JubileeSentinelModal />);
    fireEvent.change(screen.getByTestId("diamond-version"), { target: { value: "4.6.0" } });
    expect(screen.getByTestId("diamond-pdf-content").textContent).toContain("4.6.0");
  });

  it("zeigt die Latenz-Garantie", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-latency")).toBeTruthy();
    expect(screen.getByTestId("diamond-latency-ProceduralVoiceTimbreModal")).toBeTruthy();
  });

  it("meldet alle Modals unter 16 ms", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-latency-status").textContent).toContain("unter 16 ms");
  });

  it("nennt das langsamste Modal", () => {
    render(<Grand8000JubileeSentinelModal />);
    expect(screen.getByTestId("diamond-latency-status").textContent).toContain("SceneCameraBlockingModal");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<Grand8000JubileeSentinelModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
