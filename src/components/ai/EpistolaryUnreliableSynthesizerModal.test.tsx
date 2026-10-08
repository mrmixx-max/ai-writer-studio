// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EpistolaryUnreliableSynthesizerModal } from "@/components/ai/EpistolaryUnreliableSynthesizerModal";

describe("EpistolaryUnreliableSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByTestId("epistolary-unreliable-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/Unzuverlässiger Briefroman- & Tagebuch-Synthesizer/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByDisplayValue("Dr. Viktor Halsh")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Zukünftiges Ich")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
    expect(screen.getByText(/Feldtagebuch \(Wahnsinn\/Paranoia\)/)).toBeInTheDocument();
  });

  it("zeigt Verborgene-Wahrheit Textarea", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByDisplayValue(/Das Experiment ist außer Kontrolle/)).toBeInTheDocument();
  });

  it("zeigt generiertes Dokument", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/Generiertes Dokument \(ID:/)).toBeInTheDocument();
  });

  it("zeigt Ironie-Marker", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/EPISTEMISCHE IRONIE-MARKER/)).toBeInTheDocument();
  });

  it("zeigt Beispiel-Szenarien", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/BEISPIEL LADEN/)).toBeInTheDocument();
  });

  it("erklärt epistemische Ironie", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/THEORETISCHER HINTERGRUND: EPISTEMISCHE IRONIE/)).toBeInTheDocument();
  });

  it("listet vier Dokument-Archetypen", () => {
    render(<EpistolaryUnreliableSynthesizerModal />);
    expect(screen.getByText(/Feldtagebuch \(Wahnsinn\/Paranoia\)/)).toBeInTheDocument();
    expect(screen.getByText(/Diplomatisches Schreiben \(Erpressung\/Höflichkeit\)/)).toBeInTheDocument();
    expect(screen.getByText(/Verhör-Protokoll \(Halbwahrheiten\/Alibi\)/)).toBeInTheDocument();
    expect(screen.getByText(/Letzter Beichtbrief \(Selbstrechtfertigung\)/)).toBeInTheDocument();
  });
});