// @vitest-environment jsdom
/**
 * Tests: MultiAgentWritersRoomModal (WP 62.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiAgentWritersRoomModal } from "./MultiAgentWritersRoomModal";

describe("MultiAgentWritersRoomModal", () => {
  it("rendert die Komponente", () => {
    render(<MultiAgentWritersRoomModal />);
    expect(screen.getByTestId("multi-agent-writers-room-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<MultiAgentWritersRoomModal />);
    expect(screen.getByText(/Multi-Agent Writer's Room/)).toBeTruthy();
  });

  it("zeigt alle vier Personas", () => {
    render(<MultiAgentWritersRoomModal />);
    ["showrunner", "punch-up", "lore-keeper", "empathy-advocate"].forEach((p) => {
      expect(screen.getByTestId(`room-persona-${p}`)).toBeTruthy();
    });
  });

  it("erzeugt das Debattenprotokoll", () => {
    render(<MultiAgentWritersRoomModal />);
    expect(screen.getByTestId("room-statement-showrunner")).toBeTruthy();
    expect(screen.getByTestId("room-statement-empathy-advocate")).toBeTruthy();
  });

  it("nennt die Anliegen im Protokoll", () => {
    render(<MultiAgentWritersRoomModal />);
    const text = screen.getByTestId("room-protocol").textContent ?? "";
    expect(text).toContain("pacing");
    expect(text).toContain("consistency");
  });

  it("zeigt die Zustimmung je Agent", () => {
    render(<MultiAgentWritersRoomModal />);
    expect(screen.getByTestId("room-agreement-showrunner").textContent).toContain("Zustimmung");
  });

  it("zeigt Persona-Details bei Auswahl", () => {
    render(<MultiAgentWritersRoomModal />);
    fireEvent.click(screen.getByTestId("room-persona-showrunner"));
    expect(screen.getByTestId("room-persona-detail")).toBeTruthy();
    expect(screen.getByTestId("room-persona-detail").textContent).toContain("Pacing");
  });

  it("zeigt den typischen Einwand", () => {
    render(<MultiAgentWritersRoomModal />);
    fireEvent.click(screen.getByTestId("room-persona-lore-keeper"));
    expect(screen.getByTestId("room-persona-objection").textContent).toContain("Einwand");
  });

  it("markiert die aktive Persona", () => {
    render(<MultiAgentWritersRoomModal />);
    fireEvent.click(screen.getByTestId("room-persona-punch-up"));
    expect(screen.getByTestId("room-persona-punch-up").getAttribute("aria-pressed")).toBe("true");
  });

  it("schließt das Persona-Detail beim zweiten Klick", () => {
    render(<MultiAgentWritersRoomModal />);
    fireEvent.click(screen.getByTestId("room-persona-showrunner"));
    fireEvent.click(screen.getByTestId("room-persona-showrunner"));
    expect(screen.queryByTestId("room-persona-detail")).toBeNull();
  });

  it("zeigt die Konsens-Synthese", () => {
    render(<MultiAgentWritersRoomModal />);
    expect((screen.getByTestId("room-consensus-text").textContent ?? "").length).toBeGreaterThan(30);
  });

  it("bewertet den Konsens", () => {
    render(<MultiAgentWritersRoomModal />);
    expect((screen.getByTestId("room-consensus-verdict").textContent ?? "").length).toBeGreaterThan(10);
  });

  it("übernimmt ein neues Problem", () => {
    render(<MultiAgentWritersRoomModal />);
    fireEvent.change(screen.getByTestId("room-problem-input"), {
      target: { value: "Der Antagonist wirkt zu schwach" },
    });
    expect(screen.getByTestId("room-consensus-text").textContent).toContain("Antagonist wirkt zu schwach");
  });

  it("zeigt das vollständige Protokoll", () => {
    render(<MultiAgentWritersRoomModal />);
    expect(screen.getByTestId("room-raw-protocol-text").textContent).toContain("KONSENS:");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<MultiAgentWritersRoomModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
