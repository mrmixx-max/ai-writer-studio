// @vitest-environment jsdom
// Component-Tests: OutlinerPanel (Sprint 22, Agent 5) — Baumansicht,
// Hinzufuegen/Loeschen, Auf/Zuklappen, Markdown-Export, Projekt-Erstellung.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutlinerPanel } from "./OutlinerPanel";

const SEED = "# Roman\n\n- Akt 1\n  - Szene 1\n- Akt 2\n";

describe("OutlinerPanel", () => {
  it("rendert die Baumansicht mit Knoten und Einrueckung", () => {
    render(<OutlinerPanel initialTitle="Roman" initialMarkdown={SEED} />);
    expect(screen.getByRole("tree")).toBeTruthy();
    expect(screen.getByText("Akt 1")).toBeTruthy();
    expect(screen.getByText("Szene 1")).toBeTruthy();
    expect(screen.getByText("Akt 2")).toBeTruthy();
    expect(screen.getAllByRole("treeitem").length).toBeGreaterThanOrEqual(3);
  });

  it("fuegt per '+ Wurzelknoten' einen neuen Knoten hinzu", async () => {
    const user = userEvent.setup();
    render(<OutlinerPanel initialTitle="Roman" initialMarkdown={SEED} />);
    await user.click(screen.getByRole("button", { name: "+ Wurzelknoten" }));
    expect(screen.getByText("Neuer Knoten")).toBeTruthy();
  });

  it("loescht einen Knoten per Loeschen-Button", async () => {
    const user = userEvent.setup();
    render(<OutlinerPanel initialTitle="Roman" initialMarkdown={SEED} />);
    await user.click(screen.getByRole("button", { name: "Knoten löschen: Akt 2" }));
    expect(screen.queryByText("Akt 2")).toBeNull();
    expect(screen.getByText("Akt 1")).toBeTruthy();
  });

  it("klappt einen Knoten zu und wieder auf", async () => {
    const user = userEvent.setup();
    render(<OutlinerPanel initialTitle="Roman" initialMarkdown={SEED} />);
    await user.click(screen.getByRole("button", { name: "Zuklappen" }));
    expect(screen.queryByText("Szene 1")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Aufklappen" }));
    expect(screen.getByText("Szene 1")).toBeTruthy();
  });

  it("exportiert Markdown ueber onExport", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<OutlinerPanel initialTitle="Roman" initialMarkdown={SEED} onExport={onExport} />);
    await user.click(screen.getByRole("button", { name: "Als Markdown exportieren" }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const md = onExport.mock.calls[0][0] as string;
    expect(md).toContain("# Roman");
    expect(md).toContain("- Akt 1");
    expect(md).toContain("  - Szene 1");
  });

  it("ruft onCreateProject mit dem Outline auf", async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn();
    render(
      <OutlinerPanel
        initialTitle="Roman"
        initialMarkdown={SEED}
        onCreateProject={onCreateProject}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Als Projekt erstellen" }));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
    expect(onCreateProject.mock.calls[0][0].title).toBe("Roman");
    expect(onCreateProject.mock.calls[0][0].nodes).toHaveLength(2);
  });
});
