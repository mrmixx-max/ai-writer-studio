// @vitest-environment jsdom
// Component-Tests für FormatToolbar.tsx (Sprint 14, Agent 2): alle vier
// Buttons rendern, Klicks rufen die injizierte Service-Funktion mit dem
// getText()-Inhalt auf, onApply erhält (Aktions-ID, Ergebnis). Ohne
// `actions`-Prop meldet die Toolbar fehlenden Service via onError statt Crash.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FormatToolbar,
  type FormatActionId,
  type FormatActions,
} from "./FormatToolbar";

const INPUT_TEXT = 'Er sagte "Hallo" -- und ging. Kapitel 1';

function setupMockActions(): Record<FormatActionId, ReturnType<typeof vi.fn>> {
  return {
    "smart-quotes": vi.fn((t: string) => `SQ:${t}`),
    "auto-paragraph": vi.fn((t: string) => `AP:${t}`),
    "fix-dashes": vi.fn((t: string) => `FD:${t}`),
    "detect-chapters": vi.fn((t: string) => `DC:${t}`),
  };
}

const LABELS: { label: string; id: FormatActionId; prefix: string }[] = [
  { label: "Smart Quotes", id: "smart-quotes", prefix: "SQ:" },
  { label: "Auto-Paragraph", id: "auto-paragraph", prefix: "AP:" },
  { label: "Fix Dashes", id: "fix-dashes", prefix: "FD:" },
  { label: "Detect Chapter Headings", id: "detect-chapters", prefix: "DC:" },
];

describe("FormatToolbar", () => {
  it("rendert alle vier Formatierungs-Buttons", () => {
    render(
      <FormatToolbar getText={() => INPUT_TEXT} onApply={() => {}} actions={{}} />,
    );
    for (const { label } of LABELS) {
      expect(
        screen.getByRole("button", { name: label }),
        `Button "${label}" fehlt`,
      ).toBeTruthy();
    }
  });

  it("rendert eine Toolbar-Landmark mit ARIA-Label", () => {
    render(
      <FormatToolbar getText={() => INPUT_TEXT} onApply={() => {}} actions={{}} />,
    );
    expect(screen.getByRole("toolbar", { name: "Textformatierung" })).toBeTruthy();
  });

  for (const { label, id, prefix } of LABELS) {
    it(`"${label}" ruft die Service-Funktion mit getText() auf und meldet onApply`, async () => {
      const user = userEvent.setup();
      const actions = setupMockActions();
      const onApply = vi.fn();
      const getText = vi.fn(() => INPUT_TEXT);
      render(
        <FormatToolbar
          getText={getText}
          onApply={onApply}
          actions={actions as unknown as FormatActions}
        />,
      );
      await user.click(screen.getByRole("button", { name: label }));
      expect(getText).toHaveBeenCalled();
      expect(actions[id]).toHaveBeenCalledWith(INPUT_TEXT);
      expect(onApply).toHaveBeenCalledWith(id, `${prefix}${INPUT_TEXT}`);
    });
  }

  it("deaktiviert alle Buttons wenn disabled gesetzt ist", async () => {
    const user = userEvent.setup();
    const actions = setupMockActions();
    const onApply = vi.fn();
    render(
      <FormatToolbar
        getText={() => INPUT_TEXT}
        onApply={onApply}
        actions={actions as unknown as FormatActions}
        disabled
      />,
    );
    for (const { label } of LABELS) {
      expect(screen.getByRole("button", { name: label }).hasAttribute("disabled")).toBe(true);
    }
    await user.click(screen.getByRole("button", { name: "Smart Quotes" }));
    expect(actions["smart-quotes"]).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("meldet onError statt zu crashen wenn der Service fehlt", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onApply = vi.fn();
    // Keine actions injiziert und Service liefert nichts → onError statt Crash.
    // serviceLoader simuliert deterministisch den (noch) fehlenden Agent-1-Service.
    render(
      <FormatToolbar
        getText={() => INPUT_TEXT}
        onApply={onApply}
        onError={onError}
        serviceLoader={async () => ({})}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Smart Quotes" }));
    expect(onApply).not.toHaveBeenCalled();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBe("smart-quotes");
  });

  it("partielle actions-Overrides: injizierte Aktion gewinnt, Rest via onError", async () => {
    const user = userEvent.setup();
    const smartQuotes = vi.fn((t: string) => `SQ:${t}`);
    const onApply = vi.fn();
    const onError = vi.fn();
    render(
      <FormatToolbar
        getText={() => INPUT_TEXT}
        onApply={onApply}
        onError={onError}
        actions={{ "smart-quotes": smartQuotes }}
        serviceLoader={async () => ({})}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Smart Quotes" }));
    expect(smartQuotes).toHaveBeenCalledWith(INPUT_TEXT);
    expect(onApply).toHaveBeenCalledWith("smart-quotes", `SQ:${INPUT_TEXT}`);
    await user.click(screen.getByRole("button", { name: "Fix Dashes" }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("fix-dashes", expect.anything()),
    );
  });

  it("nutzt per Default den echten Agent-1-Service (Smart Quotes)", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FormatToolbar getText={() => '"Hallo"'} onApply={onApply} />);
    await user.click(screen.getByRole("button", { name: "Smart Quotes" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    // de-Locale: „…" (U+201E / U+201C)
    expect(onApply).toHaveBeenCalledWith("smart-quotes", "„Hallo\u201c");
  });

  it("nutzt per Default den echten Agent-1-Service (Detect Chapter Headings)", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <FormatToolbar
        getText={() => "Kapitel 1\nEs war einmal."}
        onApply={onApply}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Detect Chapter Headings" }),
    );
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith(
      "detect-chapters",
      "# Kapitel 1\nEs war einmal.",
    );
  });
});
