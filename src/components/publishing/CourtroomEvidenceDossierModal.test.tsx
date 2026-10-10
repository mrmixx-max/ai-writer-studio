// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourtroomEvidenceDossierModal } from "./CourtroomEvidenceDossierModal";

describe("CourtroomEvidenceDossierModal", () => {
  it("rendert ohne Fehler", () => {
    render(<CourtroomEvidenceDossierModal />);
    expect(screen.getByTestId("courtroom-evidence-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<CourtroomEvidenceDossierModal />);
    expect(screen.getByText(/Asservatenkammer & Gerichtssaal-Dossier/)).toBeInTheDocument();
  });

  it("zeigt Asservaten-Hauptbuch", () => {
    render(<CourtroomEvidenceDossierModal />);
    expect(screen.getByText(/ASSERVATEN-HAUPTBUCH/)).toBeInTheDocument();
  });

  it("zeigt Beweisverwertungs-Wächter", () => {
    render(<CourtroomEvidenceDossierModal />);
    expect(screen.getByText(/BEWEISVERWERTUNGS-WÄCHTER/)).toBeInTheDocument();
  });

  it("zeigt Gerichtsakten-Dossier", () => {
    render(<CourtroomEvidenceDossierModal />);
    expect(screen.getAllByText(/GERICHTSAKTEN-DOSSIER/).length).toBeGreaterThan(0);
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<CourtroomEvidenceDossierModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
