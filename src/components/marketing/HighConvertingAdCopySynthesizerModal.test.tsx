// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HighConvertingAdCopySynthesizerModal } from "./HighConvertingAdCopySynthesizerModal";

describe("HighConvertingAdCopySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<HighConvertingAdCopySynthesizerModal />);
    expect(getByTestId("ad-copy-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<HighConvertingAdCopySynthesizerModal />);
    expect(
      screen.getByText("📣 Hochkonvertierender Ad- & Blurb-Synthesizer")
    ).toBeTruthy();
  });

  it("zeigt KLAPPENTEXT-ARCHITEKTUR", () => {
    render(<HighConvertingAdCopySynthesizerModal />);
    expect(screen.getByText(/KLAPPENTEXT-ARCHITEKTUR/)).toBeTruthy();
  });

  it("zeigt META-ADS", () => {
    render(<HighConvertingAdCopySynthesizerModal />);
    expect(screen.getByText(/META-ADS/)).toBeTruthy();
  });

  it("zeigt AMAZON-ADS", () => {
    render(<HighConvertingAdCopySynthesizerModal />);
    expect(screen.getByText(/AMAZON-ADS/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<HighConvertingAdCopySynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
