// @vitest-environment jsdom
// Component-Tests für die Wizard-Schritt-Komponenten (Welcome/, echte Renders).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/setup/probe", () => ({
  probeOllama: vi.fn(async () => ({ provider: "ollama", label: "Ollama", reachable: true, models: ["llama3.2"], message: "OK", latencyMs: 12 })),
  probeLmStudio: vi.fn(async () => ({ provider: "lmstudio", label: "LM Studio", reachable: false, models: [], message: "nicht erreichbar" })),
  probeOpenAi: vi.fn(async () => ({ provider: "openai", label: "OpenAI", reachable: true, models: ["gpt-4o-mini"], message: "OK" })),
  probeOpenRouter: vi.fn(async () => ({ provider: "openrouter", label: "OpenRouter", reachable: true, models: ["z-ai/glm-4.5-air:free", "openai/gpt-4o-mini"], message: "OK", latencyMs: 80 })),
}));

import { StepWelcome } from "./StepWelcome";
import { StepModel } from "./StepModel";
import { StepProvider } from "./StepProvider";
import { StepFinish } from "./StepFinish";

describe("StepWelcome", () => {
  it("zeigt App-Name und Kernversprechen", () => {
    render(<StepWelcome />);
    expect(screen.getByText(/AI Writer Studio/)).toBeInTheDocument();
  });
});

describe("StepModel", () => {
  it("zeigt gefundene Modelle als Auswahl", async () => {
    const user = userEvent.setup();
    void user;
    const onModelChange = vi.fn();
    render(
      <StepModel
        provider="ollama"
        model="llama3.2"
        onModelChange={onModelChange}
        probe={{ provider: "ollama", label: "Ollama", reachable: true, models: ["llama3.2", "mistral"], message: "OK", latencyMs: 9 }}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Modell/), "mistral");
    expect(onModelChange).toHaveBeenCalledWith("mistral");
  });

  it("zeigt Fallback-Eingabe ohne Modellliste", () => {
    const onModelChange = vi.fn();
    render(
      <StepModel provider="openai" model="" onModelChange={onModelChange} probe={undefined} />,
    );
    const input = screen.getByLabelText(/Modell/);
    expect(input.tagName).toBe("INPUT");
    fireEvent.change(input, { target: { value: "gpt-4o" } });
    expect(onModelChange).toHaveBeenCalledWith("gpt-4o");
  });
});

describe("StepProvider", () => {
  const noop = () => {};
  const base = {
    onProviderChange: noop,
    openaiKey: "",
    onOpenaiKeyChange: noop,
    openrouterKey: "",
    onOpenrouterKeyChange: noop,
    nousKey: "",
    onNousKeyChange: noop,
    probes: {},
    onProbe: noop,
  };

  it("markiert den gewählten Anbieter", () => {
    render(<StepProvider {...base} provider="ollama" />);
    const card = screen.getByRole("button", { name: /Ollama/ }).closest(".provider-card");
    expect(card).toHaveClass("selected");
  });

  it("Wechsel zu OpenAI zeigt Schlüsselfeld und Testen-Button", async () => {
    const onOpenaiKeyChange = vi.fn();
    const onProbe = vi.fn();
    const user = userEvent.setup();
    render(
      <StepProvider
        {...base}
        provider="openai"
        openaiKey="sk-test"
        onOpenaiKeyChange={onOpenaiKeyChange}
        onProbe={onProbe}
      />,
    );
    const key = screen.getByPlaceholderText("sk-…");
    fireEvent.change(key, { target: { value: "sk-neu" } });
    expect(onOpenaiKeyChange).toHaveBeenCalledWith("sk-neu");
    await user.click(screen.getByRole("button", { name: "Schlüssel prüfen" }));
    expect(onProbe).toHaveBeenCalledWith(
      "openai",
      expect.objectContaining({ reachable: true, models: ["gpt-4o-mini"] }),
    );
  });

  it("Ollama-Test ruft Probe und meldet Ergebnis", async () => {
    const onProbe = vi.fn();
    const user = userEvent.setup();
    render(<StepProvider {...base} provider="ollama" onProbe={onProbe} />);
    const cards = screen.getAllByRole("button", { name: "Testen" });
    await user.click(cards[0]);
    expect(onProbe).toHaveBeenCalledWith(
      "ollama",
      expect.objectContaining({ reachable: true, models: ["llama3.2"] }),
    );
  });
});

describe("StepFinish", () => {
  it("Checkboxen und Theme-Auswahl geben Änderungen weiter", async () => {
    const onSampleChange = vi.fn();
    const onDemoPromptsChange = vi.fn();
    const onThemeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StepFinish
        sample
        onSampleChange={onSampleChange}
        demoPrompts
        onDemoPromptsChange={onDemoPromptsChange}
        theme="dark"
        onThemeChange={onThemeChange}
      />,
    );
    const boxes = screen.getAllByRole("checkbox");
    await user.click(boxes[0]);
    expect(onSampleChange).toHaveBeenCalledWith(false);
    await user.click(boxes[1]);
    expect(onDemoPromptsChange).toHaveBeenCalledWith(false);
    await user.selectOptions(screen.getByLabelText(/Erscheinungsbild/), "light");
    expect(onThemeChange).toHaveBeenCalledWith("light");
  });
});
