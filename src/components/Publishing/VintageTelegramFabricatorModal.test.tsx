// @vitest-environment jsdom
// VintageTelegramFabricatorModal – UI-Tests (Meilenstein 62.0 / v7.4.0)
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VintageTelegramFabricatorModal } from "./VintageTelegramFabricatorModal";

describe("VintageTelegramFabricatorModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<VintageTelegramFabricatorModal />);
    expect(getByTestId("telegram-fabricator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    const { getByText } = render(<VintageTelegramFabricatorModal />);
    expect(
      getByText(/Historischer Telegramm- & Telex-Fabrikator/)
    ).toBeTruthy();
  });

  it("zeigt EPOCHE", () => {
    const { getByText } = render(<VintageTelegramFabricatorModal />);
    expect(getByText(/EPOCHE/)).toBeTruthy();
  });

  it("zeigt TELEGRAMM", () => {
    const { getByText } = render(<VintageTelegramFabricatorModal />);
    expect(getByText(/TELEGRAMM/)).toBeTruthy();
  });

  it("zeigt 300-DPI-EXPORT", () => {
    const { getByText } = render(<VintageTelegramFabricatorModal />);
    expect(getByText(/300-DPI-EXPORT/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<VintageTelegramFabricatorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
