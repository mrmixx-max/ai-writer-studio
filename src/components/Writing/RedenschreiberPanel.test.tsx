// @vitest-environment jsdom
// Component-Tests: RedenschreiberPanel — KI-Rede-Generator + Redetexte.
// useI18n hat einen de-Fallback ohne Provider; Stores laufen mit Real-State.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RedenschreiberPanel } from "./RedenschreiberPanel";

describe("RedenschreiberPanel: KI-Rede + Redetexte", () => {
  it("rendert Transkription, KI-Generator und Vorlagen", () => {
    render(<RedenschreiberPanel />);
    expect(screen.getByTestId("redenschreiber")).toBeInTheDocument();
    expect(screen.getByTestId("rs-compose")).toBeInTheDocument();
    expect(screen.getByTestId("rs-templates")).toBeInTheDocument();
    expect(screen.getByText("Rede schreiben (KI)")).toBeInTheDocument();
    expect(screen.getByText("Redetexte (Musterreden)")).toBeInTheDocument();
  });

  it("KI-Formular hat Anlass, Publikum, Funktion, Ton, Dauer, Kernpunkte", () => {
    render(<RedenschreiberPanel />);
    expect(screen.getByPlaceholderText(/Wahlkampfauftakt/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Bürgerinnen/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Bürgermeisterin/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Kernpunkt pro Zeile/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Gegenargument pro Zeile/),
    ).toBeInTheDocument();
    // 7 Töne inkl. staatstragend
    const toneSelect = screen.getByTestId("rs-compose").querySelectorAll("select")[0];
    expect(toneSelect?.querySelectorAll("option").length).toBe(7);
  });

  it("Vorlagen-Auswahl zeigt politische Reden, Vorschau per Auswahl", () => {
    render(<RedenschreiberPanel />);
    const tplSelect = screen.getByTestId("rs-templates").querySelector("select");
    expect(tplSelect).toBeInTheDocument();
    const options = [...(tplSelect?.querySelectorAll("option") ?? [])].map(
      (o) => o.textContent,
    );
    expect(options.some((o) => o?.includes("Wahlkampf"))).toBe(true);
    expect(options.some((o) => o?.includes("Parlament") || o?.includes("Haushalt"))).toBe(true);

    fireEvent.change(tplSelect!, { target: { value: "wahlkampf-auftakt" } });
    expect(screen.getByTestId("rs-template-preview")).toBeInTheDocument();
    expect(screen.getByTestId("rs-template-preview")).toHaveTextContent(
      /Richtungsentscheidung/,
    );
  });

  it("Vorlese-Buttons für KI-Output und Vorlage vorhanden", () => {
    render(<RedenschreiberPanel />);
    const tplSelect = screen.getByTestId("rs-templates").querySelector("select");
    fireEvent.change(tplSelect!, { target: { value: "wahlkampf-auftakt" } });
    // Vorlage: Vorlesen-Button erscheint mit Auswahl
    expect(screen.getByRole("button", { name: "Vorlesen" })).toBeInTheDocument();
  });
});
