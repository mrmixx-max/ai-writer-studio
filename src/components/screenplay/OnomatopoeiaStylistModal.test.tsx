// @vitest-environment jsdom
/** Tests: OnomatopoeiaStylistModal (WP 91.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnomatopoeiaStylistModal } from "./OnomatopoeiaStylistModal";

describe("OnomatopoeiaStylistModal", () => {
  it("rendert ohne Fehler", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("onomatopoeia-stylist-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByText(/Comic-Soundeffekt/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByDisplayValue("Action-Comic")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Onomatopoesie-Profil", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("summary-onomatopoeia-profil")).toBeInTheDocument();
  });

  it("zeigt SFX-Tabelle", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("summary-sfx-tabelle")).toBeInTheDocument();
  });

  it("zeigt SFX-Übersetzung", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("summary-sfx-uebersetzung")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Comics", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("summary-beispiel-comics")).toBeInTheDocument();
  });

  it("zeigt Kategorien & Intensitäts-Skala", () => {
    render(<OnomatopoeiaStylistModal />);
    expect(screen.getByTestId("summary-kategorien")).toBeInTheDocument();
  });
});