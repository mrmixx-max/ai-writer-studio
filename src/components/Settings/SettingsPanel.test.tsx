// @vitest-environment jsdom
// Component-Tests für SettingsPanel.tsx: Settings laden, Anbieter-Karten
// (Status, Felder, Test, „Als aktiv verwenden"), Dirty-Tracking, Speichern.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/settings", () => ({
  loadSettings: vi.fn(() => ({
    provider: "ollama",
    model: "llama3.2",
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: "Du bist ein Assistent.",
    theme: "dark",
    ollamaBaseUrl: "http://localhost:11434",
  })),
  saveSettings: vi.fn(async () => undefined),
}));

vi.mock("@/services/llm/connection", () => ({
  testConnection: vi.fn(async () => ({
    ok: true,
    message: "Verbindung OK",
    models: ["llama3.2", "mistral"],
  })),
}));

vi.mock("@/services/llm/modelRegistry", () => ({
  discoverModels: vi.fn(async () => [
    { provider: "ollama", label: "Ollama", models: ["llama3.2", "mistral"], reachable: true, latencyMs: 42 },
    { provider: "lmstudio", label: "LM Studio", models: [], reachable: false, latencyMs: null, message: "LM Studio ist nicht erreichbar." },
  ]),
  clearModelCache: vi.fn(),
  labelFor: vi.fn((p: string) => ({ ollama: "Ollama", lmstudio: "LM Studio", openai: "OpenAI", openrouter: "OpenRouter", gpt2api: "gpt2api", nous: "Nous Research" }[p] ?? p)),
  REGISTRY_PROVIDERS: ["ollama", "lmstudio", "openai", "openrouter", "gpt2api", "nous"],
}));

vi.mock("@/i18n/highContrast", () => ({
  setHighContrast: vi.fn(),
  getHighContrastPreference: vi.fn(() => false),
}));

vi.mock("@/i18n/a11y", () => ({
  announce: vi.fn(),
}));

import { SettingsPanel } from "./SettingsPanel";
import { loadSettings, saveSettings } from "@/services/settings";
import { testConnection } from "@/services/llm/connection";

function cardOf(provider: string): HTMLElement {
  const card = document.querySelector(`[data-provider="${provider}"]`);
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("lädt persistierte Einstellungen beim Mount", () => {
    render(<SettingsPanel />);
    expect(loadSettings).toHaveBeenCalled();
    expect(screen.getByDisplayValue("llama3.2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("http://localhost:11434")).toBeInTheDocument();
  });

  it("rendert eine Karte pro Anbieter mit Status-Ampel und Latenz", async () => {
    render(<SettingsPanel />);
    for (const p of ["ollama", "lmstudio", "openai", "openrouter", "gpt2api", "nous"]) {
      expect(cardOf(p)).toBeInTheDocument();
    }
    const ollama = cardOf("ollama");
    expect(await within(ollama).findByText(/erreichbar · 42 ms/)).toBeInTheDocument();
    expect(within(ollama).getByText(/2 Modelle/)).toBeInTheDocument();
    const lmstudio = cardOf("lmstudio");
    expect(await within(lmstudio).findByText(/nicht erreichbar/)).toBeInTheDocument();
  });

  it("hervorgehobenes aktives Modell: Karte hat Green-Frame-Klasse", () => {
    render(<SettingsPanel />);
    expect(cardOf("ollama")).toHaveClass("active");
    expect(cardOf("openai")).not.toHaveClass("active");
  });

  it("Klick auf Felder setzt nicht den aktiven Provider — separater Button tut es", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    // Aufklappen + tippen ändert NICHT den aktiven Provider
    const openaiCard = cardOf("openai");
    await user.click(within(openaiCard).getByText("Felder"));
    const keyInput = within(openaiCard).getByLabelText(/OpenAI API-Key/);
    await user.type(keyInput, "sk-test123");
    expect(cardOf("openai")).not.toHaveClass("active");
    expect(cardOf("ollama")).toHaveClass("active");
    // Erst „Als aktiv verwenden" wechselt den aktiven Anbieter
    await user.click(within(openaiCard).getByRole("button", { name: "Als aktiv verwenden" }));
    expect(cardOf("openai")).toHaveClass("active");
    expect(cardOf("ollama")).not.toHaveClass("active");
  });

  it("Verbindung testen pro Karte mit Inline-Ergebnis", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.click(within(cardOf("ollama")).getByRole("button", { name: "Verbindung testen" }));
    expect(await screen.findByText(/✓ Verbindung OK/)).toBeInTheDocument();
    expect(testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "ollama" }),
    );
    expect(screen.getByText("Modelle (2)")).toBeInTheDocument();
  });

  it("Key-Format-Warnung bei falschem OpenAI-Schlüssel", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const openaiCard = cardOf("openai");
    await user.click(within(openaiCard).getByText("Felder"));
    const keyInput = within(openaiCard).getByLabelText(/OpenAI API-Key/);
    await user.type(keyInput, "falsches-format");
    expect(within(openaiCard).getByText(/beginnen mit „sk-or-|beginnen mit „sk-/)).toBeInTheDocument();
  });

  it("URL-Format-Check meldet ungültige Ollama-URL", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const ollamaCard = cardOf("ollama");
    await user.click(within(ollamaCard).getByText("Felder"));
    const urlInput = within(ollamaCard).getByLabelText(/Ollama-Base-URL/);
    await user.clear(urlInput);
    await user.type(urlInput, "nicht-eine-url");
    expect(within(ollamaCard).getByText(/gültige URL angeben/)).toBeInTheDocument();
  });

  it("Ungespeicherte Änderungen: gelber Punkt + Verwerfen setzt zurück", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    expect(screen.queryByTitle("Ungespeicherte Änderungen")).not.toBeInTheDocument();
    const ollamaCard = cardOf("ollama");
    await user.click(within(ollamaCard).getByText("Felder"));
    const urlInput = within(ollamaCard).getByLabelText(/Ollama-Base-URL/);
    await user.clear(urlInput);
    await user.type(urlInput, "http://localhost:9999");
    expect(screen.getAllByTitle("Ungespeicherte Änderungen").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Änderungen verwerfen" }));
    expect(screen.getByDisplayValue("http://localhost:11434")).toBeInTheDocument();
    expect(screen.queryByTitle("Ungespeicherte Änderungen")).not.toBeInTheDocument();
  });

  it("Modell-Auswahl ändert den State; Speichern persistiert", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    // Erkannte Modelle erscheinen als Select (statt Freitext)
    const modelSelect = await waitFor(() => {
      const el = screen.getByLabelText(/^Modell/);
      expect(el.tagName).toBe("SELECT");
      return el;
    });
    await user.selectOptions(modelSelect, "mistral");
    await user.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "ollama", model: "mistral" }),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("Temperatur-Slider aktualisiert den angezeigten Wert", () => {
    render(<SettingsPanel />);
    expect(screen.getByText(/Temperatur: 0.7/)).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    slider.focus();
    Object.defineProperty(slider, "value", { value: "0.9", writable: false });
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(screen.getByText(/Temperatur: 0.9/)).toBeInTheDocument();
  });
});
