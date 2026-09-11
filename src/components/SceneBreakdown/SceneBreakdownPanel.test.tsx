// @vitest-environment jsdom
// Component-Tests: SceneBreakdownPanel (Sprint 23, Agent 3) — Szenen-Liste,
// Statistiken, Zeitverteilung, CSV-Export.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SceneBreakdownPanel } from "./SceneBreakdownPanel";

const SAMPLE = `INT. WOHNUNG - TAG

Anna betritt den Raum.

ANNA
Wo bist du gewesen?

EXT. STRASSE - NACHT

Ein Streit eskaliert im Regen.

PETER
Lass mich in Ruhe!
`;

describe("SceneBreakdownPanel", () => {
  it("rendert die Szenen-Liste mit Headings", () => {
    render(<SceneBreakdownPanel initialText={SAMPLE} />);
    const list = screen.getByRole("list", { name: "Szenenliste" });
    expect(list).toBeTruthy();
    expect(screen.getByText("INT. WOHNUNG - TAG")).toBeTruthy();
    expect(screen.getByText("EXT. STRASSE - NACHT")).toBeTruthy();
  });

  it("zeigt Statistik-Karten und Zeitverteilung", () => {
    render(<SceneBreakdownPanel initialText={SAMPLE} />);
    const stats = screen.getByRole("group", { name: "Statistiken" });
    expect(stats.textContent).toContain("Szenen gesamt");
    expect(screen.getByText("Zeitverteilung")).toBeTruthy();
    // 1× Tag, 1× Nacht
    expect(screen.getByText(/Tag: 1.*Nacht: 1/s)).toBeTruthy();
  });

  it("analysiert erst nach Klick auf 'Analysieren'", async () => {
    const user = userEvent.setup();
    render(<SceneBreakdownPanel />);
    expect(screen.queryByText("INT. WOHNUNG - TAG")).toBeNull();
    await user.type(screen.getByLabelText("Drehbuch-/Romantext"), SAMPLE);
    await user.click(screen.getByRole("button", { name: "Analysieren" }));
    expect(screen.getByText("INT. WOHNUNG - TAG")).toBeTruthy();
  });

  it("exportiert CSV ueber onExport", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<SceneBreakdownPanel initialText={SAMPLE} onExport={onExport} />);
    await user.click(screen.getByRole("button", { name: "Als CSV exportieren" }));
    expect(onExport).toHaveBeenCalledOnce();
    const csv: string = onExport.mock.calls[0][0];
    // Header-Spalte "Heading" (Schreibweise egal, Inhalt zählt).
    expect(csv.split("\n")[0].toLowerCase()).toContain("heading");
    expect(csv).toContain("INT. WOHNUNG - TAG");
  });

  it("zeigt einen Hinweis bei fehlenden Szenen", () => {
    render(<SceneBreakdownPanel initialText="Nur Prosa ohne Headings." />);
    expect(screen.getByText(/Keine Szenen erkannt/)).toBeTruthy();
  });
});
