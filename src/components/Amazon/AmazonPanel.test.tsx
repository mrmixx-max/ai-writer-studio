// @vitest-environment jsdom
// Component-Test für AmazonPanel: zeigt „nicht konfiguriert“ ohne Credentials.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmazonPanel } from "./AmazonPanel";

describe("AmazonPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("Preis-Reload behält erfolgreiche ASINs trotz Einzelfehler (allSettled)", async () => {
    localStorage.setItem(
      "amazon-paapi-config",
      JSON.stringify({
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "secret",
        partnerTag: "tag-21",
        region: "eu-west-1",
        marketplace: "www.amazon.de",
      }),
    );
    localStorage.setItem("amazon-watchlist", JSON.stringify(["B00OK12345", "B00FAIL999"]));
    const fetchStub = vi.fn(async (_url: unknown, opts: unknown) => {
      const body = JSON.parse((opts as { body: string }).body) as { ItemIds: string[] };
      if (body.ItemIds[0] === "B00FAIL999") {
        return { ok: false, status: 500, text: async () => "Serverfehler", json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          ItemsResult: {
            Items: [
              {
                ASIN: "B00OK12345",
                DetailPageURL: "https://www.amazon.de/dp/B00OK12345",
                ItemInfo: { Title: { DisplayValue: "Erfolgstitel" } },
                Offers: { Listings: [{ Price: { Amount: 9.99, Currency: "EUR" } }] },
              },
            ],
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    render(<AmazonPanel />);
    await user.click(screen.getByRole("button", { name: "Preise aktualisieren" }));

    // Erfolgreiche ASIN bleibt sichtbar, Fehler wird benannt
    expect(await screen.findByText(/Erfolgstitel/)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/B00FAIL999/);
  });
});
