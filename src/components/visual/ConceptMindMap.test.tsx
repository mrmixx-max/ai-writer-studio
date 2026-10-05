// @vitest-environment jsdom
/**
 * Tests: ConceptMindMap (WP 50.1 — Interaktive Vektor-Mind-Map)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptMindMap } from "./ConceptMindMap";

describe("ConceptMindMap", () => {
  it("rendert die Mind-Map", () => {
    render(<ConceptMindMap />);
    expect(screen.getByTestId("concept-mind-map")).toBeTruthy();
  });

  it("zeigt 4 Knoten-Typen", () => {
    render(<ConceptMindMap />);
    expect(screen.getByTestId("mindmap-kind-idea")).toBeTruthy();
    expect(screen.getByTestId("mindmap-kind-character")).toBeTruthy();
    expect(screen.getByTestId("mindmap-kind-motive")).toBeTruthy();
    expect(screen.getByTestId("mindmap-kind-conflict")).toBeTruthy();
  });

  it("Knoten hinzufügen funktioniert", () => {
    render(<ConceptMindMap />);
    fireEvent.change(screen.getByTestId("mindmap-node-label"), {
      target: { value: "Neue Idee" },
    });
    fireEvent.click(screen.getByTestId("mindmap-add-node"));
    expect(screen.getByTestId("mindmap-nodes").textContent).toContain("Neue Idee");
  });

  it("Knoten-Liste zeigt Knoten", () => {
    render(<ConceptMindMap />);
    fireEvent.change(screen.getByTestId("mindmap-node-label"), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByTestId("mindmap-add-node"));
    expect(screen.getByTestId("mindmap-nodes")).toBeTruthy();
  });

  it("Verbinden funktioniert mit 2 Knoten", () => {
    render(<ConceptMindMap />);
    fireEvent.change(screen.getByTestId("mindmap-node-label"), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByTestId("mindmap-add-node"));
    fireEvent.change(screen.getByTestId("mindmap-node-label"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByTestId("mindmap-add-node"));
    const fromSelect = screen.getByTestId("mindmap-connect-from") as HTMLSelectElement;
    const toSelect = screen.getByTestId("mindmap-connect-to") as HTMLSelectElement;
    fireEvent.change(fromSelect, { target: { value: fromSelect.options[1]?.value || "" } });
    fireEvent.change(toSelect, { target: { value: toSelect.options[2]?.value || "" } });
    fireEvent.change(screen.getByTestId("mindmap-relation"), {
      target: { value: "verursacht" },
    });
    fireEvent.click(screen.getByTestId("mindmap-connect-btn"));
    expect(screen.getByTestId("mindmap-connections")).toBeTruthy();
  });

  it("Auto-Layout funktioniert", () => {
    render(<ConceptMindMap />);
    fireEvent.click(screen.getByTestId("mindmap-auto-layout"));
    expect(screen.getByTestId("concept-mind-map")).toBeTruthy();
  });

  it("SVG-Export funktioniert", () => {
    render(<ConceptMindMap />);
    fireEvent.click(screen.getByTestId("mindmap-export"));
    expect(screen.getByTestId("mindmap-svg-output")).toBeTruthy();
  });

  it("SVG-Output enthält svg-Tag", () => {
    render(<ConceptMindMap />);
    fireEvent.click(screen.getByTestId("mindmap-export"));
    expect(screen.getByTestId("mindmap-svg-output").textContent).toContain("<svg");
  });

  it("Hinzufügen ohne Text deaktiviert", () => {
    render(<ConceptMindMap />);
    expect((screen.getByTestId("mindmap-add-node") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Hinzufügen mit Text aktiviert", () => {
    render(<ConceptMindMap />);
    fireEvent.change(screen.getByTestId("mindmap-node-label"), {
      target: { value: "Test" },
    });
    expect((screen.getByTestId("mindmap-add-node") as HTMLButtonElement).disabled).toBe(false);
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<ConceptMindMap />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
