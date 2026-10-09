// @vitest-environment jsdom
/** Tests: DialectIsoglossWeaverModal (WP 133.1 / Meilenstein 64.0 / v7.6.0) */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DialectIsoglossWeaverModal } from "./DialectIsoglossWeaverModal";

describe("DialectIsoglossWeaverModal", () => {
  it("rendert ohne Fehler", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(screen.getByTestId("dialect-isogloss-modal")).toBeInTheDocument();
  });

  it("zeigt den Titel", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(
      screen.getByText(/Dialekt-Isoglossen- & Akzent-Weaver/),
    ).toBeInTheDocument();
  });

  it("zeigt DIALEKTREGIONEN", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(screen.getByTestId("dialect-regions")).toBeInTheDocument();
    expect(screen.getByText(/DIALEKTREGIONEN/)).toBeInTheDocument();
  });

  it("zeigt ISOGLOSSEN", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(screen.getByTestId("dialect-isoglosses")).toBeInTheDocument();
    expect(screen.getByText(/ISOGLOSSEN/)).toBeInTheDocument();
  });

  it("zeigt DIALOG-MODULATOR", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(screen.getByTestId("dialect-modulator")).toBeInTheDocument();
    expect(screen.getByText(/DIALOG-MODULATOR/)).toBeInTheDocument();
  });

  it("zeigt REGIONAL-METAPHER", () => {
    render(<DialectIsoglossWeaverModal />);
    expect(screen.getByTestId("dialect-metaphor")).toBeInTheDocument();
    expect(screen.getByText(/REGIONAL-METAPHER/)).toBeInTheDocument();
  });

  it("zeigt alle 4 Regionsnamen", () => {
    render(<DialectIsoglossWeaverModal />);
    const regionsSection = screen.getByTestId("dialect-regions");
    expect(within(regionsSection).getByText("Nordregion")).toBeInTheDocument();
    expect(within(regionsSection).getByText("Südregion")).toBeInTheDocument();
    expect(within(regionsSection).getByText("Bergregion")).toBeInTheDocument();
    expect(within(regionsSection).getByText("Hafenregion")).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<DialectIsoglossWeaverModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
