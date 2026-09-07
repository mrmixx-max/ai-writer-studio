// @vitest-environment jsdom
// Component-Tests für NewsGeneratorPanel.tsx (Sprint 16, Agent 5):
// Topic-Eingabe, Sprachwahl, Generate-Flow (Loading → Vorschau),
// Export-Callback, Fehlerzustand.
// Struktur angelehnt an Images/ImageGenPanel.test.tsx (render + user-event).
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsGeneratorPanel, type GeneratedNewsArticle } from "./NewsGeneratorPanel";

const FAKE_ARTICLES: GeneratedNewsArticle[] = [
  {
    id: "a1",
    headline: "KI-Boom in Europa",
    teaser: "Startups sammeln Rekordsummen ein.",
    imageUrl: "data:image/png;base64,KIBOOM",
    source: "TechTicker",
  },
  {
    id: "a2",
    headline: "Neue Regeln für Modelle",
    teaser: "Der AI Act zeigt erste Wirkung.",
    source: "EuroNews",
  },
];

function mockGenerate(resolved: GeneratedNewsArticle[] = FAKE_ARTICLES, delayMs = 0) {
  return vi.fn(async (topic: string, language: "de" | "en") => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return resolved.map((a) => ({ ...a, headline: `${a.headline} [${topic}/${language}]` }));
  });
}

describe("NewsGeneratorPanel", () => {
  it("rendert Topic-Feld, Sprach-Selector und Search-&-Generate-Button", () => {
    render(<NewsGeneratorPanel generateArticles={mockGenerate()} />);
    expect(screen.getByTestId("news-gen-panel")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-topic")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-language")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search & Generate" })).toBeInTheDocument();
  });

  it("Topic-Änderung aktualisiert das Eingabefeld", async () => {
    const user = userEvent.setup();
    render(<NewsGeneratorPanel generateArticles={mockGenerate()} />);
    const input = screen.getByTestId("news-gen-topic") as HTMLInputElement;
    await user.type(input, "Klimapolitik");
    expect(input.value).toBe("Klimapolitik");
  });

  it("Sprach-Selector startet mit Deutsch und wechselt zu English", async () => {
    const user = userEvent.setup();
    render(<NewsGeneratorPanel generateArticles={mockGenerate()} />);
    const select = screen.getByTestId("news-gen-language") as HTMLSelectElement;
    expect(select.value).toBe("de");
    await user.selectOptions(select, "en");
    expect(select.value).toBe("en");
    expect(screen.getByRole("option", { name: "Deutsch" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("leeres Thema zeigt Fehler und ruft generateArticles nicht auf", async () => {
    const user = userEvent.setup();
    const generateArticles = mockGenerate();
    render(<NewsGeneratorPanel generateArticles={generateArticles} />);
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    expect(await screen.findByTestId("news-gen-error")).toHaveTextContent(
      "Bitte ein Thema eingeben.",
    );
    expect(generateArticles).not.toHaveBeenCalled();
    expect(screen.queryByTestId("news-gen-preview")).not.toBeInTheDocument();
  });

  it("Generate-Klick zeigt Loading-Zustand und danach die Artikelvorschau", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const generateArticles = vi.fn(async () => {
      await gate;
      return FAKE_ARTICLES;
    });
    render(<NewsGeneratorPanel generateArticles={generateArticles} />);
    await user.type(screen.getByTestId("news-gen-topic"), "KI in Europa");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    // Loading-Zustand während der Generator läuft
    expect(await screen.findByRole("button", { name: "Sucht & Generiert …" })).toBeDisabled();
    release();
    // Vorschau nach Abschluss
    const preview = await screen.findByTestId("news-gen-preview");
    expect(preview).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-article-a1")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-article-a2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search & Generate" })).toBeEnabled();
  });

  it("Generate ruft generateArticles mit getrimmtem Thema und gewählter Sprache auf", async () => {
    const user = userEvent.setup();
    const generateArticles = mockGenerate();
    render(<NewsGeneratorPanel generateArticles={generateArticles} />);
    await user.type(screen.getByTestId("news-gen-topic"), "  Energiewende  ");
    await user.selectOptions(screen.getByTestId("news-gen-language"), "en");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    await screen.findByTestId("news-gen-preview");
    expect(generateArticles).toHaveBeenCalledWith("Energiewende", "en");
  });

  it("Vorschau zeigt Headlines, Teaser, Bild und Export-Button", async () => {
    const user = userEvent.setup();
    render(<NewsGeneratorPanel generateArticles={mockGenerate()} />);
    await user.type(screen.getByTestId("news-gen-topic"), "KI");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    await screen.findByTestId("news-gen-preview");
    expect(screen.getByText(/KI-Boom in Europa/)).toBeInTheDocument();
    expect(screen.getByText(/Startups sammeln Rekordsummen/)).toBeInTheDocument();
    const img = screen.getByAltText(/KI-Boom in Europa/);
    expect(img).toHaveAttribute("src", "data:image/png;base64,KIBOOM");
    expect(screen.getByTestId("news-gen-export")).toHaveTextContent("Export Newspaper");
  });

  it("Export-Button erscheint erst nach Generierung und ruft den Callback auf", async () => {
    const user = userEvent.setup();
    const onExportNewspaper = vi.fn();
    render(
      <NewsGeneratorPanel generateArticles={mockGenerate()} onExportNewspaper={onExportNewspaper} />,
    );
    expect(screen.queryByTestId("news-gen-export")).not.toBeInTheDocument();
    await user.type(screen.getByTestId("news-gen-topic"), "KI");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    const exportBtn = await screen.findByTestId("news-gen-export");
    await user.click(exportBtn);
    expect(onExportNewspaper).toHaveBeenCalledTimes(1);
    expect(onExportNewspaper).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "a1" })]),
      "de",
    );
    expect(exportBtn).toHaveTextContent("exportiert");
  });

  it("abgelehnter Generator zeigt Fehlerzustand statt Vorschau", async () => {
    const user = userEvent.setup();
    const generateArticles = vi.fn(async () => {
      throw new Error("Suche offline");
    });
    render(<NewsGeneratorPanel generateArticles={generateArticles} />);
    await user.type(screen.getByTestId("news-gen-topic"), "Wahlen");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    expect(await screen.findByTestId("news-gen-error")).toHaveTextContent("Suche offline");
    expect(screen.queryByTestId("news-gen-preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search & Generate" })).toBeEnabled();
  });

  it("neuer Generate-Versuch löscht den vorherigen Fehler", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const generateArticles = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("Timeout");
      return FAKE_ARTICLES;
    });
    render(<NewsGeneratorPanel generateArticles={generateArticles} />);
    await user.type(screen.getByTestId("news-gen-topic"), "Märkte");
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    expect(await screen.findByTestId("news-gen-error")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Search & Generate" }));
    await waitFor(() => expect(screen.queryByTestId("news-gen-error")).not.toBeInTheDocument());
    expect(await screen.findByTestId("news-gen-preview")).toBeInTheDocument();
  });

  it("initialTopic/initialLanguage-Props setzen Startwerte", () => {
    render(
      <NewsGeneratorPanel
        generateArticles={mockGenerate()}
        initialTopic="Startthema"
        initialLanguage="en"
      />,
    );
    expect((screen.getByTestId("news-gen-topic") as HTMLInputElement).value).toBe("Startthema");
    expect((screen.getByTestId("news-gen-language") as HTMLSelectElement).value).toBe("en");
  });
});
