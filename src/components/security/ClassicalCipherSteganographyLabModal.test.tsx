// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassicalCipherSteganographyLabModal } from "./ClassicalCipherSteganographyLabModal";

describe("ClassicalCipherSteganographyLabModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ClassicalCipherSteganographyLabModal />);
    expect(screen.getByTestId("cipher-steganography-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ClassicalCipherSteganographyLabModal />);
    expect(screen.getByText(/Klassisches Chiffrier- & Steganografie-Labor/)).toBeInTheDocument();
  });

  it("zeigt One-Time-Pad", () => {
    render(<ClassicalCipherSteganographyLabModal />);
    expect(screen.getByText(/ONE-TIME-PAD/)).toBeInTheDocument();
  });

  it("zeigt Buch-Chiffre", () => {
    render(<ClassicalCipherSteganographyLabModal />);
    expect(screen.getByText(/BUCH-CHIFFRE/)).toBeInTheDocument();
  });

  it("zeigt Steganografie", () => {
    render(<ClassicalCipherSteganographyLabModal />);
    expect(screen.getByText(/STEGANOGRAFIE/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<ClassicalCipherSteganographyLabModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
