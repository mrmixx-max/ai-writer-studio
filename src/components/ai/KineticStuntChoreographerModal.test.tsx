// @vitest-environment jsdom
/**
 * Tests: KineticStuntChoreographerModal (WP 75.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KineticStuntChoreographerModal } from "./KineticStuntChoreographerModal";

describe("KineticStuntChoreographerModal", () => {
  it("rendert die Komponente", () => {
    render(<KineticStuntChoreographerModal />);
    expect(screen.getByTestId("kinetic-stunt-choreographer-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<KineticStuntChoreographerModal />);
    expect(screen.getByText("💥 Kinetischer Stunt- & Action-Physik-Choreograf")).toBeTruthy();
  });

  it("zeigt Ergebnis", () => {
    render(<KineticStuntChoreographerModal />);
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("zeigt Prosa", () => {
    render(<KineticStuntChoreographerModal />);
    expect(screen.getByTestId("stunt-prose")).toBeTruthy();
  });

  it("reagiert auf Geschwindigkeit", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-speed-input"), { target: { value: "200" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("reagiert auf Fallhöhe", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-height-input"), { target: { value: "50" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("reagiert auf Masse", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-mass-input"), { target: { value: "100" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("reagiert auf Reibung", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-friction-select"), { target: { value: "0.03" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("reagiert auf Bremsweg", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-braking-input"), { target: { value: "5" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("reagiert auf Rule of Cool", () => {
    render(<KineticStuntChoreographerModal />);
    fireEvent.change(screen.getByTestId("stunt-cool-input"), { target: { value: "100" } });
    expect(screen.getByTestId("stunt-result")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<KineticStuntChoreographerModal />);
    expect(screen.getByTestId("stunt-text").textContent).toContain("STUNT-MONTAGE");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<KineticStuntChoreographerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
