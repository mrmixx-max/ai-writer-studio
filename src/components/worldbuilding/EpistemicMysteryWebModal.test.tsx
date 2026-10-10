// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EpistemicMysteryWebModal } from "./EpistemicMysteryWebModal";

describe("EpistemicMysteryWebModal", () => {
  it("rendert ohne Fehler", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByTestId("epistemic-mystery-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByText(/4-Schichten-Krimi-Matrix & Fair-Play-Detektor/)).toBeInTheDocument();
  });

  it("listet alle vier epistemischen Schichten", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getAllByText(/Objektive Wahrheit/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ermittler-Wissen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Leser-Sicht/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Täter-Täuschung/).length).toBeGreaterThan(0);
  });

  it("zeigt das Fair-Play-Verdikt", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByText(/FAIR PLAY — DER FALL IST LÖSBAR/)).toBeInTheDocument();
  });

  it("listet die Knox'schen Gebote", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByText(/FAIR-PLAY-PRÜFUNG/)).toBeInTheDocument();
    expect(screen.getAllByText(/Der Täter muss früh auftreten/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kein ungenannter Beweis im Finale/).length).toBeGreaterThan(0);
  });

  it("zeigt Hinweise und falsche Fährten", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByText(/HINWEISE & FALSCHE FÄHRTEN/)).toBeInTheDocument();
    expect(screen.getAllByText(/falsche Fährte/).length).toBeGreaterThan(0);
  });

  it("zeigt die Finalbeweis-Auswahl", () => {
    render(<EpistemicMysteryWebModal />);
    expect(screen.getByText(/FINALBEWEISE AUSWÄHLEN/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<EpistemicMysteryWebModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
