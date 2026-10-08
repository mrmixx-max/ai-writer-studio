// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlliterativeKenningWeaverModal } from "@/components/ai/AlliterativeKenningWeaverModal";

describe("AlliterativeKenningWeaverModal", () => {
  it("rendert ohne Fehler", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByTestId("alliterative-kenning-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/Stabreim- & Altnordischer Kenning-Weaver/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByDisplayValue("777")).toBeInTheDocument();
    expect(screen.getByText(/Krieg & Schlacht/)).toBeInTheDocument();
  });

  it("zeigt Kenningar", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/KENNINGAR \(\d+\)/)).toBeInTheDocument();
  });

  it("zeigt Stabreim-Versen", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/STABREIM-VERSE/)).toBeInTheDocument();
  });

  it("zeigt Reden & Schwüre", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/REDEN & SCHWÜRE/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Kombination", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("erklärt theoretischen Hintergrund", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/THEORETISCHER HINTERGRUND: STABREIM & KENNINGAR/)).toBeInTheDocument();
  });

  it("listet sieben Themen", () => {
    render(<AlliterativeKenningWeaverModal />);
    expect(screen.getByText(/Krieg & Schlacht/)).toBeInTheDocument();
    expect(screen.getByText(/Königtum & Thron/)).toBeInTheDocument();
    expect(screen.getByText(/Schiffe & Meer/)).toBeInTheDocument();
    expect(screen.getByText(/Tod & Jenseits/)).toBeInTheDocument();
    expect(screen.getByText(/Liebe & Treue/)).toBeInTheDocument();
    expect(screen.getByText(/Natur & Elemente/)).toBeInTheDocument();
    expect(screen.getByText(/Schicksal & Nornen/)).toBeInTheDocument();
  });
});