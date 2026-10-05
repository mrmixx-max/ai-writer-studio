// @vitest-environment jsdom
/**
 * Tests: CulturalAuthenticityAudit (WP 49.1 — Authentizitäts- & Tropen-Audit)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CulturalAuthenticityAudit } from "./CulturalAuthenticityAudit";

describe("CulturalAuthenticityAudit", () => {
  it("rendert das Audit", () => {
    render(<CulturalAuthenticityAudit />);
    expect(screen.getByTestId("cultural-authenticity-audit")).toBeTruthy();
  });

  it("zeigt Text-Eingabe", () => {
    render(<CulturalAuthenticityAudit />);
    expect(screen.getByTestId("audit-text")).toBeTruthy();
  });

  it("Audit-Button funktioniert", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    expect(screen.getByTestId("audit-report")).toBeTruthy();
  });

  it("zeigt Score", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    expect(screen.getByTestId("audit-score").textContent).toContain("/100");
  });

  it("zeigt Tropen bei problematischem Text", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    expect(screen.getByTestId("audit-tropes")).toBeTruthy();
  });

  it("zeigt Sensibilitäten bei problematischem Text", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    expect(screen.getByTestId("audit-sensitivities")).toBeTruthy();
  });

  it("Textänderung aktualisiert Audit", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.change(screen.getByTestId("audit-text"), {
      target: { value: "Ein neutraler Text ohne Probleme." },
    });
    fireEvent.click(screen.getByTestId("audit-run"));
    expect(screen.getByTestId("audit-clean")).toBeTruthy();
  });

  it("Vorschläge sind konstruktiv", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    const suggestions = screen.getAllByText(/→/);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("Severity-Farben korrekt", () => {
    render(<CulturalAuthenticityAudit />);
    fireEvent.click(screen.getByTestId("audit-run"));
    const text = screen.getByTestId("cultural-authenticity-audit").textContent ?? "";
    expect(text).toContain("high");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<CulturalAuthenticityAudit />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
