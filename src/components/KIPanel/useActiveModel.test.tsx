// @vitest-environment jsdom
// Regressionstest Modellwechsel-Bug (2026-09): Der ModelPicker schrieb nur
// settings.model — runKIAction nutzt aber das Modell des aktiven Slots
// (Default "main" = llama3.2). Ergebnis: Anzeige wechselte, Anfragen liefen
// weiter aufs alte Modell. selectModel muss Slot + Settings synchron halten.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActiveModel } from "./useActiveModel";
import type { AppSettings } from "@/types/config";

vi.mock("@/services/settings", () => ({
  loadSettings: vi.fn(
    (): AppSettings =>
      ({
        provider: "ollama",
        model: "llama3.2",
        maxTokens: 2048,
        kiModelSlots: [
          { id: "main", label: "Hauptmodell", provider: "ollama", model: "llama3.2" },
        ],
      }) as AppSettings,
  ),
  saveSettings: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useActiveModel.selectModel", () => {
  it("synchronisiert settings.model UND Slot-Modell", async () => {
    const { result } = renderHook(() => useActiveModel());
    expect(result.current.settings.model).toBe("llama3.2");

    let next: AppSettings | null = null;
    const onChange = (e: Event) => {
      next = (e as CustomEvent<AppSettings>).detail;
    };
    window.addEventListener("aiw:settings-changed", onChange);

    await act(async () => {
      result.current.selectModel("ollama", "phi4-18b:latest");
    });

    expect(result.current.settings.model).toBe("phi4-18b:latest");
    expect(result.current.settings.kiModelSlots?.[0].model).toBe("phi4-18b:latest");
    // Sync-Event trägt ebenfalls das synchronisierte Settings-Objekt.
    expect(next).not.toBeNull();
    expect((next as unknown as AppSettings).model).toBe("phi4-18b:latest");
    expect((next as unknown as AppSettings).kiModelSlots?.[0].model).toBe(
      "phi4-18b:latest",
    );
    window.removeEventListener("aiw:settings-changed", onChange);
  });

  it("lässt kiModelSlots unangetastet, wenn keine Slots konfiguriert sind", async () => {
    const { loadSettings } = await import("@/services/settings");
    vi.mocked(loadSettings).mockReturnValueOnce({
      provider: "ollama",
      model: "llama3.2",
      maxTokens: 2048,
    } as AppSettings);
    const { result } = renderHook(() => useActiveModel());
    await act(async () => {
      result.current.selectModel("ollama", "eurollm-22b:latest");
    });
    expect(result.current.settings.model).toBe("eurollm-22b:latest");
    expect(result.current.settings.kiModelSlots).toBeUndefined();
  });
});
