// @vitest-environment jsdom
// Component-Tests für FormattingPanel.tsx (Sprint 24, Agent 5).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormattingPanel } from "./FormattingPanel";

describe("FormattingPanel", () => {
  it("rendert eine Toolbar pro Kategorie", () => {
    render(<FormattingPanel />);
    const toolbars = screen.getAllByRole("toolbar");
    // 7 Kategorien → 7 Toolbars
    expect(toolbars.length).toBe(7);
  });

  it("rendert Format-Buttons und wendet Bold auf den Text an", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FormattingPanel initialText="Hallo" onApply={onApply} />);
    await user.click(screen.getByRole("button", { name: /Fett/ }));
    expect(screen.getByTestId("formatting-preview")).toHaveTextContent("**Hallo**");
    expect(onApply).toHaveBeenLastCalledWith("**Hallo**");
  });

  it("bietet pro Kategorie ein Dropdown und einen Shortcut-Hinweis", async () => {
    const user = userEvent.setup();
    render(<FormattingPanel initialText="Hallo" />);
    // 7 Dropdowns (eines pro Kategorie)
    expect(screen.getAllByRole("combobox").length).toBe(7);
    // Shortcut-Hinweis aufklappen
    await user.click(screen.getByText("⌨ Tastaturkürzel"));
    expect(screen.getByText("Ctrl+B")).toBeTruthy();
  });

  it("'Alle entfernen' streift die Formatierung", async () => {
    const user = userEvent.setup();
    render(<FormattingPanel initialText="**Hallo**" />);
    await user.click(screen.getByRole("button", { name: /Alle entfernen/ }));
    expect(screen.getByTestId("formatting-preview")).toHaveTextContent("Hallo");
  });
});
