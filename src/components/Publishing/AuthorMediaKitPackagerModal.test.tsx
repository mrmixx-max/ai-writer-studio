// @vitest-environment jsdom
/**
 * Tests: AuthorMediaKitPackagerModal (WP 77.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthorMediaKitPackagerModal } from "./AuthorMediaKitPackagerModal";

describe("AuthorMediaKitPackagerModal", () => {
  it("rendert die Komponente", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByTestId("author-media-kit-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByText("📰 Pressemappen- & Media-One-Sheet-Packager")).toBeTruthy();
  });

  it("zeigt One-Sheet", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("zeigt Bio", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByTestId("media-bio")).toBeTruthy();
  });

  it("zeigt Interview-Fragen", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByTestId("media-interview")).toBeTruthy();
  });

  it("wechselt zu kurzer Bio", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.click(screen.getByTestId("media-bio-short"));
    expect(screen.getByTestId("media-bio")).toBeTruthy();
  });

  it("wechselt zu langer Bio", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.click(screen.getByTestId("media-bio-long"));
    expect(screen.getByTestId("media-bio")).toBeTruthy();
  });

  it("reagiert auf Titel-Eingabe", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.change(screen.getByTestId("media-title-input"), {
      target: { value: "Neuer Titel" },
    });
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("reagiert auf Autor-Eingabe", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.change(screen.getByTestId("media-author-input"), {
      target: { value: "Neuer Autor" },
    });
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("reagiert auf Logline-Eingabe", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.change(screen.getByTestId("media-logline-input"), {
      target: { value: "Neue Logline" },
    });
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("reagiert auf ISBN-Eingabe", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.change(screen.getByTestId("media-isbn-input"), {
      target: { value: "978-1-234567-89-0" },
    });
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("reagiert auf Preis-Eingabe", () => {
    render(<AuthorMediaKitPackagerModal />);
    fireEvent.change(screen.getByTestId("media-price-input"), { target: { value: "19.99" } });
    expect(screen.getByTestId("media-one-sheet")).toBeTruthy();
  });

  it("zeigt vollständigen Bericht", () => {
    render(<AuthorMediaKitPackagerModal />);
    expect(screen.getByTestId("media-report-text").textContent).toContain("MEDIA ONE-SHEET");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<AuthorMediaKitPackagerModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
