// @vitest-environment jsdom
// Component-Tests: SearchPanel (Sprint 24, Agent 2) — Suchfeld, Optionen,
// Ergebnisliste mit Highlight, Ersetzen-Buttons, Verlauf.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPanel } from "./SearchPanel";
import type { SearchResult } from "@/services/search/search";

const HITS: SearchResult[] = [
  {
    projectId: "p1",
    projectTitle: "Krimi",
    chapterId: "c1",
    chapterTitle: "Kapitel 1",
    line: 2,
    column: 5,
    text: "Der Kommissar kommt.",
    matchStart: 4,
    matchEnd: 13,
  },
];

const STATS = { totalResults: 1, projectCount: 1, duration: 3 };

describe("SearchPanel", () => {
  it("rendert Suchfeld, Optionen, Scope, Filter und Ersetzen-Buttons", () => {
    render(<SearchPanel onSearch={vi.fn(async () => ({ results: [], stats: STATS }))} />);
    expect(screen.getByTestId("search-panel")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("search-option-case")).toBeInTheDocument();
    expect(screen.getByTestId("search-option-regex")).toBeInTheDocument();
    expect(screen.getByTestId("search-option-word")).toBeInTheDocument();
    expect(screen.getByTestId("search-scope-select")).toBeInTheDocument();
    expect(screen.getByTestId("search-project-filter")).toBeInTheDocument();
    expect(screen.getByTestId("search-replace-button")).toBeInTheDocument();
    expect(screen.getByTestId("search-replace-all-button")).toBeInTheDocument();
    expect(screen.getByTestId("search-recent-select")).toBeInTheDocument();
  });

  it("Enter-Suche zeigt Ergebnisliste mit Highlight + Stats", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async () => ({ results: HITS, stats: STATS }));
    render(<SearchPanel onSearch={onSearch} />);
    await user.type(screen.getByTestId("search-input"), "Kommissar");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("search-results")).toBeInTheDocument());
    expect(onSearch).toHaveBeenCalledOnce();
    expect(screen.getByTestId("search-result-0")).toHaveTextContent("Krimi");
    expect(screen.getByTestId("search-result-0")).toHaveTextContent("Kapitel 1");
    expect(screen.getByTestId("search-stats")).toHaveTextContent("1 Treffer");
    const mark = screen.getByTestId("search-result-0").querySelector("mark");
    expect(mark?.textContent).toBe("Kommissar");
  });

  it("Ersetzen-Buttons rufen Mocks mit Query + Replacement auf", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async () => ({ results: [], stats: STATS }));
    const onReplace = vi.fn(async () => 1);
    const onReplaceAll = vi.fn(async () => 4);
    render(<SearchPanel onSearch={onSearch} onReplace={onReplace} onReplaceAll={onReplaceAll} />);
    await user.type(screen.getByTestId("search-input"), "alt");
    await user.type(screen.getByTestId("search-replace-input"), "neu");
    await user.click(screen.getByTestId("search-replace-button"));
    await waitFor(() => expect(onReplace).toHaveBeenCalledOnce());
    expect(onReplace.mock.calls[0][1]).toBe("neu");
    expect(onReplace.mock.calls[0][0]).toMatchObject({ text: "alt" });
    await user.click(screen.getByTestId("search-replace-all-button"));
    await waitFor(() => expect(onReplaceAll).toHaveBeenCalledOnce());
    expect(screen.getByTestId("search-replaced")).toHaveTextContent("4× ersetzt");
  });

  it("Recent-Auswahl übernimmt den Begriff ins Suchfeld", async () => {
    const user = userEvent.setup();
    render(
      <SearchPanel
        onSearch={vi.fn(async () => ({ results: [], stats: STATS }))}
        onGetRecent={vi.fn(async () => ["frühere-suche"])}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("search-recent-select")).toHaveTextContent("frühere-suche"));
    await user.selectOptions(screen.getByTestId("search-recent-select"), "frühere-suche");
    expect(screen.getByTestId("search-input")).toHaveValue("frühere-suche");
  });
});
