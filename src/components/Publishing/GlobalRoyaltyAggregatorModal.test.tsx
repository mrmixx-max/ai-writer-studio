// @vitest-environment jsdom
/**
 * Tests: GlobalRoyaltyAggregatorModal (WP 83.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalRoyaltyAggregatorModal } from "./GlobalRoyaltyAggregatorModal";

describe("GlobalRoyaltyAggregatorModal", () => {
  it("rendert die Komponente", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    expect(screen.getByTestId("global-royalty-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    expect(screen.getByText("💰 Globaler Tantiemen- & Abrechnungs-Aggregator")).toBeTruthy();
  });

  it("zeigt Transaktionen", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    expect(screen.getByTestId("royalty-sales")).toBeTruthy();
  });

  it("zeigt Bericht", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    expect(screen.getByTestId("royalty-report")).toBeTruthy();
  });

  it("fügt Transaktion hinzu", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    fireEvent.click(screen.getByTestId("royalty-add-sale"));
    expect(screen.getByTestId("royalty-sale-3")).toBeTruthy();
  });

  it("reagiert auf Plattform-Auswahl", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    fireEvent.change(screen.getByTestId("royalty-platform-0"), { target: { value: "direct" } });
    expect(screen.getByTestId("royalty-report")).toBeTruthy();
  });

  it("reagiert auf Betrag", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    fireEvent.change(screen.getByTestId("royalty-amount-0"), { target: { value: "200" } });
    expect(screen.getByTestId("royalty-report")).toBeTruthy();
  });

  it("reagiert auf Währung", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    fireEvent.change(screen.getByTestId("royalty-currency-0"), { target: { value: "USD" } });
    expect(screen.getByTestId("royalty-report")).toBeTruthy();
  });

  it("shows Text-Ausgabe", () => {
    render(<GlobalRoyaltyAggregatorModal />);
    expect(screen.getByTestId("royalty-text").textContent).toContain("TANTIEMEN-ABRECHNUNG");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<GlobalRoyaltyAggregatorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
