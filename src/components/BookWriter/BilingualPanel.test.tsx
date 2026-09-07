// @vitest-environment jsdom
// Component-Tests: BilingualPanel (Sprint 15, Agent 2) — Sprachwahl DE/EN,
// Translate-Button (gemockter chat), Side-by-Side-Vorschau, Apply-Callback.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilingualPanel } from "./BilingualPanel";
import type { TranslationChapter } from "@/services/bookwriter/translatorService";

const CHAPTER: TranslationChapter = {
  id: "c1",
  title: "Anfang",
  content: "Es war einmal ein dunkler Wald.",
};

function fakeChat(translated: string) {
  return vi.fn(async () => translated);
}

describe("BilingualPanel", () => {
  it("rendert das Panel mit Titel und Original-Vorschau", () => {
    render(<BilingualPanel chapter={CHAPTER} chat={fakeChat("x")} />);
    expect(screen.getByTestId("bilingual-panel")).toBeTruthy();
    expect(screen.getByTestId("bilingual-original").textContent).toContain(
      "Es war einmal ein dunkler Wald.",
    );
  });

  it("zeigt als Default-Zielsprache Englisch", () => {
    render(<BilingualPanel chapter={CHAPTER} chat={fakeChat("x")} />);
    const select = screen.getByTestId("bilingual-lang-select") as HTMLSelectElement;
    expect(select.value).toBe("Englisch");
  });

  it("Selector-Wechsel auf Deutsch aktualisiert Zielsprache und Header", async () => {
    const user = userEvent.setup();
    render(<BilingualPanel chapter={CHAPTER} chat={fakeChat("x")} />);
    const select = screen.getByTestId("bilingual-lang-select");
    await user.selectOptions(select, "Deutsch");
    expect((select as HTMLSelectElement).value).toBe("Deutsch");
    expect(screen.getByTestId("bilingual-panel").textContent).toContain("Deutsch");
  });

  it("Selector-Wechsel zurück auf Englisch funktioniert", async () => {
    const user = userEvent.setup();
    render(<BilingualPanel chapter={CHAPTER} chat={fakeChat("x")} initialTarget="Deutsch" />);
    const select = screen.getByTestId("bilingual-lang-select");
    expect((select as HTMLSelectElement).value).toBe("Deutsch");
    await user.selectOptions(select, "Englisch");
    expect((select as HTMLSelectElement).value).toBe("Englisch");
  });

  it("Translate-Button ruft chat auf und rendert die Übersetzung", async () => {
    const user = userEvent.setup();
    const chat = fakeChat("Once upon a time there was a dark forest.");
    render(<BilingualPanel chapter={CHAPTER} chat={chat} />);
    await user.click(screen.getByTestId("bilingual-translate-btn"));
    await waitFor(() => {
      expect(chat).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("bilingual-translated").textContent).toContain(
        "Once upon a time",
      );
    });
  });

  it("Übersetzung enthält den übersetzten Titel", async () => {
    const user = userEvent.setup();
    const chat = fakeChat("The Beginning\n\nOnce upon a time there was a dark forest.");
    render(<BilingualPanel chapter={CHAPTER} chat={chat} />);
    await user.click(screen.getByTestId("bilingual-translate-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("bilingual-translated").textContent).toContain("The Beginning");
    });
  });

  it("Apply-Button ist vor der Übersetzung deaktiviert", () => {
    render(<BilingualPanel chapter={CHAPTER} chat={fakeChat("x")} onApply={() => {}} />);
    expect(
      (screen.getByTestId("bilingual-apply-btn") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("Apply-Callback wird mit dem Ergebnis aufgerufen", async () => {
    const user = userEvent.setup();
    const chat = fakeChat("Once upon a time there was a dark forest.");
    const onApply = vi.fn();
    render(<BilingualPanel chapter={CHAPTER} chat={chat} onApply={onApply} />);
    await user.click(screen.getByTestId("bilingual-translate-btn"));
    await waitFor(() => {
      expect(
        (screen.getByTestId("bilingual-apply-btn") as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    await user.click(screen.getByTestId("bilingual-apply-btn"));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].chapterId).toBe("c1");
    expect(onApply.mock.calls[0][0].content).toContain("Once upon a time");
  });

  it("ohne chat: Translate deaktiviert + Offline-Hinweis", () => {
    render(<BilingualPanel chapter={CHAPTER} />);
    expect(
      (screen.getByTestId("bilingual-translate-btn") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByTestId("bilingual-offline-note")).toBeTruthy();
  });

  it("Sprachwechsel nach Übersetzung setzt die Vorschau zurück", async () => {
    const user = userEvent.setup();
    const chat = fakeChat("Once upon a time there was a dark forest.");
    render(<BilingualPanel chapter={CHAPTER} chat={chat} />);
    await user.click(screen.getByTestId("bilingual-translate-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("bilingual-translated").textContent).toContain(
        "Once upon a time",
      );
    });
    await user.selectOptions(screen.getByTestId("bilingual-lang-select"), "Deutsch");
    expect(screen.getByTestId("bilingual-translated").textContent).toContain(
      "Noch keine Übersetzung",
    );
  });
});
