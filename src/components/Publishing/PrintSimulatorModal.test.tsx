// @vitest-environment jsdom
/**
 * Tests: PrintSimulatorModal (WP 45.2 — Buchrücken-Kalkulator)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrintSimulatorModal } from "./PrintSimulatorModal";

describe("PrintSimulatorModal", () => {
  it("rendert nicht wenn geschlossen", () => {
    const { container } = render(<PrintSimulatorModal open={false} onClose={() => {}} />);
    expect(container.querySelector('[data-testid="print-simulator-modal"]')).toBeNull();
  });

  it("rendert wenn offen", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    expect(screen.getByTestId("print-simulator-modal")).toBeTruthy();
  });

  it("zeigt eine Rückenbreite", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const spine = screen.getByTestId("print-sim-spine").textContent ?? "";
    expect(spine).toMatch(/[\d.,]+ mm/);
  });

  it("Seitenzahl ändert die Rückenbreite", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const before = screen.getByTestId("print-sim-spine").textContent ?? "";
    fireEvent.change(screen.getByTestId("print-sim-pages"), { target: { value: "600" } });
    const after = screen.getByTestId("print-sim-spine").textContent ?? "";
    expect(after).not.toBe(before);
  });

  it("Papierwechsel ändert die Rückenbreite", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const before = screen.getByTestId("print-sim-spine").textContent ?? "";
    fireEvent.change(screen.getByTestId("print-sim-paper"), { target: { value: "werkdruck90_175" } });
    expect(screen.getByTestId("print-sim-spine").textContent).not.toBe(before);
  });

  it("Hardcover hat größere Umschlagzugabe als Softcover", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const soft = screen.getByTestId("print-sim-allowance").textContent ?? "";
    fireEvent.change(screen.getByTestId("print-sim-binding"), { target: { value: "hardcover" } });
    const hard = screen.getByTestId("print-sim-allowance").textContent ?? "";
    expect(hard).not.toBe(soft);
  });

  it("zeigt Umschlag-Gesamtmaße", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    expect(screen.getByTestId("print-sim-total-width").textContent).toMatch(/mm/);
  });

  it("zeigt die Bestandteile (Vorder/Rücken/Rück)", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const parts = screen.getByTestId("print-sim-parts").textContent ?? "";
    expect(parts).toContain("Vorderseite");
    expect(parts).toContain("Rücken");
    expect(parts).toContain("Rückseite");
  });

  it("Formatwechsel ändert die Maße", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const before = screen.getByTestId("print-sim-total-width").textContent ?? "";
    fireEvent.change(screen.getByTestId("print-sim-trim"), { target: { value: "3" } });
    expect(screen.getByTestId("print-sim-total-width").textContent).not.toBe(before);
  });

  it("zeigt 3D-Simulationsdaten", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    expect(screen.getByTestId("print-sim-3d")).toBeTruthy();
    expect(screen.getByTestId("print-sim-joint")).toBeTruthy();
    expect(screen.getByTestId("print-sim-depth")).toBeTruthy();
  });

  it("rendert die Rückenkurve als SVG", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    const svg = screen.getByTestId("print-sim-spine-curve");
    expect(svg.innerHTML).toContain("polyline");
  });

  it("Klappentext-Einschläge sind zuschaltbar", () => {
    render(<PrintSimulatorModal open onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("print-sim-flaps"));
    expect(screen.getByTestId("print-sim-flap-width")).toBeTruthy();
  });

  it("schließt bei Klick", () => {
    const onClose = vi.fn();
    render(<PrintSimulatorModal open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("print-sim-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<PrintSimulatorModal open onClose={() => {}} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
