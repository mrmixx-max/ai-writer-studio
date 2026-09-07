// @vitest-environment jsdom
// Component-Tests: Panel-ErrorBoundary (Sprint 13, Agent 3).
// Deckt ab: catch/fallback, retry-Reset, Fehlerreport, Copy (PII-bereinigt),
// strukturiertes Logging + Console-Fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";
import { buildErrorReport } from "./errorReport";
import { getLogEntries } from "@/services/logger";

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  vi.unstubAllGlobals();
});

function Boom({ message = "Panel kaputt" }: { message?: string }) {
  throw new Error(message);
   
  return null;
}

describe("ErrorBoundary (Panel)", () => {
  it("rendert children ohne Fehler normal", () => {
    render(
      <ErrorBoundary panelName="KI-Panel">
        <span>heile Welt</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText("heile Welt")).toBeInTheDocument();
  });

  it("fängt Render-Fehler und zeigt Fallback mit role=alert + Panelname", () => {
    render(
      <ErrorBoundary panelName="KI-Panel">
        <Boom />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("KI-Panel konnte nicht geladen werden.");
    expect(alert).toHaveTextContent("Erneut versuchen");
    expect(alert).toHaveTextContent("Fehlerdetails kopieren");
  });

  it("fällt ohne panelName auf generisches „Panel“ zurück", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Panel konnte nicht geladen werden.");
  });

  it("zeigt die technische Fehlermeldung im Fallback", () => {
    render(
      <ErrorBoundary>
        <Boom message="boom-12345" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom-12345");
  });

  it("retry setzt den Fehler zurück und rendert children erneut", async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("flaky");
      return <span>wieder da</span>;
    }
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => {
      shouldThrow = false;
    });
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(screen.getByText("wieder da")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("protokolliert den Crash im strukturierten Logger", () => {
    render(
      <ErrorBoundary>
        <Boom message="log-check-xyz" />
      </ErrorBoundary>,
    );
    const entries = getLogEntries(200);
    const hit = entries.find(
      (e) => e.context === "errorboundary/panel" && e.message.includes("log-check-xyz"),
    );
    expect(hit).toBeDefined();
  });

  it("kopiert PII-bereinigte Fehlerdetails und bestätigt mit „Kopiert!\"", async () => {
    const writeText = vi.fn(async (_t: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <ErrorBoundary panelName="KI-Panel">
        <Boom message="Absturz in C:\\Users\\webma\\Panel.tsx:3" />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fehlerdetails kopieren" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied: string = writeText.mock.calls[0][0];
    expect(copied).toContain("AI Writer Studio — Fehlerdetails");
    expect(copied).toContain("Version:");
    expect(copied).toContain("Plattform:");
    // Keine PII im kopierten Bericht:
    expect(copied).not.toContain("webma");
    expect(copied).not.toContain("C:\\Users\\webma");
    expect(await screen.findByRole("button", { name: "Kopiert!" })).toBeInTheDocument();
  });

  it("hält den strukturierten Report-Blob PII-frei (message, componentStack, Log-Tail)", () => {
    render(
      <ErrorBoundary>
        <Boom message="Fehler bei C:\\Users\\webma\\geheim\\Panel.tsx" />
      </ErrorBoundary>,
    );
    // Die technische Meldung zeigt error.message roh — der Boundary-Report
    // (copy) ist sanitisiert; hier darf der Pfad stehen (lokale Anzeige),
    // der strukturierte Report-Blob muss PII-frei sein:
    const report = buildErrorReport({
      message: "Fehler bei C:\\Users\\webma\\geheim\\Panel.tsx",
      recentLogs: ["[info] geladen von /home/webma/data.db"],
    });
    expect(JSON.stringify(report)).not.toContain("webma");
  });
});
