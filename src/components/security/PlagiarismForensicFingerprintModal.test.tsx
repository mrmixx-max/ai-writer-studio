// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlagiarismForensicFingerprintModal } from "./PlagiarismForensicFingerprintModal";

describe("PlagiarismForensicFingerprintModal", () => {
  it("rendert ohne Fehler", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByTestId("forensic-fingerprint-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByText(/Forensischer Plagiats- & Stil-Fingerabdruck/)).toBeInTheDocument();
  });

  it("zeigt den Ähnlichkeits-Index und den Befund", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getAllByText(/ÄHNLICHKEIT/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Befund:/).length).toBeGreaterThan(0);
  });

  it("zeigt die drei Ähnlichkeits-Indikatoren", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getAllByText(/Syntaktische DNA/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Rhythmus \(Satzlängen\)/)).toBeInTheDocument();
    expect(screen.getByText(/^Vokabular$/)).toBeInTheDocument();
  });

  it("zeigt beide Stil-Fingerabdrücke", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByText(/STIL-FINGERABDRÜCKE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Referenz/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verdacht/).length).toBeGreaterThan(0);
  });

  it("zeigt die gemeinsamen syntaktischen Muster", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByText(/GEMEINSAME SYNTAKTISCHE MUSTER/)).toBeInTheDocument();
  });

  it("zeigt das gerichtsfeste Gutachten mit Befunden", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByText(/GERICHTFESTES GUTACHTEN/)).toBeInTheDocument();
    expect(screen.getByText(/Syntaktische DNA: \d+ von \d+ Signaturmustern/)).toBeInTheDocument();
  });

  it("bietet beide Textfelder", () => {
    render(<PlagiarismForensicFingerprintModal />);
    expect(screen.getByText(/Referenztext \(Original\)/)).toBeInTheDocument();
    expect(screen.getByText(/Verdachtstext/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<PlagiarismForensicFingerprintModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
