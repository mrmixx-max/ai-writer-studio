// @vitest-environment jsdom
/** Tests: SomaticBiomechanicsEngineModal (WP 92.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SomaticBiomechanicsEngineModal } from "./SomaticBiomechanicsEngineModal";

describe("SomaticBiomechanicsEngineModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("somatic-biomechanics-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByText(/Somatische Biomechanik/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByDisplayValue("Duell bei Sonnenaufgang")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Somatisches Profil", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("summary-somatic-profil")).toBeInTheDocument();
  });

  it("zeigt Injektion Mental → Somatisch", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("summary-injektion")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Szenen", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("summary-beispiel-szenen")).toBeInTheDocument();
  });

  it("erklärt 4 vegetative Zustände", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("summary-vegetative-zustaende")).toBeInTheDocument();
  });

  it("erklärt somatische Kaskaden-Matrix", () => {
    render(<SomaticBiomechanicsEngineModal />);
    expect(screen.getByTestId("summary-kaskaden-matrix")).toBeInTheDocument();
  });
});