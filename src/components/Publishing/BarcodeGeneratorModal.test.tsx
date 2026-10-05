// @vitest-environment jsdom
/**
 * Tests: BarcodeGeneratorModal (WP 53.1 — Vektor-ISBN- & Barcode-Generator)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BarcodeGeneratorModal } from "./BarcodeGeneratorModal";

describe("BarcodeGeneratorModal", () => {
  it("rendert nicht wenn geschlossen", () => {
    const { container } = render(<BarcodeGeneratorModal open={false} onClose={() => {}} />);
    expect(container.querySelector('[data-testid="barcode-generator-modal"]')).toBeNull();
  });

  it("rendert wenn offen", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-generator-modal")).toBeTruthy();
  });

  it("EAN-Input vorhanden", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-ean-input")).toBeTruthy();
  });

  it("Validierungs-Anzeige vorhanden", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-valid")).toBeTruthy();
  });

  it("Gültige EAN wird erkannt", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-valid").textContent).toContain("Gültig");
  });

  it("Ungültige EAN wird erkannt", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    fireEvent.change(screen.getByTestId("barcode-ean-input"), {
      target: { value: "123" },
    });
    expect(screen.getByTestId("barcode-valid").textContent).toContain("Ungültig");
  });

  it("Barcode-Vorschau wird angezeigt", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-preview")).toBeTruthy();
  });

  it("Preis-Anzeige ist zuschaltbar", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("barcode-show-price"));
    expect((screen.getByTestId("barcode-show-price") as HTMLInputElement).checked).toBe(true);
  });

  it("QR-Code-Input vorhanden", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-qr-input")).toBeTruthy();
  });

  it("QR-Code-Vorschau wird angezeigt", () => {
    render(<BarcodeGeneratorModal open onClose={() => {}} />);
    expect(screen.getByTestId("barcode-qr")).toBeTruthy();
  });

  it("schließt bei Klick", () => {
    const onClose = vi.fn();
    render(<BarcodeGeneratorModal open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("barcode-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<BarcodeGeneratorModal open onClose={() => {}} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
