// @vitest-environment jsdom
// Component-Tests: PrintPreflightPanel — Typografie, Schusterjungen/Hurenkinder,
// Titelei (Titelblatt + Impressum).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintPreflightPanel } from "./PrintPreflightPanel";

const TEXT_WITH_ISSUES = 'Er sagte "Hallo" - und ging.\nEin langer erster Satz hier.\nNur';
const TEXT_CLEAN = "Er sagte „Hallo“ – und ging. Alles ist sauber gesetzt.";

describe("PrintPreflightPanel", () => {
  it("rendert das Panel und die drei Sektionen", () => {
    render(<PrintPreflightPanel />);
    expect(screen.getByTestId("print-preflight-panel")).toBeTruthy();
    expect(screen.getByTestId("print-preflight-typography")).toBeTruthy();
    expect(screen.getByTestId("print-preflight-widow-orphan")).toBeTruthy();
    expect(screen.getByTestId("print-preflight-titlelei")).toBeTruthy();
  });

  it("zeigt den Hinweis bei leerem Text", () => {
    render(<PrintPreflightPanel text="" />);
    expect(screen.getByTestId("print-preflight-typography-empty")).toBeTruthy();
    expect(screen.getByTestId("print-preflight-widow-orphan-empty")).toBeTruthy();
  });

  it("listet typografische Befunde (Anführungszeichen + Gedankenstrich)", () => {
    render(<PrintPreflightPanel text={TEXT_WITH_ISSUES} />);
    const list = screen.getByTestId("print-preflight-typography-list");
    expect(list).toBeTruthy();
    const types = Array.from(
      list.querySelectorAll("[data-issue-type]"),
    ).map((el) => el.getAttribute("data-issue-type"));
    expect(types).toContain("quotation_mark");
    expect(types).toContain("dash");
  });

  it("meldet korrekten Text als sauber", () => {
    render(<PrintPreflightPanel text={TEXT_CLEAN} />);
    expect(screen.getByTestId("print-preflight-typography-clean")).toBeTruthy();
  });

  it("listet Schusterjungen/Hurenkinder mit Typ und Zeile", () => {
    render(<PrintPreflightPanel text={TEXT_WITH_ISSUES} />);
    const list = screen.getByTestId("print-preflight-widow-orphan-list");
    expect(list).toBeTruthy();
    const first = screen.getByTestId("print-preflight-widow-orphan-0");
    expect(first.textContent).toContain("Schusterjunge");
    expect(first.textContent).toContain("Zeile 3");
    expect(first.getAttribute("data-issue-type")).toBe("widow");
  });

  it("zeigt die Zusammenfassung mit Zählern", () => {
    render(<PrintPreflightPanel text={TEXT_WITH_ISSUES} />);
    const summary = screen.getByTestId("print-preflight-summary").textContent ?? "";
    expect(summary).toContain("typografische Befunde");
    expect(summary).toContain("Satzfehler");
  });

  it("erzeugt das Titelblatt aus den Eingaben", async () => {
    const user = userEvent.setup();
    render(<PrintPreflightPanel title="Mein Buch" author="Max Mustermann" />);
    await user.click(screen.getByTestId("print-preflight-generate-title"));
    const out = screen.getByTestId("print-preflight-title-page-output");
    expect(out.textContent).toBe("Mein Buch\n\nvon Max Mustermann");
  });

  it("erzeugt das Impressum aus den Eingaben", async () => {
    const user = userEvent.setup();
    render(
      <PrintPreflightPanel title="Mein Buch" author="Max Mustermann" year={2026} />,
    );
    await user.click(screen.getByTestId("print-preflight-generate-impressum"));
    const out = screen.getByTestId("print-preflight-impressum-output").textContent ?? "";
    expect(out).toContain("Impressum");
    expect(out).toContain("© 2026 Max Mustermann");
    expect(out).toContain("§ 5 DDG");
    expect(out).toContain("EU-Richtlinien-Hinweis");
  });

  it("übernimmt Eingaben in die Titelei-Ausgabe", async () => {
    const user = userEvent.setup();
    render(<PrintPreflightPanel />);
    await user.type(screen.getByTestId("print-preflight-input-title"), "Neu");
    await user.type(screen.getByTestId("print-preflight-input-author"), "Autor X");
    await user.click(screen.getByTestId("print-preflight-generate-title"));
    expect(screen.getByTestId("print-preflight-title-page-output").textContent).toBe(
      "Neu\n\nvon Autor X",
    );
  });

  it("rendert mit className prop", () => {
    render(<PrintPreflightPanel className="custom-class" />);
    expect(screen.getByTestId("print-preflight-panel").className).toContain("custom-class");
  });
});
