// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FearFrequencySynthesizerModal } from "./FearFrequencySynthesizerModal";

describe("FearFrequencySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    const { getByTestId } = render(<FearFrequencySynthesizerModal />);
    expect(getByTestId("fear-frequency-modal")).toBeDefined();
  });

  it("zeigt Titel an", () => {
    const { getByText } = render(<FearFrequencySynthesizerModal />);
    expect(getByText(/Infraschall- & Angst-Frequenz \(18,9 Hz\)/)).toBeDefined();
  });

  it("zeigt Infraschall-Synthesizer", () => {
    const { getByText } = render(<FearFrequencySynthesizerModal />);
    expect(getByText(/INFRASCHALL-SYNTHESIZER/)).toBeDefined();
  });

  it("zeigt EVP", () => {
    render(<FearFrequencySynthesizerModal />);
    expect(screen.getAllByText(/EVP/).length).toBeGreaterThan(0);
  });

  it("zeigt Grusel-Player", () => {
    const { getByText } = render(<FearFrequencySynthesizerModal />);
    expect(getByText(/GRUSEL-PLAYER/)).toBeDefined();
  });

  it("nutzt keine Hex-Farben", () => {
    const { getByTestId } = render(<FearFrequencySynthesizerModal />);
    const container = getByTestId("fear-frequency-modal");
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
