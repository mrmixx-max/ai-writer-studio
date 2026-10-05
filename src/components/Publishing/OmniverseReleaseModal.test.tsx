// @vitest-environment jsdom
/**
 * Tests: OmniverseReleaseModal (WP 63.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OmniverseReleaseModal } from "./OmniverseReleaseModal";

describe("OmniverseReleaseModal", () => {
  it("rendert die Komponente", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omniverse-release-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByText("🌌 Omniverse 4.0 Master Release Cockpit")).toBeTruthy();
  });

  it("führt den Preflight aus", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-preflight")).toBeTruthy();
    expect(screen.getByTestId("omni-check-Manuskript-Umfang")).toBeTruthy();
  });

  it("listet alle sechs Prüfpunkte", () => {
    render(<OmniverseReleaseModal />);
    [
      "Manuskript-Umfang",
      "Figuren-Lexikon",
      "Conlang-Lexikon",
      "Schauplatz-Lexikon",
      "EAN-13-Barcode",
      "i18n-Abdeckung",
    ].forEach((name) => {
      expect(screen.getByTestId(`omni-check-${name}`)).toBeTruthy();
    });
  });

  it("zeigt den Release-Status", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-release-status")).toBeTruthy();
    expect(screen.getByTestId("omni-release-verdict")).toBeTruthy();
  });

  it("sperrt den Release bei zu kurzem Manuskript", () => {
    render(<OmniverseReleaseModal initialChapters="Ein sehr kurzer Text." />);
    expect(screen.getByTestId("omni-release-verdict").textContent).toContain("GESPERRT");
  });

  it("baut das Omniverse-Archiv", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-archive-name").textContent).toContain("omniverse-4.0.0");
  });

  it("verifiziert das Masterpiece Seal", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-archive-seal").textContent).toContain("verifiziert");
  });

  it("zeigt den Archiv-Hash", () => {
    render(<OmniverseReleaseModal />);
    expect((screen.getByTestId("omni-archive-hash").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("zeigt die Archiv-Kennzahlen", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-archive").textContent).toContain("Einträge");
  });

  it("erzeugt die VG-Wort-Normseite", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-normpage")).toBeTruthy();
    expect(screen.getByTestId("omni-normpage-count")).toBeTruthy();
  });

  it("berechnet das Honorar", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-normpage-fee").textContent).toContain("€");
  });

  it("zeigt eine Normseiten-Vorschau", () => {
    render(<OmniverseReleaseModal />);
    expect((screen.getByTestId("omni-normpage-preview").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("übernimmt ein neues Manuskript", () => {
    render(<OmniverseReleaseModal />);
    fireEvent.change(screen.getByTestId("omni-chapters-input"), {
      target: { value: "Ein neues Kapitel mit ausreichend Wörtern für den Test" },
    });
    expect(screen.getByTestId("omniverse-release-modal")).toBeTruthy();
  });

  it("reagiert auf den Barcode-Schalter", () => {
    render(<OmniverseReleaseModal />);
    fireEvent.click(screen.getByTestId("omni-barcode-input"));
    expect(screen.getByTestId("omni-check-EAN-13-Barcode").textContent).toContain("WARN");
  });

  it("zeigt den Preflight-Bericht", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-report-text").textContent).toContain("Universum-Preflight");
  });

  it("zeigt das Archiv-Inhaltsverzeichnis", () => {
    render(<OmniverseReleaseModal />);
    expect(screen.getByTestId("omni-manifest-text").textContent).toContain("print-x1a.pdf");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<OmniverseReleaseModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
