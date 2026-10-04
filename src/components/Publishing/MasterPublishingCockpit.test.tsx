// @vitest-environment jsdom
/**
 * Tests: MasterPublishingCockpit (WP 43.2 — 1-Klick-Publisher)
 */


import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MasterPublishingCockpit } from "./MasterPublishingCockpit";
import type { PublishingProject } from "@/services/publishing/masterPublishingService";

const PROJECT: PublishingProject = {
  title: "Testbuch",
  author: "Testautor",
  chapters: [
    { id: "c1", title: "Kapitel 1", content: "Ein Held zog aus. Es wurde beschlossen, dass er kämpft." },
    { id: "c2", title: "Kapitel 2", content: "Der Kampf begann." },
  ],
  isbn: "9783161484100",
  price: 19.99,
  language: "de",
};

describe("MasterPublishingCockpit", () => {
  it("rendert das Cockpit", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    expect(screen.getByTestId("master-publishing-cockpit")).toBeTruthy();
  });

  it("zeigt Buchtitel und Kapitelzahl", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    const text = screen.getByTestId("master-publishing-cockpit").textContent ?? "";
    expect(text).toContain("Testbuch");
    expect(text).toContain("2 Kapitel");
  });

  it("hat Preflight- und Bundle-Button", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    expect(screen.getByTestId("cockpit-preflight")).toBeTruthy();
    expect(screen.getByTestId("cockpit-build")).toBeTruthy();
  });

  it("Bundle-Button ist ohne Preflight deaktiviert", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    expect((screen.getByTestId("cockpit-build") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Preflight zeigt Urteil", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    fireEvent.click(screen.getByTestId("cockpit-preflight"));
    expect(screen.getByTestId("cockpit-verdict")).toBeTruthy();
  });

  it("Preflight zeigt Prüfungsanzahl und Reife", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    fireEvent.click(screen.getByTestId("cockpit-preflight"));
    const text = screen.getByTestId("cockpit-preflight-result").textContent ?? "";
    expect(text).toMatch(/Prüfungen/);
    expect(text).toMatch(/Reife/);
  });

  it("Bundle-Button wird nach Preflight aktiv", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    fireEvent.click(screen.getByTestId("cockpit-preflight"));
    expect((screen.getByTestId("cockpit-build") as HTMLButtonElement).disabled).toBe(false);
  });

  it("Bundle-Schnüren erzeugt Dateiliste", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    fireEvent.click(screen.getByTestId("cockpit-preflight"));
    fireEvent.click(screen.getByTestId("cockpit-build"));
    expect(screen.getByTestId("cockpit-bundle")).toBeTruthy();
    expect(screen.getByTestId("cockpit-bundle-files")).toBeTruthy();
  });

  it("ruft onBundleReady beim Fertigstellen", () => {
    const onReady = vi.fn();
    render(<MasterPublishingCockpit project={PROJECT} onBundleReady={onReady} />);
    fireEvent.click(screen.getByTestId("cockpit-preflight"));
    fireEvent.click(screen.getByTestId("cockpit-build"));
    expect(onReady).toHaveBeenCalled();
  });

  it("zeigt Hinweis vor dem ersten Preflight", () => {
    render(<MasterPublishingCockpit project={PROJECT} />);
    expect(screen.getByTestId("master-publishing-cockpit").textContent).toContain(
      "Starte den Preflight",
    );
  });

  it("kommt mit leerem Projekt zurecht", () => {
    render(<MasterPublishingCockpit project={{ title: "Leer", author: "", chapters: [] }} />);
    expect(screen.getByTestId("master-publishing-cockpit")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<MasterPublishingCockpit project={PROJECT} />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
