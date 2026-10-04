// @vitest-environment jsdom
/**
 * Tests: MasterpieceSealModal (WP 49.2 — 6.000-Tests-Meisterwerk-Siegel)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MasterpieceSealModal } from "./MasterpieceSealModal";

describe("MasterpieceSealModal", () => {
  it("rendert nicht wenn geschlossen", () => {
    const { container } = render(
      <MasterpieceSealModal open={false} onClose={() => {}} testCount={5927} version="3.3.0" />,
    );
    expect(container.querySelector('[data-testid="masterpiece-seal-modal"]')).toBeNull();
  });

  it("rendert wenn offen", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    expect(screen.getByTestId("masterpiece-seal-modal")).toBeTruthy();
  });

  it("Health-Scan startbar", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-scan-run"));
    expect(screen.getByTestId("seal-health-status")).toBeTruthy();
  });

  it("Health-Scan zeigt Tabellen", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-scan-run"));
    expect(screen.getByTestId("seal-table-chapters")).toBeTruthy();
  });

  it("Health-Scan zeigt i18n", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-scan-run"));
    expect(screen.getByTestId("seal-health-i18n").textContent).toContain("%");
  });

  it("Health-Scan zeigt Latenz", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-scan-run"));
    expect(screen.getByTestId("seal-health-latency").textContent).toContain("ms");
  });

  it("Siegel-Generierung funktioniert", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-certificate")).toBeTruthy();
  });

  it("Zertifikat zeigt TestCount", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-cert-tests").textContent).toContain("5927");
  });

  it("Zertifikat zeigt Version", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-cert-version").textContent).toContain("3.3.0");
  });

  it("Zertifikat zeigt Hash", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-cert-hash").textContent).toContain("Hash");
  });

  it("Zertifikat zeigt Signatur", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-cert-signature").textContent).toContain("Signatur");
  });

  it("Verifikation erfolgreich", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-cert-verified").textContent).toContain("Verifiziert");
  });

  it("SVG-Siegel wird gerendert", () => {
    render(<MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-generate"));
    expect(screen.getByTestId("seal-svg")).toBeTruthy();
  });

  it("schließt bei Klick", () => {
    const onClose = vi.fn();
    render(<MasterpieceSealModal open onClose={onClose} testCount={5927} version="3.3.0" />);
    fireEvent.click(screen.getByTestId("seal-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(
      <MasterpieceSealModal open onClose={() => {}} testCount={5927} version="3.3.0" />,
    );
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
