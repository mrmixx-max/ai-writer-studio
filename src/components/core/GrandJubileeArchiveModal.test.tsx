// @vitest-environment jsdom
/**
 * Tests: GrandJubileeArchiveModal (WP 61.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GrandJubileeArchiveModal } from "./GrandJubileeArchiveModal";

describe("GrandJubileeArchiveModal", () => {
  it("rendert die Komponente", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("grand-jubilee-archive-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByText("🏆 7.000-Tests-Jubiläums-Siegel")).toBeTruthy();
  });

  it("stellt ein Zertifikat aus", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-certificate")).toBeTruthy();
    expect(screen.getByTestId("jubilee-testcount").textContent).toBe("7000");
  });

  it("vergibt Gold bei 7000 Tests", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-medal").textContent).toContain("GOLD");
  });

  it("vergibt Bronze bei wenigen Tests", () => {
    render(<GrandJubileeArchiveModal testCount={100} />);
    expect(screen.getByTestId("jubilee-medal").textContent).toContain("BRONZE");
  });

  it("zeigt den Hash", () => {
    render(<GrandJubileeArchiveModal />);
    expect((screen.getByTestId("jubilee-hash").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("verifiziert die Signatur", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-verification").textContent).toContain("verifiziert");
  });

  it("nennt den Aussteller", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-certificate").textContent).toContain("System-Sentinel");
  });

  it("zeigt die Version", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-certificate").textContent).toContain("3.9.0");
  });

  it("erzeugt ein SVG-Badge", () => {
    render(<GrandJubileeArchiveModal />);
    const svg = screen.getByTestId("jubilee-badge-svg").textContent ?? "";
    expect(svg).toContain("<svg");
    expect(svg).toContain("7000");
  });

  it("zeigt den Vollständigkeits-Scan", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-scan")).toBeTruthy();
    expect(screen.getByTestId("jubilee-scan-score")).toBeTruthy();
  });

  it("listet alle fünf Prüfpunkte", () => {
    render(<GrandJubileeArchiveModal />);
    ["Service-Registrierung", "Modi-Registrierung", "i18n-Vollständigkeit", "Lazy-Chunks", "Reachability"].forEach(
      (name) => {
        expect(screen.getByTestId(`jubilee-check-${name}`)).toBeTruthy();
      },
    );
  });

  it("zeigt einen positiven Scan-Score bei gesundem System", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-scan-score").textContent).toContain("100%");
  });

  it("zeigt den Performance-Audit", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-performance")).toBeTruthy();
    expect(screen.getByTestId("jubilee-latency")).toBeTruthy();
  });

  it("bestätigt flüssiges Tippen", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-performance-verdict").textContent).toContain("Flüssig");
  });

  it("zeigt den vollständigen Bericht", () => {
    render(<GrandJubileeArchiveModal />);
    expect(screen.getByTestId("jubilee-report-text").textContent).toContain("Vollständigkeit");
  });

  it("übernimmt eine neue Testzahl", () => {
    render(<GrandJubileeArchiveModal />);
    fireEvent.change(screen.getByTestId("jubilee-testcount-input"), { target: { value: "7500" } });
    expect(screen.getByTestId("jubilee-testcount").textContent).toBe("7500");
  });

  it("übernimmt eine neue Version", () => {
    render(<GrandJubileeArchiveModal />);
    fireEvent.change(screen.getByTestId("jubilee-version-input"), { target: { value: "4.0.0" } });
    expect(screen.getByTestId("jubilee-certificate").textContent).toContain("4.0.0");
  });

  it("reagiert auf geänderte Servicezahl", () => {
    render(<GrandJubileeArchiveModal />);
    fireEvent.change(screen.getByTestId("jubilee-services-input"), { target: { value: "30" } });
    expect(screen.getByTestId("jubilee-performance").textContent).toContain("30");
  });

  it("nutzt Design-Token statt Hex-Farben in der App-UI", () => {
    const { container } = render(<GrandJubileeArchiveModal />);
    // Das Badge-SVG ist ein Export-Artefakt mit fester Gold-Palette;
    // die App-Oberfläche selbst muss token-basiert sein.
    const appHtml = container.innerHTML.split('data-testid="jubilee-badge-svg"')[0];
    const hexes = appHtml.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
