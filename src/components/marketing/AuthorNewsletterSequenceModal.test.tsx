// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthorNewsletterSequenceModal } from "./AuthorNewsletterSequenceModal";

describe("AuthorNewsletterSequenceModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AuthorNewsletterSequenceModal />);
    expect(screen.getByTestId("author-newsletter-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AuthorNewsletterSequenceModal />);
    expect(screen.getByText(/Autoren-Newsletter- & Launch-Sequenz/)).toBeInTheDocument();
  });

  it("listet alle fünf E-Mail-Schritte", () => {
    render(<AuthorNewsletterSequenceModal />);
    expect(screen.getAllByText(/Willkommen & Reader-Magnet/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Die Entstehungsgeschichte/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cover-Reveal & Exklusiver Vorverkauf/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Der Veröffentlichungstag/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lese-Runde & Rezensions-Bitte/).length).toBeGreaterThan(0);
  });

  it("zeigt den Betreffzeilen-Splitter", () => {
    render(<AuthorNewsletterSequenceModal />);
    expect(screen.getByText(/BETREFFZEILEN-SPLITTER/)).toBeInTheDocument();
    expect(screen.getAllByText(/★ /).length).toBeGreaterThan(0);
  });

  it("zeigt die Vorschau", () => {
    render(<AuthorNewsletterSequenceModal />);
    expect(screen.getByText(/VORSCHAU/)).toBeInTheDocument();
    expect(screen.getAllByText(/Tag \+0:/).length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<AuthorNewsletterSequenceModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
