// @vitest-environment jsdom
// Component-Tests für NewspaperPreview.tsx (Sprint 16, Agent 6):
// Render, Seitennavigation, Print-Trigger, Sprach-Toggle.
// Struktur angelehnt an Images/ImageGenPanel.test.tsx (render + user-event).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewspaperPreview, type NewspaperArticle } from "./NewspaperPreview";

const ARTICLES: NewspaperArticle[] = [
  {
    id: "a1",
    headline: "Schlagzeile Eins",
    headlineEn: "Headline One",
    body: "Text eins auf Deutsch.",
    bodyEn: "Text one in English.",
    imageUrl: "data:image/png;base64,花的",
    imageAlt: "Bild eins",
  },
  {
    id: "a2",
    headline: "Schlagzeile Zwei",
    headlineEn: "Headline Two",
    body: "Text zwei auf Deutsch.",
    bodyEn: "Text two in English.",
  },
  {
    id: "a3",
    headline: "Schlagzeile Drei",
    headlineEn: "Headline Three",
    body: "Text drei auf Deutsch.",
    bodyEn: "Text three in English.",
  },
];

describe("NewspaperPreview", () => {
  it("rendert Titel, Artikel und Bedienelemente", () => {
    render(<NewspaperPreview articles={ARTICLES} articlesPerPage={2} />);
    expect(screen.getByTestId("newspaper-preview")).toBeInTheDocument();
    expect(screen.getByTestId("newspaper-title")).toHaveTextContent("Tageszeitung");
    expect(screen.getByTestId("newspaper-article-a1")).toBeInTheDocument();
    expect(screen.getByTestId("newspaper-print")).toBeInTheDocument();
    expect(screen.getByTestId("newspaper-prev")).toBeInTheDocument();
    expect(screen.getByTestId("newspaper-next")).toBeInTheDocument();
  });

  it("zeigt leeren Zustand ohne Artikel", () => {
    render(<NewspaperPreview articles={[]} />);
    expect(screen.getByTestId("newspaper-empty")).toHaveTextContent("Keine Artikel");
  });

  it("Seitennavigation: Weiter zeigt nächste Seite, Zurück kehrt zurück", async () => {
    const user = userEvent.setup();
    render(<NewspaperPreview articles={ARTICLES} articlesPerPage={2} />);
    expect(screen.getByTestId("newspaper-page-indicator")).toHaveTextContent("Seite 1 von 2");
    expect(screen.queryByTestId("newspaper-article-a3")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("newspaper-next"));
    expect(screen.getByTestId("newspaper-page-indicator")).toHaveTextContent("Seite 2 von 2");
    expect(screen.getByTestId("newspaper-article-a3")).toBeInTheDocument();
    await user.click(screen.getByTestId("newspaper-prev"));
    expect(screen.getByTestId("newspaper-page-indicator")).toHaveTextContent("Seite 1 von 2");
    expect(screen.getByTestId("newspaper-article-a1")).toBeInTheDocument();
  });

  it("deaktiviert Prev auf erster und Next auf letzter Seite", async () => {
    const user = userEvent.setup();
    render(<NewspaperPreview articles={ARTICLES} articlesPerPage={2} />);
    expect(screen.getByTestId("newspaper-prev")).toBeDisabled();
    await user.click(screen.getByTestId("newspaper-next"));
    expect(screen.getByTestId("newspaper-next")).toBeDisabled();
  });

  it("Print-Button ruft window.print() auf", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<NewspaperPreview articles={ARTICLES} />);
    await user.click(screen.getByTestId("newspaper-print"));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("Print-Button ruft onPrint-Callback statt window.print auf", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<NewspaperPreview articles={ARTICLES} onPrint={onPrint} />);
    await user.click(screen.getByTestId("newspaper-print"));
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(printSpy).not.toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("Sprach-Toggle wechselt Inhalte zu Englisch und zurück", async () => {
    const user = userEvent.setup();
    render(<NewspaperPreview articles={ARTICLES} articlesPerPage={3} />);
    expect(screen.getByTestId("newspaper-headline-a1")).toHaveTextContent("Schlagzeile Eins");
    await user.click(screen.getByTestId("newspaper-lang-toggle"));
    expect(screen.getByTestId("newspaper-headline-a1")).toHaveTextContent("Headline One");
    expect(screen.getByTestId("newspaper-body-a1")).toHaveTextContent("Text one in English.");
    expect(screen.getByTestId("newspaper-title")).toHaveTextContent("Daily Newspaper");
    await user.click(screen.getByTestId("newspaper-lang-toggle"));
    expect(screen.getByTestId("newspaper-headline-a1")).toHaveTextContent("Schlagzeile Eins");
  });

  it("DE/EN-Direktbuttons setzen die Sprache gezielt", async () => {
    const user = userEvent.setup();
    render(
      <NewspaperPreview articles={ARTICLES} articlesPerPage={3} initialLanguage="en" />,
    );
    expect(screen.getByTestId("newspaper-headline-a2")).toHaveTextContent("Headline Two");
    await user.click(screen.getByTestId("newspaper-lang-de"));
    expect(screen.getByTestId("newspaper-headline-a2")).toHaveTextContent("Schlagzeile Zwei");
    await user.click(screen.getByTestId("newspaper-lang-en"));
    expect(screen.getByTestId("newspaper-headline-a2")).toHaveTextContent("Headline Two");
  });

  it("rendert Artikelbilder mit Alt-Text", () => {
    render(<NewspaperPreview articles={ARTICLES} articlesPerPage={3} />);
    const img = screen.getByTestId("newspaper-image-a1") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("data:image");
    expect(img.getAttribute("alt")).toBe("Bild eins");
  });
});
