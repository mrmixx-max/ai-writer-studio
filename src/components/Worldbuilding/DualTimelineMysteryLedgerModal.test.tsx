// @vitest-environment jsdom
/**
 * Tests: DualTimelineMysteryLedgerModal (WP 72.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DualTimelineMysteryLedgerModal } from "./DualTimelineMysteryLedgerModal";

describe("DualTimelineMysteryLedgerModal", () => {
  it("rendert die Komponente", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("dual-timeline-mystery-ledger-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByText("🔍 Dual-Timeline-Krimi & Indizien-Hauptbuch")).toBeTruthy();
  });

  it("zeigt Zeitachsen-Tabs", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("timeline-tab-past")).toBeTruthy();
    expect(screen.getByTestId("timeline-tab-present")).toBeTruthy();
  });

  it("zeigt Ereignisse", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("timeline-events")).toBeTruthy();
  });

  it("shows Indizien", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("timeline-evidence")).toBeTruthy();
  });

  it("shows Verdächtige", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("timeline-suspects")).toBeTruthy();
  });

  it("wechselt zur Gegenwart", () => {
    render(<DualTimelineMysteryLedgerModal />);
    fireEvent.click(screen.getByTestId("timeline-tab-present"));
    expect(screen.getByTestId("timeline-events").textContent).toContain("Gegenwart");
  });

  it("wechselt zurück zur Vergangenheit", () => {
    render(<DualTimelineMysteryLedgerModal />);
    fireEvent.click(screen.getByTestId("timeline-tab-present"));
    fireEvent.click(screen.getByTestId("timeline-tab-past"));
    expect(screen.getByTestId("timeline-events").textContent).toContain("Vergangenheit");
  });

  it("shows Verdächtigen-Details nach Auswahl", () => {
    render(<DualTimelineMysteryLedgerModal />);
    fireEvent.change(screen.getByTestId("suspect-select"), { target: { value: "suspect-1" } });
    expect(screen.getByTestId("suspect-details")).toBeTruthy();
  });

  it("shows Hauptverdächtigen", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("prime-suspect")).toBeTruthy();
  });

  it("shows stärkste Beweiskette", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("strongest-chain")).toBeTruthy();
  });

  it("shows Alibi-Warnung bei widersprüchlichem Alibi", () => {
    render(<DualTimelineMysteryLedgerModal />);
    fireEvent.change(screen.getByTestId("suspect-select"), { target: { value: "suspect-1" } });
    expect(screen.getByTestId("suspect-alibi-warning").textContent).toContain("Widersprüchliches");
  });

  it("shows konsistentes Alibi bei starkem Alibi", () => {
    render(<DualTimelineMysteryLedgerModal />);
    fireEvent.change(screen.getByTestId("suspect-select"), { target: { value: "suspect-2" } });
    expect(screen.getByTestId("suspect-alibi-warning").textContent).toContain("konsistent");
  });

  it("shows den vollständigen Bericht", () => {
    render(<DualTimelineMysteryLedgerModal />);
    expect(screen.getByTestId("ledger-report-text").textContent).toContain("INDIZIEN-HAUPTBUCH");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<DualTimelineMysteryLedgerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
