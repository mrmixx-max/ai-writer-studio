// @vitest-environment jsdom
/**
 * Tests: EldritchSensoryWeaverModal (WP 73.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EldritchSensoryWeaverModal } from "./EldritchSensoryWeaverModal";

describe("EldritchSensoryWeaverModal", () => {
  it("rendert die Komponente", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-sensory-weaver-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByText("🐙 Eldritch- & Alien-Sensorik-Weaver")).toBeTruthy();
  });

  it("zeigt den Schreckens-Index", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-dread")).toBeTruthy();
    expect(screen.getByTestId("eldritch-dread-value").textContent).toContain("%");
  });

  it("zeigt sensorische Einträge", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-entries")).toBeTruthy();
  });

  it("zeigt alle 5 Kategorien", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-entry-sound")).toBeTruthy();
    expect(screen.getByTestId("eldritch-entry-smell")).toBeTruthy();
    expect(screen.getByTestId("eldritch-entry-touch")).toBeTruthy();
    expect(screen.getByTestId("eldritch-entry-sight")).toBeTruthy();
    expect(screen.getByTestId("eldritch-entry-taste")).toBeTruthy();
  });

  it("zeigt intensivsten Eintrag", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-most-intense")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<EldritchSensoryWeaverModal />);
    fireEvent.change(screen.getByTestId("eldritch-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("eldritch-entries")).toBeTruthy();
  });

  it("reagiert auf Seed-Eingabe", () => {
    render(<EldritchSensoryWeaverModal />);
    fireEvent.change(screen.getByTestId("eldritch-seed-input"), { target: { value: "99" } });
    expect(screen.getByTestId("eldritch-entries")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<EldritchSensoryWeaverModal />);
    expect(screen.getByTestId("eldritch-text").textContent).toContain("Gehör");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<EldritchSensoryWeaverModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
