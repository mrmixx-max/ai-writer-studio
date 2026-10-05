// @vitest-environment jsdom
/**
 * Tests: LiteraryGrantPackager (WP 51.2 — Literatur-Stipendien- & Jury-Dossier)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiteraryGrantPackager } from "./LiteraryGrantPackager";

describe("LiteraryGrantPackager", () => {
  it("rendert den Packager", () => {
    render(<LiteraryGrantPackager />);
    expect(screen.getByTestId("literary-grant-packager")).toBeTruthy();
  });

  it("zeigt Grant-Profile", () => {
    render(<LiteraryGrantPackager />);
    expect(screen.getByTestId("grant-profiles")).toBeTruthy();
  });

  it("zeigt 3 Profile", () => {
    render(<LiteraryGrantPackager />);
    expect(screen.getByTestId("grant-profile-dlf")).toBeTruthy();
    expect(screen.getByTestId("grant-profile-kuk")).toBeTruthy();
    expect(screen.getByTestId("grant-profile-hbs")).toBeTruthy();
  });

  it("Leseprobe wird gerendert", () => {
    render(<LiteraryGrantPackager />);
    expect(screen.getByTestId("grant-sample-output")).toBeTruthy();
  });

  it("Zeilennummern sind standardmäßig aktiv", () => {
    render(<LiteraryGrantPackager />);
    expect((screen.getByTestId("grant-line-numbers") as HTMLInputElement).checked).toBe(true);
  });

  it("Zeilennummern abschaltbar", () => {
    render(<LiteraryGrantPackager />);
    fireEvent.click(screen.getByTestId("grant-line-numbers"));
    expect((screen.getByTestId("grant-line-numbers") as HTMLInputElement).checked).toBe(false);
  });

  it("Dossier-Eingaben vorhanden", () => {
    render(<LiteraryGrantPackager />);
    expect(screen.getByTestId("grant-dossier-title")).toBeTruthy();
    expect(screen.getByTestId("grant-dossier-author")).toBeTruthy();
    expect(screen.getByTestId("grant-dossier-expose")).toBeTruthy();
  });

  it("Dossier-Generierung funktioniert", () => {
    render(<LiteraryGrantPackager />);
    fireEvent.click(screen.getByTestId("grant-dossier-generate"));
    expect(screen.getByTestId("grant-dossier-result")).toBeTruthy();
  });

  it("Dossier zeigt Sektionen", () => {
    render(<LiteraryGrantPackager />);
    fireEvent.click(screen.getByTestId("grant-dossier-generate"));
    expect(screen.getByTestId("grant-dossier-result").textContent).toContain("Sektionen");
  });

  it("Titel änderbar", () => {
    render(<LiteraryGrantPackager />);
    fireEvent.change(screen.getByTestId("grant-dossier-title"), {
      target: { value: "Neuer Titel" },
    });
    fireEvent.click(screen.getByTestId("grant-dossier-generate"));
    expect(screen.getByTestId("grant-dossier-result").textContent).toContain("Neuer Titel");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<LiteraryGrantPackager />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
