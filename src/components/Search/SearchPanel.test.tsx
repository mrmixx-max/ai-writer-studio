// @vitest-environment jsdom
// Component-Tests fuer SearchPanel (Sprint 24, Agent 2).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchPanel } from "./SearchPanel";
import type { SearchResult, SearchStats } from "@/services/search/search";

const RESULTS: SearchResult[] = [
  {
    projectId: "p1",
    projectTitle: "Krimi",
    chapterId: "c1",
    chapterTitle: "Kapitel Eins",
    line: 1,
    column: 5,
    text: "Der Kommissar betritt den Raum.",
    matchStart: 4,
    matchEnd: 13,
  },
  {
    projectId: "p2",
    projectTitle: "SciFi",
    chapterId: "c2",
    chapterTitle: "Kapitel Zwei",
    line: 2,
    column: 1,
    text: "Kommissar im Orbit.",
    matchStart: 0,
    matchEnd: 9,
  },
];

const STATS: SearchStats = { totalResults: 2, projectCount: 2, duration: 3 };

const searchOk = vi.fn(async () => ({ results: RESULTS, stats: STATS }));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SearchPanel", () => {
  it("rendert Suchfeld, Optionen, Bereich, Projekt-Filter und Ersetzen-Buttons", () => {
    render(<SearchPanel searchFn={searchOk} projects={[]} />);
    expect(screen.getByLabelText("Suche")).toBeInTheDocument();
    expect(screen.getByLabelText("Groß-/Kleinschreibung")).toBeInTheDocument();
    expect(screen.getByLabelText("Regulärer Ausdruck")).toBeInTheDocument();
    expect(screen.getByLabelText("Ganzes Wort")).toBeInTheDocument();
    expect(screen.getByLabelText("Bereich")).toBeInTheDocument();
    expect(screen.getByLabelText("Projekt")).toBeInTheDocument();
    expect(screen.getByLabelText("Ersetzen durch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suchen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ersetzen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alle ersetzen" })).toBeInTheDocument();
  });

  it("sucht per Enter und zeigt Ergebnisliste mit Highlight + Statistik", async () => {
    const fn = vi.fn(async () => ({ results: RESULTS, stats: STATS }));
    render(<SearchPanel searchFn={fn} projects={[]} />);
    fireEvent.change(screen.getByLabelText("Suche"), { target: { value: "Kommissar" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).closest("form")!);
    await waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Kommissar", scope: "all" }),
    );
    expect(await screen.findByText(/Krimi/)).toBeInTheDocument();
    expect(screen.getByText(/Kapitel Eins/)).toBeInTheDocument();
    // Match-Highlighting via <mark>
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks[0].textContent).toBe("Kommissar");
    expect(screen.getByText(/2 Treffer in 2 Projekt/)).toBeInTheDocument();
  });

  it("uebergibt Optionen (case, regex, wholeWord, scope, Projekt-Filter) an die Suche", async () => {
    const fn = vi.fn(async () => ({ results: [], stats: { totalResults: 0, projectCount: 0, duration: 1 } }));
    render(
      <SearchPanel
        searchFn={fn}
        projects={[{ id: "p1", name: "Krimi" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Suche"), { target: { value: "Haus" } });
    fireEvent.click(screen.getByLabelText("Groß-/Kleinschreibung"));
    fireEvent.click(screen.getByLabelText("Regulärer Ausdruck"));
    fireEvent.click(screen.getByLabelText("Ganzes Wort"));
    fireEvent.change(screen.getByLabelText("Bereich"), { target: { value: "content" } });
    fireEvent.change(screen.getByLabelText("Projekt"), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));
    await waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Haus",
        caseSensitive: true,
        regex: true,
        wholeWord: true,
        scope: "content",
        projects: ["p1"],
      }),
    );
  });

  it("'Ersetzen' und 'Alle ersetzen' rufen replace-Funktionen mit Ersatztext", async () => {
    const fn = vi.fn(async () => ({ results: RESULTS, stats: STATS }));
    const rep = vi.fn(async () => 1);
    const repAll = vi.fn(async () => 5);
    render(<SearchPanel searchFn={fn} replaceFn={rep} replaceAllFn={repAll} projects={[]} />);
    fireEvent.change(screen.getByLabelText("Suche"), { target: { value: "Kommissar" } });
    fireEvent.change(screen.getByLabelText("Ersetzen durch"), { target: { value: "Inspektor" } });
    fireEvent.click(screen.getByRole("button", { name: "Ersetzen" }));
    await waitFor(() => expect(rep).toHaveBeenCalledOnce());
    expect(rep).toHaveBeenCalledWith(expect.objectContaining({ text: "Kommissar" }), "Inspektor");
    expect(await screen.findByText(/1 Ersetzung\(en\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alle ersetzen" }));
    await waitFor(() => expect(repAll).toHaveBeenCalledOnce());
    expect(repAll).toHaveBeenCalledWith(expect.objectContaining({ text: "Kommissar" }), "Inspektor");
    expect(await screen.findByText(/5 Ersetzung\(en\)/)).toBeInTheDocument();
  });

  it("rendert injizierte Start-Ergebnisse mit Projekt, Kapitel, Zeile und Match", () => {
    render(<SearchPanel searchFn={searchOk} projects={[]} initialResults={RESULTS} />);
    expect(screen.getByText(/Krimi/)).toBeInTheDocument();
    expect(screen.getByText(/Kapitel Zwei/)).toBeInTheDocument();
    expect(screen.getByText(/Zeile 2/)).toBeInTheDocument();
    expect(screen.getAllByText(/SciFi/).length).toBeGreaterThanOrEqual(1);
  });
});
