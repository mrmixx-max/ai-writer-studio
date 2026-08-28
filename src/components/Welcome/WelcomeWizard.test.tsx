// @vitest-environment jsdom
// Component-Tests für WelcomeWizard.tsx: Skip-Flow, Schritt-Navigation,
// Provider-Probe, Abschluss (Settings speichern, Sample-Projekt, onDone).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./StepWelcome", () => ({ StepWelcome: () => <div>Willkommen bei AI Writer Studio</div> }));
vi.mock("./StepProvider", () => ({
  StepProvider: () => <div data-testid="step-provider">Anbieter wählen</div>,
}));
vi.mock("./StepModel", () => ({
  StepModel: () => <div data-testid="step-model">Modell wählen</div>,
}));
vi.mock("./StepTemplates", () => ({
  StepTemplates: () => <div data-testid="step-templates">Vorlagen wählen</div>,
}));
vi.mock("./StepFinish", () => ({
  StepFinish: ({ sample }: { sample: boolean }) => (
    <div data-testid="step-finish">Letzter Schritt (Sample: {String(sample)})</div>
  ),
}));

vi.mock("@/services/setup/probe", () => ({
  probeLocalProviders: vi.fn(async () => [
    { provider: "ollama", reachable: true, models: ["llama3.2"] },
    { provider: "lmstudio", reachable: false, models: [] },
  ]),
  probeOpenRouter: vi.fn(async () => ({
    provider: "openrouter",
    label: "OpenRouter",
    reachable: true,
    models: ["z-ai/glm-4.5-air:free", "openai/gpt-4o-mini"],
    message: "OK",
    latencyMs: 80,
  })),
}));

vi.mock("@/services/setup/sampleProject", () => ({
  createSampleProject: vi.fn(async () => "proj-sample-1"),
}));

vi.mock("@/services/setup/state", () => ({
  markSetupCompleted: vi.fn(),
  isSetupCompleted: vi.fn(() => false),
}));

vi.mock("@/services/settings", () => ({
  loadSettings: vi.fn(() => ({ provider: "ollama", model: "llama3.2", theme: "dark" })),
  saveSettings: vi.fn(async () => undefined),
}));

vi.mock("@/services/prompt/seed", () => ({
  seedDefaultPrompts: vi.fn(async () => undefined),
}));

vi.mock("@/services/project", () => ({
  createProject: vi.fn(async (name: string) => ({ id: "proj-tpl-1", name })),
}));

vi.mock("@/services/templates", () => ({
  applyTemplates: vi.fn(async () => ({
    chaptersCreated: 0,
    charactersCreated: 0,
    plotNoteCreated: false,
  })),
}));

import { WelcomeWizard } from "./WelcomeWizard";
import { markSetupCompleted } from "@/services/setup/state";
import { createSampleProject } from "@/services/setup/sampleProject";
import { loadSettings, saveSettings } from "@/services/settings";
import { seedDefaultPrompts } from "@/services/prompt/seed";
import { probeLocalProviders } from "@/services/setup/probe";

describe("WelcomeWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("zeigt Schritt 1 (Willkommen) mit Skip-Button", () => {
    render(<WelcomeWizard onDone={vi.fn()} />);
    expect(screen.getByText("Willkommen bei AI Writer Studio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Überspringen" })).toBeInTheDocument();
  });

  it("Überspringen ruft onDone(null) und markSetupCompleted", async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeWizard onDone={onDone} />);
    await user.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(onDone).toHaveBeenCalledWith(null);
    expect(markSetupCompleted).toHaveBeenCalled();
  });

  it("'Einrichten' startet Provider-Probe und zeigt Schritt 2", async () => {
    const user = userEvent.setup();
    render(<WelcomeWizard onDone={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Einrichten" }));
    expect(probeLocalProviders).toHaveBeenCalled();
    expect(await screen.findByTestId("step-provider")).toBeInTheDocument();
  });

  it("führt durch alle Schritte bis 'Fertig' und schließt ab", async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeWizard onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Einrichten" }));
    await screen.findByTestId("step-provider");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByTestId("step-model")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByTestId("step-templates")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByTestId("step-finish")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fertig" }));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "ollama", model: "llama3.2", theme: "dark" }),
    );
    expect(loadSettings).toHaveBeenCalled();
    expect(seedDefaultPrompts).toHaveBeenCalled(); // demoPrompts default an
    expect(createSampleProject).toHaveBeenCalled();
    expect(markSetupCompleted).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("proj-sample-1");
    // Theme wurde angewendet
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("'Zurück' navigiert einen Schritt nach oben", async () => {
    const user = userEvent.setup();
    render(<WelcomeWizard onDone={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Einrichten" }));
    await screen.findByTestId("step-provider");
    await user.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByText("Willkommen bei AI Writer Studio")).toBeInTheDocument();
  });

  it("Speicherfehler zeigen verständliche Fehlermeldung (keine Sackgasse)", async () => {
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error("DB gesperrt"));
    const user = userEvent.setup();
    render(<WelcomeWizard onDone={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Einrichten" }));
    await screen.findByTestId("step-provider");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "Fertig" }));
    expect(await screen.findByText(/DB gesperrt/)).toBeInTheDocument();
    expect(markSetupCompleted).not.toHaveBeenCalled();
  });

  it("Alle fünf Fortschritts-Punkte werden gerendert", () => {
    const { container } = render(<WelcomeWizard onDone={vi.fn()} />);
    expect(container.querySelectorAll(".welcome-dot")).toHaveLength(5);
    expect(container.querySelector(".welcome-dot.active")).toBeInTheDocument();
  });
});
