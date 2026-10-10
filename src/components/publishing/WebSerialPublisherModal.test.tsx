// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebSerialPublisherModal } from "./WebSerialPublisherModal";

describe("WebSerialPublisherModal", () => {
  it("rendert ohne Fehler", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByTestId("web-serial-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByText(/Web-Serial- & Royal-Road-Studio/)).toBeInTheDocument();
  });

  it("listet alle vier Plattformen", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getAllByText(/Royal Road/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wattpad/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Substack/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Patreon/).length).toBeGreaterThan(0);
  });

  it("zeigt das LitRPG-Statusfenster", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByText(/LITRPG-STATUSFENSTER/)).toBeInTheDocument();
  });

  it("zeigt den Patreon-Cliffhanger-Score", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByText(/PATREON-CLIFFHANGER-SCORE:/)).toBeInTheDocument();
    expect(screen.getByText(/Offenheit:/)).toBeInTheDocument();
  });

  it("zeigt den Plattform-Export", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByText(/1-KLICK-PLATTFORM-EXPORT/)).toBeInTheDocument();
    expect(screen.getByText(/Markdown:/)).toBeInTheDocument();
  });

  it("zeigt den Serial-Bericht", () => {
    render(<WebSerialPublisherModal />);
    expect(screen.getByText(/SERIAL-BERICHT/)).toBeInTheDocument();
    expect(screen.getByText(/Gesamtwortzahl:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<WebSerialPublisherModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
