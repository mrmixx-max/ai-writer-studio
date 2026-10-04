// @vitest-environment jsdom
/**
 * Tests: LiveAudienceTelemetry (WP 48.1 — Live-Bühnen-Dashboard)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveAudienceTelemetry } from "./LiveAudienceTelemetry";

describe("LiveAudienceTelemetry", () => {
  it("rendert das Dashboard", () => {
    render(<LiveAudienceTelemetry />);
    expect(screen.getByTestId("live-audience-telemetry")).toBeTruthy();
  });

  it("zeigt Autor und Event", () => {
    render(<LiveAudienceTelemetry authorName="Test Autor" eventName="Test Event" />);
    const text = screen.getByTestId("live-audience-telemetry").textContent ?? "";
    expect(text).toContain("Test Autor");
    expect(text).toContain("Test Event");
  });

  it("zeigt Akustik-Pegelwächter", () => {
    render(<LiveAudienceTelemetry />);
    expect(screen.getByTestId("telemetry-audio")).toBeTruthy();
    expect(screen.getByTestId("telemetry-decibels")).toBeTruthy();
  });

  it("dB-Wert änderbar", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.change(screen.getByTestId("telemetry-decibels"), { target: { value: "30" } });
    expect(screen.getByTestId("telemetry-db-value").textContent).toContain("30");
  });

  it("Audio-Status zeigt Meldung", () => {
    render(<LiveAudienceTelemetry />);
    expect(screen.getByTestId("telemetry-audio-status").textContent).toContain("Lautstärke");
  });

  it("Messen-Button funktioniert", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.click(screen.getByTestId("telemetry-measure"));
    expect(screen.getByTestId("telemetry-audio-status")).toBeTruthy();
  });

  it("Q&A-Eingabe funktioniert", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.change(screen.getByTestId("telemetry-question-input"), {
      target: { value: "Wie endet das Buch?" },
    });
    fireEvent.click(screen.getByTestId("telemetry-question-submit"));
    expect(screen.getByTestId("telemetry-top-questions")).toBeTruthy();
  });

  it("Q&A-Frage erscheint in Top-Fragen", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.change(screen.getByTestId("telemetry-question-input"), {
      target: { value: "Wie endet das Buch?" },
    });
    fireEvent.click(screen.getByTestId("telemetry-question-submit"));
    expect(screen.getByTestId("telemetry-top-questions").textContent).toContain("Wie endet das Buch?");
  });

  it("QR-Code-Generierung funktioniert", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.click(screen.getByTestId("telemetry-qr-generate"));
    expect(screen.getByTestId("telemetry-qr-link")).toBeTruthy();
  });

  it("QR-Link enthält Host", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.click(screen.getByTestId("telemetry-qr-generate"));
    expect(screen.getByTestId("telemetry-qr-link").textContent).toContain("http");
  });

  it("Senden ohne Text deaktiviert", () => {
    render(<LiveAudienceTelemetry />);
    expect((screen.getByTestId("telemetry-question-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Senden mit Text aktiviert", () => {
    render(<LiveAudienceTelemetry />);
    fireEvent.change(screen.getByTestId("telemetry-question-input"), {
      target: { value: "Frage" },
    });
    expect((screen.getByTestId("telemetry-question-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<LiveAudienceTelemetry />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
