// @vitest-environment jsdom
/**
 * Tests: EtymologyTimelineGuardModal (WP 76.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EtymologyTimelineGuardModal } from "./EtymologyTimelineGuardModal";

describe("EtymologyTimelineGuardModal", () => {
  it("rendert die Komponente", () => {
    render(<EtymologyTimelineGuardModal />);
    expect(screen.getByTestId("etymology-timeline-guard-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<EtymologyTimelineGuardModal />);
    expect(screen.getByText("📚 Historischer Etymologie- & Epochen-Wächter")).toBeTruthy();
  });

  it("zeigt Epochen-Auswahl", () => {
    render(<EtymologyTimelineGuardModal />);
    expect(screen.getByTestId("etymology-epoch-medieval")).toBeTruthy();
    expect(screen.getByTestId("etymology-epoch-renaissance")).toBeTruthy();
  });

  it("zeigt Anachronismen", () => {
    render(<EtymologyTimelineGuardModal />);
    expect(screen.getByTestId("etymology-anachronisms")).toBeTruthy();
  });

  it("wechselt zu Renaissance", () => {
    render(<EtymologyTimelineGuardModal />);
    fireEvent.click(screen.getByTestId("etymology-epoch-renaissance"));
    expect(screen.getByTestId("etymology-anachronisms")).toBeTruthy();
  });

  it("wechselt zu Barock", () => {
    render(<EtymologyTimelineGuardModal />);
    fireEvent.click(screen.getByTestId("etymology-epoch-baroque"));
    expect(screen.getByTestId("etymology-anachronisms")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<EtymologyTimelineGuardModal />);
    fireEvent.change(screen.getByTestId("etymology-text-input"), {
      target: { value: "Der Ritter ritt zum Schloss." },
    });
    expect(screen.getByTestId("etymology-anachronisms")).toBeTruthy();
  });

  it("zeigt Bericht", () => {
    render(<EtymologyTimelineGuardModal />);
    expect(screen.getByTestId("etymology-report-text").textContent).toContain("ETYMOLOGIE-WÄCHTER");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<EtymologyTimelineGuardModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
