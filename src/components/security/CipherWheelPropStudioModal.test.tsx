// @vitest-environment jsdom
/** Tests: CipherWheelPropStudioModal (Meilenstein 62.0 UI, v7.4.0) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CipherWheelPropStudioModal } from "./CipherWheelPropStudioModal";

describe("CipherWheelPropStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CipherWheelPropStudioModal />);
    expect(screen.getByTestId("cipher-wheel-modal")).toBeInTheDocument();
  });

  it("zeigt den Titel", () => {
    render(<CipherWheelPropStudioModal />);
    expect(
      screen.getByText(/Drehscheiben-Chiffre & Cardan-Lochmaske/)
    ).toBeInTheDocument();
  });

  it("zeigt den Abschnitt CHIFFRIER-DREHSCHEIBE", () => {
    render(<CipherWheelPropStudioModal />);
    expect(screen.getByText(/CHIFFRIER-DREHSCHEIBE/)).toBeInTheDocument();
    expect(screen.getByTestId("summary-wheel")).toBeInTheDocument();
  });

  it("zeigt den Abschnitt CARDAN-GITTER", () => {
    render(<CipherWheelPropStudioModal />);
    expect(screen.getByText(/CARDAN-GITTER/)).toBeInTheDocument();
    expect(screen.getByTestId("summary-grille")).toBeInTheDocument();
  });

  it("zeigt den Abschnitt BASTELANLEITUNG", () => {
    render(<CipherWheelPropStudioModal />);
    expect(screen.getByText(/BASTELANLEITUNG/)).toBeInTheDocument();
    expect(screen.getByTestId("summary-assembly")).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CipherWheelPropStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
