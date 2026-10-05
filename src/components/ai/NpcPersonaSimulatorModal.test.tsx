// @vitest-environment jsdom
/**
 * Tests: NpcPersonaSimulatorModal (WP 69.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NpcPersonaSimulatorModal } from "./NpcPersonaSimulatorModal";

describe("NpcPersonaSimulatorModal", () => {
  it("rendert die Komponente", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByTestId("npc-persona-simulator-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByText("🗣️ NPC-Verhör-Simulator")).toBeTruthy();
  });

  it("zeigt den Verhör-Zustand", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByTestId("npc-state")).toBeTruthy();
    expect(screen.getByTestId("npc-pressure")).toBeTruthy();
    expect(screen.getByTestId("npc-sympathy")).toBeTruthy();
  });

  it("erhöht den Druck bei Druck-Ausübung", () => {
    render(<NpcPersonaSimulatorModal />);
    const before = Number(screen.getByTestId("npc-pressure").textContent);
    fireEvent.click(screen.getByTestId("npc-kind-pressure"));
    fireEvent.click(screen.getByTestId("npc-submit"));
    const after = Number(screen.getByTestId("npc-pressure").textContent);
    expect(after).toBeGreaterThan(before);
  });

  it("erhöht die Sympathie bei Empathie", () => {
    render(<NpcPersonaSimulatorModal />);
    const before = Number(screen.getByTestId("npc-sympathy").textContent);
    fireEvent.click(screen.getByTestId("npc-kind-empathy"));
    fireEvent.click(screen.getByTestId("npc-submit"));
    const after = Number(screen.getByTestId("npc-sympathy").textContent);
    expect(after).toBeGreaterThan(before);
  });

  it("legt einen Beweis vor", () => {
    render(<NpcPersonaSimulatorModal />);
    fireEvent.click(screen.getByTestId("npc-kind-evidence"));
    fireEvent.change(screen.getByTestId("npc-move-input"), {
      target: { value: "brandbeschleuniger" },
    });
    fireEvent.click(screen.getByTestId("npc-submit"));
    expect(screen.getByTestId("npc-evidence").textContent).toContain("brandbeschleuniger");
  });

  it("erzwingt ein Geständnis mit passendem Beweis", () => {
    render(<NpcPersonaSimulatorModal />);
    fireEvent.click(screen.getByTestId("npc-kind-evidence"));
    fireEvent.change(screen.getByTestId("npc-move-input"), {
      target: { value: "brandbeschleuniger" },
    });
    fireEvent.click(screen.getByTestId("npc-submit"));
    expect(screen.getByTestId("npc-log-0").textContent).toContain("Brandstifter");
    expect(screen.getByTestId("npc-log-0").textContent).toContain("!!");
  });

  it("öffnet ein Geheimnis über einen emotionalen Hebel", () => {
    render(<NpcPersonaSimulatorModal />);
    fireEvent.click(screen.getByTestId("npc-kind-empathy"));
    fireEvent.change(screen.getByTestId("npc-move-input"), {
      target: { value: "Denk an deine Tochter." },
    });
    fireEvent.click(screen.getByTestId("npc-submit"));
    expect(screen.getByTestId("npc-log-0").textContent).toContain("Brandstifter");
  });

  it("protokolliert die Züge", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByTestId("npc-log-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId("npc-submit"));
    expect(screen.getByTestId("npc-log-0")).toBeTruthy();
  });

  it("setzt das Verhör zurück", () => {
    render(<NpcPersonaSimulatorModal />);
    fireEvent.click(screen.getByTestId("npc-submit"));
    fireEvent.click(screen.getByTestId("npc-reset"));
    expect(screen.getByTestId("npc-log-empty")).toBeTruthy();
  });

  it("zeigt das Spielleiter-Dossier", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByTestId("npc-dossier-text").textContent).toContain("SPIELLEITER-DOSSIER");
  });

  it("nennt die Schwellenwerte im Dossier", () => {
    render(<NpcPersonaSimulatorModal />);
    expect(screen.getByTestId("npc-dossier-text").textContent).toContain("Einschüchtern");
  });

  it("reagiert auf Persona-Eingabe", () => {
    render(<NpcPersonaSimulatorModal />);
    const custom = {
      name: "Die Spionin",
      alignment: "chaotisch",
      motivation: "Sie will den Krieg verhindern.",
      baseResistance: 60,
      secrets: [],
      deflection: "Kein Kommentar.",
    };
    fireEvent.change(screen.getByTestId("npc-persona-input"), {
      target: { value: JSON.stringify(custom) },
    });
    expect(screen.getByTestId("npc-dossier-text").textContent).toContain("Die Spionin");
  });

  it("kommt mit ungültigem JSON zurecht", () => {
    render(<NpcPersonaSimulatorModal />);
    fireEvent.change(screen.getByTestId("npc-persona-input"), {
      target: { value: "kein json" },
    });
    expect(screen.getByTestId("npc-dossier-text").textContent).toContain("SPIELLEITER");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<NpcPersonaSimulatorModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
