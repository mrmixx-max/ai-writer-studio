// @vitest-environment jsdom
// Component-Tests für ImageGenPanel.tsx (Sprint 14, Agent 4):
// Prompt-Eingabe, Modellwahl, Generate-Flow (Loading → Vorschau),
// Fehlerzustand, Insert-ins-Kapitel-Callback.
// Struktur angelehnt an ExportBar.test.tsx (render + user-event).
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageGenPanel, type GeneratedChapterImage } from "./ImageGenPanel";

const FAKE_IMAGE: GeneratedChapterImage = {
  dataUrl: "data:image/png;base64,花的",
  prompt: "nebliger Waldpfad",
  model: "sd-webui",
};

function mockGenerate(resolved: GeneratedChapterImage = FAKE_IMAGE, delayMs = 0) {
  return vi.fn(async (prompt: string, model: "ollama-vision" | "sd-webui") => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return { ...resolved, prompt, model };
  });
}

describe("ImageGenPanel", () => {
  it("rendert Prompt-Feld, Modell-Selector und Generate-Button", () => {
    render(<ImageGenPanel generateImage={mockGenerate()} />);
    expect(screen.getByTestId("image-gen-panel")).toBeInTheDocument();
    expect(screen.getByTestId("image-gen-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("image-gen-model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bild generieren" })).toBeInTheDocument();
  });

  it("Prompt-Änderung aktualisiert das Eingabefeld", async () => {
    const user = userEvent.setup();
    render(<ImageGenPanel generateImage={mockGenerate()} />);
    const input = screen.getByTestId("image-gen-prompt") as HTMLTextAreaElement;
    await user.type(input, "nebliger Waldpfad");
    expect(input.value).toBe("nebliger Waldpfad");
  });

  it("Modell-Selector startet mit Ollama Vision und wechselt zu SD WebUI", async () => {
    const user = userEvent.setup();
    render(<ImageGenPanel generateImage={mockGenerate()} />);
    const select = screen.getByTestId("image-gen-model") as HTMLSelectElement;
    expect(select.value).toBe("ollama-vision");
    await user.selectOptions(select, "sd-webui");
    expect(select.value).toBe("sd-webui");
    expect(screen.getByRole("option", { name: /Ollama Vision/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /SD WebUI/ })).toBeInTheDocument();
  });

  it("leerer Prompt zeigt Fehler und ruft generateImage nicht auf", async () => {
    const user = userEvent.setup();
    const generateImage = mockGenerate();
    render(<ImageGenPanel generateImage={generateImage} />);
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    expect(await screen.findByTestId("image-gen-error")).toHaveTextContent(
      "Bitte einen Prompt eingeben.",
    );
    expect(generateImage).not.toHaveBeenCalled();
    expect(screen.queryByTestId("image-gen-preview")).not.toBeInTheDocument();
  });

  it("Generate-Klick zeigt Loading-Zustand und danach die Vorschau", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const generateImage = vi.fn(async () => {
      await gate;
      return FAKE_IMAGE;
    });
    render(<ImageGenPanel generateImage={generateImage} />);
    await user.type(screen.getByTestId("image-gen-prompt"), "nebliger Waldpfad");
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    // Loading-Zustand während der Generator läuft
    expect(await screen.findByRole("button", { name: "Generiert …" })).toBeDisabled();
    release();
    // Vorschau nach Abschluss
    const preview = await screen.findByTestId("image-gen-preview");
    expect(preview).toBeInTheDocument();
    expect(preview.querySelector("img")).toHaveAttribute("src", FAKE_IMAGE.dataUrl);
    expect(screen.getByRole("button", { name: "Bild generieren" })).toBeEnabled();
  });

  it("Generate ruft generateImage mit getrimmtem Prompt und gewähltem Modell auf", async () => {
    const user = userEvent.setup();
    const generateImage = mockGenerate();
    render(<ImageGenPanel generateImage={generateImage} />);
    await user.type(screen.getByTestId("image-gen-prompt"), "  Burg bei Nacht  ");
    await user.selectOptions(screen.getByTestId("image-gen-model"), "sd-webui");
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    await screen.findByTestId("image-gen-preview");
    expect(generateImage).toHaveBeenCalledWith("Burg bei Nacht", "sd-webui");
  });

  it("abgelehnter Generator zeigt Fehlerzustand statt Vorschau", async () => {
    const user = userEvent.setup();
    const generateImage = vi.fn(async () => {
      throw new Error("SD WebUI offline");
    });
    render(<ImageGenPanel generateImage={generateImage} />);
    await user.type(screen.getByTestId("image-gen-prompt"), "Drachenhort");
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    expect(await screen.findByTestId("image-gen-error")).toHaveTextContent("SD WebUI offline");
    expect(screen.queryByTestId("image-gen-preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bild generieren" })).toBeEnabled();
  });

  it("neuer Generate-Versuch löscht den vorherigen Fehler", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const generateImage = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("Timeout");
      return FAKE_IMAGE;
    });
    render(<ImageGenPanel generateImage={generateImage} />);
    const input = screen.getByTestId("image-gen-prompt");
    await user.type(input, "Seeschlacht");
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    expect(await screen.findByTestId("image-gen-error")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    await waitFor(() => expect(screen.queryByTestId("image-gen-error")).not.toBeInTheDocument());
    expect(await screen.findByTestId("image-gen-preview")).toBeInTheDocument();
  });

  it("Insert-Button erscheint erst nach Generierung und ruft den Callback mit dem Bild auf", async () => {
    const user = userEvent.setup();
    const onInsertIntoChapter = vi.fn();
    render(<ImageGenPanel generateImage={mockGenerate()} onInsertIntoChapter={onInsertIntoChapter} />);
    expect(screen.queryByTestId("image-gen-insert")).not.toBeInTheDocument();
    await user.type(screen.getByTestId("image-gen-prompt"), "Leuchtturm");
    await user.click(screen.getByRole("button", { name: "Bild generieren" }));
    const insertBtn = await screen.findByTestId("image-gen-insert");
    expect(insertBtn).toHaveTextContent("Ins Kapitel einfügen");
    await user.click(insertBtn);
    expect(onInsertIntoChapter).toHaveBeenCalledTimes(1);
    expect(onInsertIntoChapter).toHaveBeenCalledWith(
      expect.objectContaining({ dataUrl: FAKE_IMAGE.dataUrl }),
    );
    expect(insertBtn).toHaveTextContent("eingefügt");
  });

  it("initialModel/initialPrompt-Props setzen Startwerte", () => {
    render(
      <ImageGenPanel
        generateImage={mockGenerate()}
        initialModel="sd-webui"
        initialPrompt="Startprompt"
      />,
    );
    expect((screen.getByTestId("image-gen-model") as HTMLSelectElement).value).toBe("sd-webui");
    expect((screen.getByTestId("image-gen-prompt") as HTMLTextAreaElement).value).toBe(
      "Startprompt",
    );
  });
});
