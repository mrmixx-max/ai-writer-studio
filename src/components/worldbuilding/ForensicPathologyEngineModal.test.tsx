// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForensicPathologyEngineModal } from "./ForensicPathologyEngineModal";

describe("ForensicPathologyEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ForensicPathologyEngineModal />);
    expect(screen.getByTestId("forensic-pathology-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<ForensicPathologyEngineModal />);
    expect(screen.getByText(/Rechtsmedizinische Pathologie & Todeszeit-Rechner/)).toBeInTheDocument();
  });

  it("zeigt Todeszeit-Kalkulator", () => {
    render(<ForensicPathologyEngineModal />);
    expect(screen.getByText(/TODESZEIT-KALKULATOR/)).toBeInTheDocument();
  });

  it("zeigt Totenstarre & Totenflecke", () => {
    render(<ForensicPathologyEngineModal />);
    expect(screen.getByText(/TOTENSTARRE & TOTENFLECKE/)).toBeInTheDocument();
  });

  it("zeigt Sektionsbericht", () => {
    render(<ForensicPathologyEngineModal />);
    expect(screen.getByText(/SEKTIONSBERICHT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<ForensicPathologyEngineModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
