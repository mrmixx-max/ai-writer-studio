// @vitest-environment jsdom
/**
 * Tests: DirectSalesVaultModal (WP 75.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DirectSalesVaultModal } from "./DirectSalesVaultModal";

describe("DirectSalesVaultModal", () => {
  it("rendert die Komponente", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("direct-sales-vault-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByText("🔐 Direktvertriebs-Ex-Libris- & Lizenz-Tresor")).toBeTruthy();
  });

  it("zeigt Wasserzeichen", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("zeigt Lizenz", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-license")).toBeTruthy();
  });

  it("zeigt Ex-Libris-Frontispiz", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-frontispiz")).toBeTruthy();
  });

  it("zeigt Wasserzeichen als verifiziert", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-watermark-valid").textContent).toContain("Verifiziert");
  });

  it("zeigt Lizenz als verifiziert", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-license-valid").textContent).toContain("Verifiziert");
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("reagiert auf Format-Auswahl", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-format-select"), { target: { value: "pdf" } });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("reagiert auf Preis-Eingabe", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-price-input"), { target: { value: "29.99" } });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("reagiert auf Käufer-Eingabe", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-owner-input"), {
      target: { value: "Max Mustermann" },
    });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("reagiert auf Transaktions-Eingabe", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-transaction-input"), {
      target: { value: "TXN-999" },
    });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("reagiert auf Edition-Eingabe", () => {
    render(<DirectSalesVaultModal />);
    fireEvent.change(screen.getByTestId("vault-edition-input"), {
      target: { value: "Limitierte Auflage" },
    });
    expect(screen.getByTestId("vault-watermark")).toBeTruthy();
  });

  it("zeigt SVG im Frontispiz", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-frontispiz-svg").innerHTML).toContain("<svg");
  });

  it("zeigt vollständigen Bericht", () => {
    render(<DirectSalesVaultModal />);
    expect(screen.getByTestId("vault-report-text").textContent).toContain("DIREKTVERTRIEB");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<DirectSalesVaultModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
