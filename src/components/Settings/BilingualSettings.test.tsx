// @vitest-environment jsdom
// Component-Tests für BilingualSettings.tsx: Rendern, Defaults, Persistenz
// (Sprache, Toggles), Kapitel-Overrides.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";

const mockLoad = vi.fn((): AppSettings => ({ ...DEFAULT_SETTINGS }));
const mockSave = vi.fn(async (s: AppSettings): Promise<void> => {
  void s;
});

vi.mock("@/services/settings", () => ({
  loadSettings: (): AppSettings => mockLoad(),
  saveSettings: (s: AppSettings): Promise<void> => mockSave(s),
}));

import { BilingualSettings, getBilingualPrefs, withBilingualPrefs, DEFAULT_BILINGUAL_PREFS } from "./BilingualSettings";

const CHAPTERS = [
  { id: "ch-1", title: "Kapitel 1" },
  { id: "ch-2", title: "Kapitel 2" },
];

interface SavedBilingualSlice {
  defaultTargetLanguage?: string;
  autoTranslateOnChapterComplete?: boolean;
  preserveFormatting?: boolean;
  chapterOverrides?: Record<string, string>;
}

/** Gibt die bilingual-Scheibe des zuletzt persistierten Settings-Objekts zurück. */
function savedBilingual(): SavedBilingualSlice {
  const call = mockSave.mock.calls[0];
  if (!call) throw new Error("saveSettings wurde nicht aufgerufen");
  const saved = call[0] as unknown as { bilingual?: SavedBilingualSlice };
  return saved.bilingual ?? {};
}

function settingsWithBilingual(bilingual: Record<string, unknown>): AppSettings {
  return { ...DEFAULT_SETTINGS, bilingual } as unknown as AppSettings;
}

describe("BilingualSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockReturnValue({ ...DEFAULT_SETTINGS });
  });

  it("rendert alle Einstellungs-Controls", () => {
    render(<BilingualSettings chapters={CHAPTERS} />);
    expect(screen.getByLabelText("Standard-Zielsprache")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-Translate bei Kapitelabschluss")).toBeInTheDocument();
    expect(screen.getByLabelText("Formatierung beim Übersetzen erhalten")).toBeInTheDocument();
    expect(screen.getByLabelText("Zielsprache für Kapitel 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Zielsprache für Kapitel 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Speichern/ })).toBeInTheDocument();
  });

  it("nutzt Defaults (EN, Auto aus, Formatierung an) ohne gespeicherte Prefs", () => {
    render(<BilingualSettings />);
    expect(screen.getByLabelText("Standard-Zielsprache")).toHaveValue("en");
    expect(screen.getByLabelText("Auto-Translate bei Kapitelabschluss")).not.toBeChecked();
    expect(screen.getByLabelText("Formatierung beim Übersetzen erhalten")).toBeChecked();
  });

  it("lädt gespeicherte Prefs aus dem Settings-Store", () => {
    mockLoad.mockReturnValue(
      settingsWithBilingual({
        defaultTargetLanguage: "de",
        autoTranslateOnChapterComplete: true,
        preserveFormatting: false,
        chapterOverrides: { "ch-1": "de" },
      }),
    );
    render(<BilingualSettings chapters={CHAPTERS} />);
    expect(mockLoad).toHaveBeenCalled();
    expect(screen.getByLabelText("Standard-Zielsprache")).toHaveValue("de");
    expect(screen.getByLabelText("Auto-Translate bei Kapitelabschluss")).toBeChecked();
    expect(screen.getByLabelText("Formatierung beim Übersetzen erhalten")).not.toBeChecked();
    expect(screen.getByLabelText("Zielsprache für Kapitel 1")).toHaveValue("de");
  });

  it("persistiert die gewählte Zielsprache beim Speichern", async () => {
    const user = userEvent.setup();
    render(<BilingualSettings />);
    await user.selectOptions(screen.getByLabelText("Standard-Zielsprache"), "de");
    await user.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(savedBilingual()).toMatchObject({ defaultTargetLanguage: "de" });
  });

  it("persistiert beide Toggles", async () => {
    const user = userEvent.setup();
    render(<BilingualSettings />);
    await user.click(screen.getByLabelText("Auto-Translate bei Kapitelabschluss"));
    await user.click(screen.getByLabelText("Formatierung beim Übersetzen erhalten"));
    await user.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(savedBilingual()).toMatchObject({
      autoTranslateOnChapterComplete: true,
      preserveFormatting: false,
    });
  });

  it("speichert Kapitel-Overrides und entfernt sie bei Vererbt wieder", async () => {
    const user = userEvent.setup();
    render(<BilingualSettings chapters={CHAPTERS} />);
    // Override setzen (Standard ist en → de wählen, damit dirty wird)
    await user.selectOptions(screen.getByLabelText("Zielsprache für Kapitel 1"), "de");
    await user.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(savedBilingual()).toMatchObject({ chapterOverrides: { "ch-1": "de" } });
    // Zurück auf Vererbt → Override verschwindet, Formular ist wieder pristine
    await user.selectOptions(screen.getByLabelText("Zielsprache für Kapitel 1"), "inherit");
    expect(screen.getByLabelText("Zielsprache für Kapitel 1")).toHaveValue("inherit");
    expect(screen.getByRole("button", { name: /Speichern/ })).toBeDisabled();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("fügt Overrides per Kapitel-ID hinzu (ohne Kapitel-Prop)", async () => {
    const user = userEvent.setup();
    render(<BilingualSettings />);
    await user.type(screen.getByLabelText("Kapitel-ID für Override"), "ch-9");
    await user.selectOptions(screen.getByLabelText("Override-Sprache"), "de");
    await user.click(screen.getByRole("button", { name: /Override hinzufügen/ }));
    expect(screen.getByLabelText("Zielsprache für ch-9")).toHaveValue("de");
    await user.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(savedBilingual()).toMatchObject({ chapterOverrides: { "ch-9": "de" } });
  });

  it("verwerfen stellt gespeicherte Werte wieder her", async () => {
    const user = userEvent.setup();
    render(<BilingualSettings />);
    await user.selectOptions(screen.getByLabelText("Standard-Zielsprache"), "de");
    expect(screen.getByLabelText("Standard-Zielsprache")).toHaveValue("de");
    await user.click(screen.getByRole("button", { name: /Änderungen verwerfen/ }));
    expect(screen.getByLabelText("Standard-Zielsprache")).toHaveValue("en");
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe("BilingualSettings helpers", () => {
  it("getBilingualPrefs fällt auf Defaults zurück", () => {
    expect(getBilingualPrefs({ ...DEFAULT_SETTINGS })).toEqual(DEFAULT_BILINGUAL_PREFS);
  });

  it("withBilingualPrefs erhält übrige Settings", () => {
    const saved = withBilingualPrefs(
      { ...DEFAULT_SETTINGS, model: "mistral" },
      { ...DEFAULT_BILINGUAL_PREFS, defaultTargetLanguage: "de" },
    );
    expect(saved.model).toBe("mistral");
    expect((saved as unknown as { bilingual?: SavedBilingualSlice }).bilingual).toMatchObject({
      defaultTargetLanguage: "de",
    });
  });
});
