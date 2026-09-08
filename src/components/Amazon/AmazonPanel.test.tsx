// @vitest-environment jsdom
// Component-Test für AmazonPanel: zeigt „nicht konfiguriert“ ohne Credentials.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmazonPanel } from "./AmazonPanel";

describe("AmazonPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("zeigt 'Amazon API nicht konfiguriert' mit Verweis auf Einstellungen", () => {
    render(<AmazonPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent("Amazon API nicht konfiguriert");
    expect(screen.getByRole("button", { name: "Zu den Einstellungen" })).toBeInTheDocument();
  });

  it("zeigt die Watchlist und das Suchfeld", () => {
    render(<AmazonPanel />);
    expect(screen.getByLabelText("Buchsuche")).toBeInTheDocument();
    expect(screen.getByText("Noch keine ASINs überwacht.")).toBeInTheDocument();
  });
});
