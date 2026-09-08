// @vitest-environment jsdom
// Component-Tests fuer WebsearchPanel (Sprint 22, Agent 3).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WebsearchPanel } from "./WebsearchPanel";
import type { SearchResult } from "@/services/websearch/websearch";

const RESULTS: SearchResult[] = [
  { title: "Ergebnis Eins", url: "https://example.com/1", snippet: "Snippet eins", source: "duckduckgo", timestamp: 1 },
  { title: "Ergebnis Zwei", url: "https://example.com/2", snippet: "Snippet zwei", source: "brave", timestamp: 2 },
];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("WebsearchPanel", () => {
  it("rendert Suchfeld, Provider-Auswahl und Filter", () => {
    render(<WebsearchPanel />);
    expect(screen.getByLabelText("Suche")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Sprache")).toBeInTheDocument();
    expect(screen.getByLabelText("Zeitraum")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suchen/ })).toBeInTheDocument();
  });

  it("rendert Suchergebnisse mit Oeffnen- und Speichern-Buttons", () => {
    render(<WebsearchPanel initialResults={RESULTS} />);
    expect(screen.getByText("Ergebnis Eins")).toBeInTheDocument();
    expect(screen.getByText("Ergebnis Zwei")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Im Browser öffnen" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Als Quelle speichern" })).toHaveLength(2);
  });

  it("sucht via searchFn und zeigt Ergebnisse + Verlauf", async () => {
    const searchFn = vi.fn(async () => RESULTS);
    render(<WebsearchPanel searchFn={searchFn} />);
    fireEvent.change(screen.getByLabelText("Suche"), { target: { value: "Klimaroman" } });
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "brave" } });
    fireEvent.click(screen.getByRole("button", { name: /Suchen/ }));
    await waitFor(() => expect(searchFn).toHaveBeenCalledOnce());
    expect(searchFn).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Klimaroman", provider: "brave" }),
    );
    expect(await screen.findByText("Ergebnis Eins")).toBeInTheDocument();
    expect(screen.getByText("Klimaroman")).toBeInTheDocument(); // Verlauf
  });

  it("'Als Quelle speichern' ruft onSaveSource + schreibt localStorage", async () => {
    const onSaveSource = vi.fn();
    render(<WebsearchPanel initialResults={RESULTS} onSaveSource={onSaveSource} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Als Quelle speichern" })[0]);
    expect(onSaveSource).toHaveBeenCalledWith(expect.objectContaining({ title: "Ergebnis Eins" }));
    const raw = localStorage.getItem("websearch-sources") ?? "[]";
    expect(raw).toContain("https://example.com/1");
  });
});
