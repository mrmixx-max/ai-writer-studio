// @vitest-environment jsdom
/**
 * Tests: GrandCenturySentinelModal (WP 65.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GrandCenturySentinelModal } from "./GrandCenturySentinelModal";

describe("GrandCenturySentinelModal", () => {
  it("rendert die Komponente", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("grand-century-sentinel-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByText("🏅 7.500er Grand-Century-Sentinel & Audit")).toBeTruthy();
  });

  it("führt das Ökosystem-Audit durch", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-audit")).toBeTruthy();
    expect(screen.getByTestId("sentinel-check-SQLite-Schemata")).toBeTruthy();
  });

  it("listet alle fünf Audit-Checks", () => {
    render(<GrandCenturySentinelModal />);
    [
      "SQLite-Schemata",
      "Caching-Indizes",
      "i18n-Vollständigkeit",
      "Bundle-Größe",
      "Service-Abdeckung",
    ].forEach((name) => {
      expect(screen.getByTestId(`sentinel-check-${name}`)).toBeTruthy();
    });
  });

  it("meldet System gesund", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-healthy").textContent).toContain("gesund");
  });

  it("erzeugt das Century-Zertifikat", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-certificate")).toBeTruthy();
    expect(screen.getByTestId("sentinel-verified").textContent).toContain("verifiziert");
  });

  it("zeigt den Zertifikat-Hash", () => {
    render(<GrandCenturySentinelModal />);
    expect((screen.getByTestId("sentinel-hash").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("reagiert auf Test-Zahl-Eingabe", () => {
    render(<GrandCenturySentinelModal />);
    fireEvent.change(screen.getByTestId("sentinel-test-count"), {
      target: { value: "8000" },
    });
    expect(screen.getByTestId("sentinel-test-count").getAttribute("value")).toBe("8000");
  });

  it("reagiert auf Version-Eingabe", () => {
    render(<GrandCenturySentinelModal />);
    fireEvent.change(screen.getByTestId("sentinel-version"), {
      target: { value: "4.2.0" },
    });
    expect(screen.getByTestId("sentinel-version").getAttribute("value")).toBe("4.2.0");
  });

  it("zeigt das SVG-Badge", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-svg-content").innerHTML).toContain("<svg");
  });

  it("zeigt den PDF-Inhalt", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-pdf-content").textContent).toContain("%PDF");
  });

  it("führt das Latenz-Audit durch", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-latency")).toBeTruthy();
    expect(screen.getByTestId("sentinel-latency-result")).toBeTruthy();
  });

  it("besteht innerhalb des Budgets", () => {
    render(<GrandCenturySentinelModal />);
    expect(screen.getByTestId("sentinel-latency-status").textContent).toContain("Innerhalb");
  });

  it("reagiert auf Latenz-Komponenten-Eingabe", () => {
    render(<GrandCenturySentinelModal />);
    fireEvent.change(screen.getByTestId("sentinel-latency-component"), {
      target: { value: "TestModal" },
    });
    expect(screen.getByTestId("sentinel-latency-component").getAttribute("value")).toBe("TestModal");
  });

  it("reagiert auf Latenz-ms-Eingabe", () => {
    render(<GrandCenturySentinelModal />);
    fireEvent.change(screen.getByTestId("sentinel-latency-ms"), {
      target: { value: "20" },
    });
    expect(screen.getByTestId("sentinel-latency-status").textContent).toContain("überschritten");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<GrandCenturySentinelModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
