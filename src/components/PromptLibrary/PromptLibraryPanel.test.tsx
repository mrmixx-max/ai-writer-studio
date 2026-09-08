// @vitest-environment jsdom
// Sprint 24, Agent 4: Component-Tests fuer das PromptLibraryPanel (NEUE Datei).
// Liste, Suche, Kategorie-Filter, Favorit-Stern, Verwenden-Button, Neu-Formular.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptLibraryPanel } from "./PromptLibraryPanel";
import { resetLibraryForTests } from "@/services/prompts/promptLibrary";

beforeEach(() => {
  resetLibraryForTests();
  localStorage.clear();
});

describe("PromptLibraryPanel", () => {
  it("rendert die Prompt-Liste mit Karten", async () => {
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId("prompt-library-list")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    expect(screen.getByText("SEO Optimierung")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-library-search")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-library-category")).toBeInTheDocument();
  });

  it("Suchfeld filtert die Liste", async () => {
    const user = userEvent.setup();
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    await user.type(screen.getByTestId("prompt-library-search"), "SEO");
    await waitFor(() => expect(screen.queryByText("Kapitel umschreiben")).not.toBeInTheDocument());
    expect(screen.getByText("SEO Optimierung")).toBeInTheDocument();
  });

  it("Kategorie-Filter schraenkt die Liste ein", async () => {
    const user = userEvent.setup();
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    await user.click(screen.getByTestId("prompt-library-filter-marketing"));
    expect(screen.queryByText("Kapitel umschreiben")).not.toBeInTheDocument();
    expect(screen.getByText("SEO Optimierung")).toBeInTheDocument();
    expect(screen.getByText("Marketing Text")).toBeInTheDocument();
  });

  it("Favorit-Stern toggelt und Favoriten-Filter zeigt nur Favoriten", async () => {
    const user = userEvent.setup();
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    const star = screen.getByTestId("prompt-library-fav-kapitel-umschreiben");
    expect(star).toHaveTextContent("☆");
    await user.click(star);
    await waitFor(() => expect(screen.getByTestId("prompt-library-fav-kapitel-umschreiben")).toHaveTextContent("★"));
    await user.click(screen.getByTestId("prompt-library-filter-favorites"));
    expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument();
    expect(screen.queryByText("SEO Optimierung")).not.toBeInTheDocument();
  });

  it("Verwenden-Button reicht den Prompttext per onUse weiter", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<PromptLibraryPanel onUse={onUse} />);
    await waitFor(() => expect(screen.getByText("Korrekturlesen")).toBeInTheDocument());
    const useBtn = screen.getByTestId("prompt-library-use-korrekturlesen");
    await user.click(useBtn);
    expect(onUse).toHaveBeenCalledOnce();
    expect(onUse.mock.calls[0][0]).toContain("Korrektur");
    // Nutzung wurde gezaehlt.
    await waitFor(() =>
      expect(screen.getByTestId("prompt-library-usage-korrekturlesen")).toHaveTextContent("1× verwendet"),
    );
  });

  it("Neu-Button oeffnet Formular und speichert einen Prompt", async () => {
    const user = userEvent.setup();
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    await user.click(screen.getByTestId("prompt-library-new"));
    expect(screen.getByTestId("prompt-library-form")).toBeInTheDocument();
    await user.type(screen.getByTestId("prompt-library-form-name"), "Mein Testprompt");
    await user.type(screen.getByTestId("prompt-library-form-description"), "Beschreibung fuer den Test");
    await user.type(screen.getByTestId("prompt-library-form-prompt"), "Mache etwas Gutes mit dem Text");
    await user.click(screen.getByTestId("prompt-library-submit"));
    await waitFor(() => expect(screen.getByText("Mein Testprompt")).toBeInTheDocument());
  });

  it("Loeschen-Button entfernt eine Karte", async () => {
    const user = userEvent.setup();
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Marketing Text")).toBeInTheDocument());
    await user.click(screen.getByTestId("prompt-library-del-marketing-text"));
    await waitFor(() => expect(screen.queryByText("Marketing Text")).not.toBeInTheDocument());
  });

  it("jede Karte zeigt Beschreibung und Tags", async () => {
    render(<PromptLibraryPanel />);
    await waitFor(() => expect(screen.getByText("Kapitel umschreiben")).toBeInTheDocument());
    const card = screen.getByTestId("prompt-library-card-kapitel-umschreiben");
    expect(within(card).getByTestId("prompt-library-desc-kapitel-umschreiben")).toBeInTheDocument();
    expect(within(card).getByTestId("prompt-library-tags-kapitel-umschreiben")).toHaveTextContent("#rewrite");
  });
});
