// @vitest-environment jsdom
// Component-Tests: ShortprosePanel (Sprint 20, Agent 2) — Dropdowns,
// Generieren-Button (gemocktes generate), Ergebnis + Meta, Editor-Callback.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortprosePanel } from "./ShortprosePanel";
import type { ShortproseResult } from "@/services/bookwriter/shortprose";
import { generateShortprose } from "@/services/bookwriter/shortprose";

const RESULT: ShortproseResult = {
  text: "Der Leuchtturm schwieg. In jener Nacht blieb sein Licht aus.",
  genre: "flash-fiction",
  style: "literary",
  wordCount: 10,
  characterCount: 58,
  estimatedReadingTime: 1,
};

function fakeGenerate(result: ShortproseResult = RESULT) {
  return vi.fn(
    async (..._args: Parameters<typeof generateShortprose>) => result,
  );
}

async function fillSeedAndGenerate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByTestId("shortprose-prompt"),
    "Ein Leuchtturm, der erlischt",
  );
  await user.click(screen.getByTestId("shortprose-generate-btn"));
}

describe("ShortprosePanel", () => {
  it("rendert alle Dropdowns (Genre, Stil, Länge, Perspektive, Sprache)", () => {
    render(<ShortprosePanel generate={fakeGenerate()} />);
    expect(screen.getByTestId("shortprose-panel")).toBeTruthy();
    expect(screen.getByTestId("shortprose-prompt")).toBeTruthy();
    expect(screen.getByTestId("shortprose-genre")).toBeTruthy();
    expect(screen.getByTestId("shortprose-style")).toBeTruthy();
    expect(screen.getByTestId("shortprose-length")).toBeTruthy();
    expect(screen.getByTestId("shortprose-perspective")).toBeTruthy();
    expect(screen.getByTestId("shortprose-language")).toBeTruthy();
    expect(screen.getByTestId("shortprose-generate-btn")).toBeTruthy();
  });

  it("Genre-Dropdown enthält alle 5 Genres", () => {
    render(<ShortprosePanel generate={fakeGenerate()} />);
    const select = screen.getByTestId("shortprose-genre") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([
      "flash-fiction",
      "micro-story",
      "kurzgeschichte",
      "snapshot",
      "fable",
    ]);
  });

  it("Generieren-Button ist bei leerem Seed deaktiviert", () => {
    render(<ShortprosePanel generate={fakeGenerate()} />);
    expect(
      (screen.getByTestId("shortprose-generate-btn") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("ruft generate mit Seed + Auswahl auf und zeigt Ergebnis + Meta", async () => {
    const user = userEvent.setup();
    const generate = fakeGenerate();
    render(<ShortprosePanel generate={generate} />);
    await user.selectOptions(screen.getByTestId("shortprose-genre"), "fable");
    await fillSeedAndGenerate(user);
    await waitFor(() => {
      expect(generate).toHaveBeenCalledTimes(1);
    });
    expect(generate.mock.calls[0][0]).toMatchObject({
      genre: "fable",
      prompt: "Ein Leuchtturm, der erlischt",
    });
    await waitFor(() => {
      expect(screen.getByTestId("shortprose-result").textContent).toContain(
        "Leuchtturm",
      );
    });
    expect(screen.getByTestId("shortprose-words").textContent).toContain("10");
    expect(screen.getByTestId("shortprose-chars").textContent).toContain("58");
    expect(screen.getByTestId("shortprose-reading-time").textContent).toContain(
      "1",
    );
  });

  it("zeigt nach der Generierung Editor- und Speichern-Buttons", async () => {
    const user = userEvent.setup();
    render(<ShortprosePanel generate={fakeGenerate()} />);
    await fillSeedAndGenerate(user);
    await waitFor(() => {
      expect(screen.getByTestId("shortprose-result")).toBeTruthy();
    });
    expect(screen.getByTestId("shortprose-open-editor-btn")).toBeTruthy();
    expect(screen.getByTestId("shortprose-save-project-btn")).toBeTruthy();
  });

  it("zeigt einen Fehler, wenn generate wirft", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async () => {
      throw new Error("Provider offline");
    });
    render(<ShortprosePanel generate={generate} />);
    await fillSeedAndGenerate(user);
    await waitFor(() => {
      expect(screen.getByTestId("shortprose-error").textContent).toContain(
        "Provider offline",
      );
    });
  });
});
