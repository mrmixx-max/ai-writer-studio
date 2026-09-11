// @vitest-environment jsdom
// Component-Tests für NewsGeneratorPanel V2 (Sprint 29, Sprint 30 neu):
// Controls, Leer-Validierung, Demo-Generate-Flow, Export-Callback.
// Demo-Modus läuft lokal (kein Ollama nötig); fetch wird auf Offline gemockt.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsGeneratorPanel } from "./NewsGeneratorPanel";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

describe("NewsGeneratorPanel V2", () => {
  it("rendert alle Controls", () => {
    render(<NewsGeneratorPanel />);
    expect(screen.getByTestId("news-gen-panel")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-topic")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-language")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-count")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-generate")).toBeInTheDocument();
    expect(screen.getByTestId("news-gen-auto")).toBeInTheDocument();
  });

  it("meldet Fehler bei leerem Thema", async () => {
    const user = userEvent.setup();
    render(<NewsGeneratorPanel />);
    await user.click(screen.getByTestId("news-gen-generate"));
    expect(await screen.findByTestId("news-gen-error")).toHaveTextContent("Bitte ein Thema eingeben.");
  });

  it("generiert Demo-Artikel und exportiert sie mit Sprache", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<NewsGeneratorPanel onExportNewspaper={onExport} />);
    await user.type(screen.getByTestId("news-gen-topic"), "Künstliche Intelligenz");
    await user.click(screen.getByTestId("news-gen-generate"));
    await waitFor(() => expect(screen.getByTestId("news-gen-results")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText(/\d+ Artikel generiert/)).toBeInTheDocument();
    await user.click(screen.getByTestId("news-gen-export"));
    expect(onExport).toHaveBeenCalledOnce();
    const [articles, lang] = onExport.mock.calls[0];
    expect(articles.length).toBeGreaterThan(0);
    expect(lang).toBe("de");
    expect(screen.getByTestId("news-gen-export")).toHaveTextContent("Exportiert");
  });

  it("Vollautomatisch füllt ein Zufallsthema und generiert", async () => {
    const user = userEvent.setup();
    render(<NewsGeneratorPanel />);
    await user.click(screen.getByTestId("news-gen-auto"));
    await waitFor(() => expect(screen.getByTestId("news-gen-results")).toBeInTheDocument(), { timeout: 5000 });
    expect((screen.getByTestId("news-gen-topic") as HTMLInputElement).value).not.toBe("");
  });
});
