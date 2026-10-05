// @vitest-environment jsdom
/**
 * Tests: NarrativeStateMachineModal (WP 68.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NarrativeStateMachineModal } from "./NarrativeStateMachineModal";

describe("NarrativeStateMachineModal", () => {
  it("rendert die Komponente", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("narrative-state-machine-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByText("🕸️ Narrative State Machine")).toBeTruthy();
  });

  it("führt die Sackgassen-Prüfung durch", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-audit")).toBeTruthy();
    expect(screen.getByTestId("nsm-valid").textContent).toContain("konsistent");
  });

  it("meldet Sackgassen", () => {
    const bad = {
      start: "a",
      initialFlags: {},
      nodes: [
        { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "x", target: "sack", conditions: [], modifiers: {} }] },
        { id: "sack", title: "Sack", isEnding: false, endingConditions: [], transitions: [] },
      ],
    };
    render(<NarrativeStateMachineModal initialGraph={bad} />);
    expect(screen.getByTestId("nsm-dead-ends")).toBeTruthy();
    expect(screen.getByTestId("nsm-valid").textContent).toContain("Logikfehler");
  });

  it("meldet kaputte Ziele", () => {
    const bad = {
      start: "a",
      initialFlags: {},
      nodes: [
        { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "x", target: "nirgendwo", conditions: [], modifiers: {} }] },
      ],
    };
    render(<NarrativeStateMachineModal initialGraph={bad} />);
    expect(screen.getByTestId("nsm-broken-targets")).toBeTruthy();
  });

  it("zeigt die Enden-Matrix", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-endings")).toBeTruthy();
    expect(screen.getByTestId("nsm-ending-helden-ende")).toBeTruthy();
  });

  it("nennt die Enden-Arten", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-ending-helden-ende").textContent).toContain("gutes-ende");
  });

  it("zeigt Bedingungen der Enden", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-ending-helden-ende").textContent).toContain("hat_gesiegt");
  });

  it("simuliert einen Pfad", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-visited").textContent).toContain("start");
    expect(screen.getByTestId("nsm-visited").textContent).toContain("helden-ende");
  });

  it("meldet ein erreichtes Ende", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-simulation-status").textContent).toContain("Ende erreicht");
  });

  it("reagiert auf Pfad-Eingabe", () => {
    render(<NarrativeStateMachineModal />);
    fireEvent.change(screen.getByTestId("nsm-path-input"), {
      target: { value: "Fliehen, Weiter" },
    });
    expect(screen.getByTestId("nsm-visited").textContent).toContain("trauriges-ende");
  });

  it("meldet unbekannte Optionen", () => {
    render(<NarrativeStateMachineModal />);
    fireEvent.change(screen.getByTestId("nsm-path-input"), {
      target: { value: "Tanzen" },
    });
    expect(screen.getByTestId("nsm-simulation-status").textContent).toContain("existiert nicht");
  });

  it("zeigt die Endwerte", () => {
    render(<NarrativeStateMachineModal />);
    expect(screen.getByTestId("nsm-final-values").textContent).toContain("hat_gesiegt");
  });

  it("reagiert auf Graph-Eingabe", () => {
    render(<NarrativeStateMachineModal />);
    const single = {
      start: "a",
      initialFlags: {},
      nodes: [{ id: "a", title: "Einziges", isEnding: true, endingConditions: [], transitions: [] }],
    };
    fireEvent.change(screen.getByTestId("nsm-graph-input"), {
      target: { value: JSON.stringify(single) },
    });
    expect(screen.getByTestId("nsm-ending-a").textContent).toContain("Einziges");
  });

  it("kommt mit ungültigem JSON zurecht", () => {
    render(<NarrativeStateMachineModal />);
    fireEvent.change(screen.getByTestId("nsm-graph-input"), {
      target: { value: "kein json" },
    });
    expect(screen.getByTestId("nsm-valid").textContent).toContain("Logikfehler");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<NarrativeStateMachineModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
