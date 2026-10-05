// @vitest-environment jsdom
/**
 * Tests: SubtextConflictInjectorModal (WP 60.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubtextConflictInjectorModal } from "./SubtextConflictInjectorModal";

describe("SubtextConflictInjectorModal", () => {
  it("rendert die Komponente", () => {
    render(<SubtextConflictInjectorModal />);
    expect(screen.getByTestId("subtext-conflict-injector-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<SubtextConflictInjectorModal />);
    expect(screen.getByText("🎭 Subtext- & Konflikt-Injektor")).toBeTruthy();
  });

  it("zeigt alle fünf Agenden", () => {
    render(<SubtextConflictInjectorModal />);
    ["knows-lie", "secret-love", "jealousy", "guilt", "distrust"].forEach((a) => {
      expect(screen.getByTestId(`subtext-agenda-${a}`)).toBeTruthy();
    });
  });

  it("wechselt die Agenda", () => {
    render(<SubtextConflictInjectorModal />);
    const before = screen.getByTestId("subtext-output-text").textContent;
    fireEvent.click(screen.getByTestId("subtext-agenda-jealousy"));
    expect(screen.getByTestId("subtext-output-text").textContent).not.toBe(before);
  });

  it("markiert die aktive Agenda", () => {
    render(<SubtextConflictInjectorModal />);
    fireEvent.click(screen.getByTestId("subtext-agenda-guilt"));
    expect(screen.getByTestId("subtext-agenda-guilt").getAttribute("aria-pressed")).toBe("true");
  });

  it("zeigt die Agenda im Header", () => {
    render(<SubtextConflictInjectorModal />);
    fireEvent.click(screen.getByTestId("subtext-agenda-guilt"));
    expect(screen.getByTestId("subtext-output").textContent).toContain("GEHEIME SCHULD");
  });

  it("erhält den Originaltext im Kern", () => {
    render(<SubtextConflictInjectorModal />);
    expect(screen.getByTestId("subtext-output-text").textContent).toContain(
      "Ich war die ganze Nacht hier",
    );
  });

  it("reichert nur die Trägerfigur an", () => {
    render(<SubtextConflictInjectorModal />);
    // Mira ist Trägerin (Index 0 und 2), Kessler nicht.
    expect(screen.getByTestId("subtext-flag-0")).toBeTruthy();
    expect(screen.queryByTestId("subtext-flag-1")).toBeNull();
  });

  it("zeigt verräterische Körpersprache", () => {
    render(<SubtextConflictInjectorModal />);
    expect((screen.getByTestId("subtext-reaction").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("zeigt die Beiträge im Detail", () => {
    render(<SubtextConflictInjectorModal />);
    expect(screen.getByTestId("subtext-line-0")).toBeTruthy();
    expect(screen.getByTestId("subtext-line-3")).toBeTruthy();
  });

  it("zeigt die Subtext-Dichte", () => {
    render(<SubtextConflictInjectorModal />);
    expect(screen.getByTestId("subtext-density")).toBeTruthy();
    expect(screen.getByTestId("subtext-density-value")).toBeTruthy();
  });

  it("bewertet die Dichte", () => {
    render(<SubtextConflictInjectorModal />);
    const verdict = screen.getByTestId("subtext-density-verdict").textContent ?? "";
    expect(verdict.length).toBeGreaterThan(10);
  });

  it("übernimmt einen neuen Dialog", () => {
    render(<SubtextConflictInjectorModal />);
    fireEvent.change(screen.getByTestId("subtext-dialogue-input"), {
      target: { value: "Anna: Ich habe nichts gesehen.\nBert: Sicher." },
    });
    expect(screen.getByTestId("subtext-output-text").textContent).toContain("nichts gesehen");
  });

  it("übernimmt eine neue Trägerfigur", () => {
    render(<SubtextConflictInjectorModal />);
    fireEvent.change(screen.getByTestId("subtext-carrier-input"), {
      target: { value: "Kessler" },
    });
    // Jetzt ist Kessler angereichert (Index 1), Mira nicht mehr.
    expect(screen.getByTestId("subtext-flag-1")).toBeTruthy();
    expect(screen.queryByTestId("subtext-flag-0")).toBeNull();
  });

  it("kommt mit leerem Dialog zurecht", () => {
    render(<SubtextConflictInjectorModal initialDialogue="" />);
    expect(screen.getByTestId("subtext-output-text").textContent).toBe("—");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<SubtextConflictInjectorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
