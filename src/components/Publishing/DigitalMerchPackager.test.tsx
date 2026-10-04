// @vitest-environment jsdom
/**
 * Tests: DigitalMerchPackager (WP 47.2 — Digitales Fan-Merch & Lesezeichen-Studio)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DigitalMerchPackager } from "./DigitalMerchPackager";

describe("DigitalMerchPackager", () => {
  it("rendert das Studio", () => {
    render(<DigitalMerchPackager />);
    expect(screen.getByTestId("digital-merch-packager")).toBeTruthy();
  });

  it("zeigt Zitat-Auswahl", () => {
    render(<DigitalMerchPackager />);
    expect(screen.getByTestId("merch-quotes")).toBeTruthy();
    expect(screen.getByTestId("merch-quote-0")).toBeTruthy();
  });

  it("zeigt Lesezeichen-Vorschau", () => {
    render(<DigitalMerchPackager />);
    expect(screen.getByTestId("merch-bookmark")).toBeTruthy();
    expect(screen.getByTestId("merch-bookmark-preview")).toBeTruthy();
  });

  it("zeigt Wallpaper-Vorschau", () => {
    render(<DigitalMerchPackager />);
    expect(screen.getByTestId("merch-wallpaper")).toBeTruthy();
    expect(screen.getByTestId("merch-wallpaper-preview")).toBeTruthy();
  });

  it("Schriftart änderbar", () => {
    render(<DigitalMerchPackager />);
    fireEvent.change(screen.getByTestId("merch-font"), { target: { value: "sans-serif" } });
    expect(screen.getByTestId("merch-bookmark-preview")).toBeTruthy();
  });

  it("Rahmen-Stil änderbar", () => {
    render(<DigitalMerchPackager />);
    fireEvent.change(screen.getByTestId("merch-frame"), { target: { value: "minimal" } });
    expect(screen.getByTestId("merch-bookmark-preview")).toBeTruthy();
  });

  it("Wallpaper-Größe umschaltbar", () => {
    render(<DigitalMerchPackager />);
    fireEvent.click(screen.getByTestId("merch-wallpaper-size"));
    expect(screen.getByTestId("merch-wallpaper").textContent).toContain("1440×3200");
  });

  it("Zitat-Auswahl ändert Vorschau", () => {
    render(<DigitalMerchPackager />);
    fireEvent.click(screen.getByTestId("merch-quote-1"));
    expect(screen.getByTestId("merch-bookmark-preview")).toBeTruthy();
  });

  it("Bundle-Erstellung zeigt Ergebnis", () => {
    render(<DigitalMerchPackager />);
    fireEvent.click(screen.getByTestId("merch-bundle-create"));
    expect(screen.getByTestId("merch-bundle-result")).toBeTruthy();
  });

  it("Bundle enthält 3 Dateien", () => {
    render(<DigitalMerchPackager />);
    fireEvent.click(screen.getByTestId("merch-bundle-create"));
    expect(screen.getByTestId("merch-bundle-result").textContent).toContain("4 Dateien");
  });

  it("Bundle zeigt Dankeskarte", () => {
    render(<DigitalMerchPackager />);
    fireEvent.click(screen.getByTestId("merch-bundle-create"));
    expect(screen.getByTestId("merch-bundle-result").textContent).toContain("Danke");
  });

  it("Dankesnachricht änderbar", () => {
    render(<DigitalMerchPackager />);
    fireEvent.change(screen.getByTestId("merch-bundle-message"), {
      target: { value: "Vielen Dank!" },
    });
    fireEvent.click(screen.getByTestId("merch-bundle-create"));
    expect(screen.getByTestId("merch-bundle-result").textContent).toContain("Vielen Dank!");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<DigitalMerchPackager />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
