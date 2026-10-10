// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DirectSalesProductBundlerModal } from "./DirectSalesProductBundlerModal";

describe("DirectSalesProductBundlerModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<DirectSalesProductBundlerModal />);
    expect(getByTestId("direct-sales-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<DirectSalesProductBundlerModal />);
    expect(
      screen.getByText("🛒 Direktvertriebs-Produkt- & Bundle-Generator")
    ).toBeTruthy();
  });

  it("zeigt die Preisstufen", () => {
    render(<DirectSalesProductBundlerModal />);
    expect(screen.getByText("PREISSTUFEN")).toBeTruthy();
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deluxe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Collector").length).toBeGreaterThan(0);
  });

  it("zeigt den Margenvergleich", () => {
    render(<DirectSalesProductBundlerModal />);
    expect(screen.getByText("MARGENVERGLEICH")).toBeTruthy();
    expect(screen.getByText("Direktvertrieb netto")).toBeTruthy();
    expect(screen.getByText("Amazon netto")).toBeTruthy();
  });

  it("zeigt den CSV-Export", () => {
    render(<DirectSalesProductBundlerModal />);
    expect(screen.getByText("CSV-EXPORT")).toBeTruthy();
  });

  it("zeigt den Produkttext", () => {
    render(<DirectSalesProductBundlerModal />);
    expect(screen.getByText("PRODUKTTEXT")).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<DirectSalesProductBundlerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
