// @vitest-environment jsdom
// Sprint 7, Agent 3: Stil/Ton-Dropdown im BookWriterPanel.
//
// Der freie Stil-Text wird durch ein Preset-Dropdown ersetzt (5 Presets
// aus prompts.json + "kein Preset"). Auswahl wird als tone an die
// Generierung weitergegeben (config.tone), daher gilt: Auswahl ändert
// den übergebenen Tone-String sichtbar.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm/ollama", () => ({
  OllamaProvider: class {
    async *chat() { yield ""; }
  },
}));

vi.mock("@/services/bookwriter/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookwriter/jobs")>();
  return {
    ...actual,
    getResumableBookJob: vi.fn(() => null),
    createBookJob: vi.fn(() => null),
  };
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookWriterPanel } from "./BookWriterPanel";
import { useProjectStore } from "@/store/projectStore";
import { listStyles } from "@/services/bookwriter/prompts/library";

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({
    activeProjectId: "p1",
    chapters: [],
    projects: [{ id: "p1", name: "P", createdAt: 0, updatedAt: 0 }],
  });
});

describe("BookWriterPanel Stil-Dropdown (Sprint 7)", () => {
  it("Dropdown statt freiem Textfeld: alle 5 Presets + 'Kein Stil-Preset'", () => {
    render(<BookWriterPanel />);
    const select = screen.getByLabelText(/Stil\/Ton:/) as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(["", ...listStyles().map((s) => s.id)]);
    expect(select.options[0].textContent).toBe("Kein Stil-Preset");
  });

  it("Auswahl eines Presets übernimmt Label + Beschreibung als Tonalität", async () => {
    const user = userEvent.setup();
    render(<BookWriterPanel />);
    const select = screen.getByLabelText(/Stil\/Ton:/) as HTMLSelectElement;
    const jc = listStyles().find((s) => s.id === "jerry-cotton")!;
    await user.selectOptions(select, "jerry-cotton");
    expect(select.value).toBe("jerry-cotton");
    // Preset-Beschreibung wird als gewählte Tonalität angezeigt (Transparenz).
    expect(screen.getByText(new RegExp(jc.description.slice(0, 20)))).toBeTruthy();
  });

  it("Dropdown existiert auch im klassischen Modus", async () => {
    const user = userEvent.setup();
    render(<BookWriterPanel />);
    await user.click(screen.getByRole("button", { name: /Klassisch/ }));
    expect(screen.getByLabelText(/Stil\/Ton:/).tagName).toBe("SELECT");
  });
});
