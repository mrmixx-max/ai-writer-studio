// @vitest-environment jsdom
/**
 * Tests: WhatIfScenarioPlannerModal (WP 62.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WhatIfScenarioPlannerModal } from "./WhatIfScenarioPlannerModal";

describe("WhatIfScenarioPlannerModal", () => {
  it("rendert die Komponente", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("what-if-scenario-planner-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByText("🔀 Was-wäre-wenn-Szenarienplaner")).toBeTruthy();
  });

  it("zeigt die alternative Schlüsselszene", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect((screen.getByTestId("whatif-scene").textContent ?? "").length).toBeGreaterThan(50);
  });

  it("simuliert eine Kaskade", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-step-0")).toBeTruthy();
    expect(screen.getByTestId("whatif-step-3")).toBeTruthy();
  });

  it("nennt die Kapitel der Kaskade", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-step-0").textContent).toContain("Kap. 5");
  });

  it("zeigt den Diff", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-diff")).toBeTruthy();
    expect(screen.getByTestId("whatif-diff-chapter-1")).toBeTruthy();
  });

  it("zählt abweichende Kapitel", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-changed-count").textContent).toBe("16");
  });

  it("reagiert auf ein früheres Divergenz-Kapitel", () => {
    render(<WhatIfScenarioPlannerModal />);
    fireEvent.change(screen.getByTestId("whatif-chapter-input"), { target: { value: "1" } });
    expect(screen.getByTestId("whatif-changed-count").textContent).toBe("19");
  });

  it("zeigt die Kaskaden-Bewertung", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-analysis")).toBeTruthy();
    expect(screen.getByTestId("whatif-severity")).toBeTruthy();
    expect(screen.getByTestId("whatif-reach")).toBeTruthy();
  });

  it("bewertet, ob die Kaskade das Finale erreicht", () => {
    render(<WhatIfScenarioPlannerModal />);
    const text = screen.getByTestId("whatif-reaches-finale").textContent ?? "";
    expect(text.length).toBeGreaterThan(20);
  });

  it("meldet Finale-Erreichen bei früher Divergenz", () => {
    render(<WhatIfScenarioPlannerModal />);
    fireEvent.change(screen.getByTestId("whatif-chapter-input"), { target: { value: "1" } });
    expect(screen.getByTestId("whatif-reaches-finale").textContent).toContain("Finale");
  });

  it("zeigt eine Empfehlung", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect((screen.getByTestId("whatif-recommendation").textContent ?? "").length).toBeGreaterThan(20);
  });

  it("übernimmt eine neue Divergenz", () => {
    render(<WhatIfScenarioPlannerModal />);
    fireEvent.change(screen.getByTestId("whatif-divergence-input"), {
      target: { value: "Die Heldin nimmt das Lösegeld an" },
    });
    expect(screen.getByTestId("whatif-scene").textContent).toContain("Lösegeld an");
  });

  it("zeigt den vollständigen Bericht", () => {
    render(<WhatIfScenarioPlannerModal />);
    expect(screen.getByTestId("whatif-report-text").textContent).toContain("Divergenz-Punkt");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<WhatIfScenarioPlannerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
