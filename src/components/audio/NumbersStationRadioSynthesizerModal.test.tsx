// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NumbersStationRadioSynthesizerModal } from "./NumbersStationRadioSynthesizerModal";

describe("NumbersStationRadioSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<NumbersStationRadioSynthesizerModal />);
    expect(screen.getByTestId("numbers-station-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<NumbersStationRadioSynthesizerModal />);
    expect(screen.getByText(/Kurzwellen-Zahlensender-Synthesizer/)).toBeInTheDocument();
  });

  it("zeigt Kurzwellen-Atmosphäre", () => {
    render(<NumbersStationRadioSynthesizerModal />);
    expect(screen.getByText(/KURZWELLEN-ATMOSPHÄRE/)).toBeInTheDocument();
  });

  it("zeigt Zahlensender", () => {
    render(<NumbersStationRadioSynthesizerModal />);
    expect(screen.getByText(/ZAHLENSENDER/)).toBeInTheDocument();
  });

  it("zeigt Radio-Player", () => {
    render(<NumbersStationRadioSynthesizerModal />);
    expect(screen.getByText(/RADIO-PLAYER/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<NumbersStationRadioSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
