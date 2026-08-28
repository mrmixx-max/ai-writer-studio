// @vitest-environment jsdom
// Component-Tests für SettingsPanel.tsx: Settings laden, Provider-Felder,
// Speichern, Verbindungstest.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  testConnection: vi.fn(async () => ({ ok: true, message: "Verbindung OK", models: ["llama3.2", "mistral"] })),
}));

vi.mock("@/services/llm/modelRegistry", () => ({
  discoverModels: vi.fn(async () => [
    { provider: "ollama", label: "Ollama", models: [], reachable: false, latencyMs: null, message: "Ollama ist nicht erreichbar." },
  ]),
  clearModelCache: vi.fn(),
  labelFor: vi.fn((p: string) => (p === "ollama" ? "Ollama" : p)),
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

  it("zeigt provider-spezifische Felder: OpenAI-Key nur bei openai", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    expect(screen.queryByLabelText(/OpenAI API-Key/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByDisplayValue("ollama"), "openai");
    expect(screen.getByPlaceholderText("sk-...")).toBeInTheDocument();
    // Ollama-URL verschwindet
    expect(screen.queryByDisplayValue("http://localhost:11434")).not.toBeInTheDocument();
  });

  it("Modell-Eingabe ändert den State; Speichern persistiert", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const modelInput = screen.getByPlaceholderText("z.B. llama3.2");
    await user.clear(modelInput);
    await user.type(modelInput, "mistral-nemo");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "ollama", model: "mistral-nemo" }),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("Verbindungstest zeigt Erfolg mit Modellliste", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.click(screen.getByRole("button", { name: "Verbindung testen" }));
    expect(await screen.findByText(/✓ Verbindung OK/)).toBeInTheDocument();
    expect(testConnection).toHaveBeenCalledWith(expect.objectContaining({ provider: "ollama" }));
    // Modelle-Details sind aufklappbar
    expect(screen.getByText("Modelle (2)")).toBeInTheDocument();
  });

  it("fehlgeschlagener Verbindungstest zeigt Fehler-Styling", async () => {
    vi.mocked(testConnection).mockResolvedValueOnce({
      ok: false,
      message: "Nicht erreichbar",
      models: [],
    } as never);
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.click(screen.getByRole("button", { name: "Verbindung testen" }));
    expect(await screen.findByText(/✗ Nicht erreichbar/)).toBeInTheDocument();
  });

  it("Temperatur-Slider aktualisiert den angezeigten Wert", () => {
    render(<SettingsPanel />);
    expect(screen.getByText(/Temperatur: 0.7/)).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    // jsdom-Range-Input per Value setzen und Event feuern
    slider.focus();
    Object.defineProperty(slider, "value", { value: "0.9", writable: false });
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(screen.getByText(/Temperatur: 0.9/)).toBeInTheDocument();
  });
});
