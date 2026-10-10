// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RedactedDossierStudioModal } from "./RedactedDossierStudioModal";

describe("RedactedDossierStudioModal", () => {
  it("rendert ohne Fehler", () => {
    render(<RedactedDossierStudioModal />);
    expect(screen.getByTestId("redacted-dossier-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<RedactedDossierStudioModal />);
    expect(screen.getByText(/Streng-Geheim-Dossier & Schwärzungs-Studio/)).toBeInTheDocument();
  });

  it("zeigt Schwärzung", () => {
    render(<RedactedDossierStudioModal />);
    expect(screen.getByText(/SCHWÄRZUNG/)).toBeInTheDocument();
  });

  it("zeigt Dienst-Stempel", () => {
    render(<RedactedDossierStudioModal />);
    expect(screen.getByText(/DIENST-STEMPEL/)).toBeInTheDocument();
  });

  it("zeigt Dossier-Export", () => {
    render(<RedactedDossierStudioModal />);
    expect(screen.getByText(/DOSSIER-EXPORT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<RedactedDossierStudioModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
