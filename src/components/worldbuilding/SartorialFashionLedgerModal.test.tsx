// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SartorialFashionLedgerModal } from "./SartorialFashionLedgerModal";

describe("SartorialFashionLedgerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SartorialFashionLedgerModal />);
    expect(screen.getByTestId("sartorial-fashion-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SartorialFashionLedgerModal />);
    expect(screen.getByText(/Kleiderordnungs- & Textil-Semiotik-Hauptbuch/)).toBeInTheDocument();
  });

  it("zeigt Kleiderordnungs-Prüfer", () => {
    render(<SartorialFashionLedgerModal />);
    expect(screen.getByText(/KLEIDERORDNUNGS-PRÜFER/)).toBeInTheDocument();
  });

  it("zeigt Stoff-Prosa", () => {
    render(<SartorialFashionLedgerModal />);
    expect(screen.getByText(/STOFF-PROSA/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<SartorialFashionLedgerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
