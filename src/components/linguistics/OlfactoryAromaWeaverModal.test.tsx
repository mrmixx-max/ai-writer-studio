// @vitest-environment jsdom
/** Tests: OlfactoryAromaWeaverModal (WP 90.1 UI) */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OlfactoryAromaWeaverModal } from "./OlfactoryAromaWeaverModal";

describe("OlfactoryAromaWeaverModal", () => {
  it("rendert ohne Fehler", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByTestId("olfactory-aroma-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByText(/Olfaktorischer Aroma/)).toBeInTheDocument();
  });

  it("zeigt Eingabefelder", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByDisplayValue("mittelalterliche Apotheke")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("zeigt Aroma-Profil", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByTestId("summary-aroma-profil")).toBeInTheDocument();
  });

  it("zeigt Beispiel-Orte", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByTestId("summary-beispiel-orte")).toBeInTheDocument();
  });

  it("erklärt 8 Duft-Oktaven", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByTestId("summary-duft-oktaven")).toBeInTheDocument();
  });

  it("erklärt Proust-Phänomen", () => {
    render(<OlfactoryAromaWeaverModal />);
    expect(screen.getByTestId("summary-proust")).toBeInTheDocument();
  });
});