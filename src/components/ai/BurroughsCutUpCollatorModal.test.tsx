// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BurroughsCutUpCollatorModal } from "./BurroughsCutUpCollatorModal";

describe("BurroughsCutUpCollatorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<BurroughsCutUpCollatorModal />);
    expect(screen.getByTestId("burroughs-cutup-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<BurroughsCutUpCollatorModal />);
    expect(
      screen.getByText(/Burroughs Cut-Up-Montage & Kollagen-Studio/)
    ).toBeInTheDocument();
  });

  it("zeigt Schnitt", () => {
    render(<BurroughsCutUpCollatorModal />);
    expect(screen.getByText(/SCHNITT/)).toBeInTheDocument();
  });

  it("zeigt Politur", () => {
    render(<BurroughsCutUpCollatorModal />);
    expect(screen.getByText(/POLITUR/)).toBeInTheDocument();
  });

  it("zeigt Kollage", () => {
    render(<BurroughsCutUpCollatorModal />);
    expect(screen.getByText(/KOLLAGE/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<BurroughsCutUpCollatorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
