// @vitest-environment jsdom
/** Tests: InterrogationDeceptionLabModal (WP 115.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterrogationDeceptionLabModal } from "./InterrogationDeceptionLabModal";

describe("InterrogationDeceptionLabModal", () => {
  it("rendert ohne Fehler", () => {
    render(<InterrogationDeceptionLabModal />);
    expect(screen.getByTestId("interrogation-deception-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<InterrogationDeceptionLabModal />);
    expect(screen.getByText(/Verhör-Taktik & Täuschungs-Labor/)).toBeInTheDocument();
  });

  it("zeigt Vernehmungsstrategien", () => {
    render(<InterrogationDeceptionLabModal />);
    expect(screen.getByText(/VERNEHMUNGSSTRATEGIEN/)).toBeInTheDocument();
  });

  it("zeigt Stress- & Lügen-Indikatoren", () => {
    render(<InterrogationDeceptionLabModal />);
    expect(screen.getByText(/STRESS- & LÜGEN-INDIKATORE/)).toBeInTheDocument();
  });

  it("zeigt Verhör-Dialog", () => {
    render(<InterrogationDeceptionLabModal />);
    expect(screen.getByText(/VERHÖR-DIALOG/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<InterrogationDeceptionLabModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
