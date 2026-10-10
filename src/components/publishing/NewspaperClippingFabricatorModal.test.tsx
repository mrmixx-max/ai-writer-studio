// @vitest-environment jsdom
// NewspaperClippingFabricatorModal – UI-Tests (Meilenstein 62.0 / v7.4.0)
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NewspaperClippingFabricatorModal } from "./NewspaperClippingFabricatorModal";

describe("NewspaperClippingFabricatorModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<NewspaperClippingFabricatorModal />);
    expect(getByTestId("newspaper-clipping-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    const { getByText } = render(<NewspaperClippingFabricatorModal />);
    expect(getByText(/Vintage-Zeitungsausschnitt-Studio/)).toBeTruthy();
  });

  it("zeigt ZEITUNGSSATZ", () => {
    const { getByText } = render(<NewspaperClippingFabricatorModal />);
    expect(getByText(/ZEITUNGSSATZ/)).toBeTruthy();
  });

  it("zeigt VINTAGE-ARTEFAKTE", () => {
    const { getByText } = render(<NewspaperClippingFabricatorModal />);
    expect(getByText(/VINTAGE-ARTEFAKTE/)).toBeTruthy();
  });

  it("zeigt PDF-EXPORT", () => {
    const { getByText } = render(<NewspaperClippingFabricatorModal />);
    expect(getByText(/PDF-EXPORT/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<NewspaperClippingFabricatorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
