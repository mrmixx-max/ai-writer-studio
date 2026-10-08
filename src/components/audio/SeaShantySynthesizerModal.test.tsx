// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeaShantySynthesizerModal } from "./SeaShantySynthesizerModal";

describe("SeaShantySynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByTestId("sea-shanty-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByText(/Shantychor- & Spill-Arbeitslied-Synthesizer/)).toBeInTheDocument();
  });

  it("listet alle drei Shanty-Gattungen", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getAllByText(/Halyard Shanty/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Capstan \/ Spill Shanty/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Walfänger- & Heimweh-Ballade/).length).toBeGreaterThan(0);
  });

  it("zeigt Gattung mit Zweck und Takt", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByText(/GATTUNG:/)).toBeInTheDocument();
    expect(screen.getByText(/Zweck:/)).toBeInTheDocument();
    expect(screen.getByText(/Akzente auf Zählzeit:/)).toBeInTheDocument();
  });

  it("zeigt Verse mit Shantyman und Chor", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByText(/VERS & KEHRREIM/)).toBeInTheDocument();
    expect(screen.getAllByText(/Chor:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Shantyman:/).length).toBeGreaterThan(0);
  });

  it("zeigt das Taktschlag-Schema", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByText(/TAKTSCHLAG-SCHEMA/)).toBeInTheDocument();
    expect(screen.getByText(/Muster \[/)).toBeInTheDocument();
  });

  it("zeigt den WebAudio-Rhythmus-Player", () => {
    render(<SeaShantySynthesizerModal />);
    expect(screen.getByText(/WEBAUDIO-RHYTHMUS-PLAYER/)).toBeInTheDocument();
    expect(screen.getByText(/Taktschlag:/)).toBeInTheDocument();
    expect(screen.getByText(/Chor-Pegel:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<SeaShantySynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
