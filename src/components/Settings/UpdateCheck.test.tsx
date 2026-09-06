// @vitest-environment jsdom
// Component-Tests für UpdateCheck.tsx: State-Machine
// idle → checking → available/up-to-date/error,
// available → downloading → ready/error, Restart via relaunch_app.
// Tauri-Backend (invoke) und Events (listen) sind gemockt.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invokeMock = vi.fn();
const listenMocks = new Map<string, (e: { payload: unknown }) => void>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, cb: (e: { payload: unknown }) => void) => {
    listenMocks.set(event, cb);
    return vi.fn();
  }),
  emit: vi.fn(async () => undefined),
  emitTo: vi.fn(async () => undefined),
}));

import { UpdateCheck } from "./UpdateCheck";

function emitProgress(downloaded: number, total: number | null) {
  listenMocks.get("update://progress")?.({ payload: { downloaded, total } });
}

function emitInstalled(version: string) {
  listenMocks.get("update://installed")?.({ payload: { version } });
}

describe("UpdateCheck", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMocks.clear();
  });

  it("startet im Idle-Zustand mit Prüfen-Button", () => {
    render(<UpdateCheck />);
    expect(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Noch nicht geprüft.");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("zeigt Prüf-Status während des Checks", async () => {
    let resolve!: (v: unknown) => void;
    invokeMock.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Suche nach Updates");
    resolve({
      available: false,
      current_version: "1.0.0",
      version: null,
      notes: null,
      date: null,
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("aktuell"),
    );
  });

  it("zeigt verfügbare Version mit Release-Notes und Install-Button", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: "Neu: Kapitel-Export",
      date: "2026-09-01T00:00:00Z",
    });
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Update installieren" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Installiert: 1\.0\.0/)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.1\.0/).length).toBeGreaterThan(0);
    expect(screen.getByText("Neu: Kapitel-Export")).toBeInTheDocument();
  });

  it("ruft check_for_updates per invoke auf", async () => {
    invokeMock.mockResolvedValueOnce({
      available: false,
      current_version: "1.0.0",
      version: null,
      notes: null,
      date: null,
    });
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("check_for_updates"));
  });

  it("zeigt Fehler bei fehlgeschlagenem Check", async () => {
    invokeMock.mockRejectedValueOnce(new Error("Update-Check fehlgeschlagen: offline"));
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("offline"),
    );
  });

  it("startet Download per download_and_install_update", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    // download_and_install_update: Promise bewusst offen lassen, damit der
    // downloading-Zustand beobachtbar bleibt.
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("download_and_install_update"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "wird heruntergeladen",
    );
  });

  it("aktualisiert den Fortschrittsbalken aus update://progress", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "wird heruntergeladen",
      ),
    );
    emitProgress(500, 1000);
    await waitFor(() => expect(screen.getByText("50 %")).toBeInTheDocument());
    expect(screen.getByLabelText("Download-Fortschritt")).toHaveAttribute(
      "value",
      "50",
    );
  });

  it("zeigt KB-Stand bei unbekannter Gesamtgröße", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "wird heruntergeladen",
      ),
    );
    emitProgress(2048, null);
    await waitFor(() =>
      expect(screen.getByText("2 KB geladen")).toBeInTheDocument(),
    );
  });

  it("wechselt bei update://installed in den Ready-Zustand mit Restart-Prompt", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "wird heruntergeladen",
      ),
    );
    emitInstalled("1.1.0");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Jetzt neu starten" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/1\.1\.0.*installiert/)).toBeInTheDocument();
  });

  it("wird auch ohne installed-Event nach erfolgreichem invoke bereit", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockResolvedValueOnce(undefined);
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Jetzt neu starten" }),
      ).toBeInTheDocument(),
    );
  });

  it("zeigt Fehler bei fehlgeschlagenem Download", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockRejectedValueOnce(
      new Error("Update-Installation fehlgeschlagen: Signatur ungültig"),
    );
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Signatur ungültig",
      ),
    );
  });

  it("Neustart ruft relaunch_app auf", async () => {
    invokeMock.mockResolvedValueOnce({
      available: true,
      current_version: "1.0.0",
      version: "1.1.0",
      notes: null,
      date: null,
    });
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    invokeMock.mockResolvedValueOnce(undefined);
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Update installieren" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "wird heruntergeladen",
      ),
    );
    emitInstalled("1.1.0");
    await userEvent.click(
      await screen.findByRole("button", { name: "Jetzt neu starten" }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("relaunch_app"),
    );
  });

  it("erlaubt Retry nach Fehler", async () => {
    invokeMock.mockRejectedValueOnce(new Error("offline"));
    invokeMock.mockResolvedValueOnce({
      available: false,
      current_version: "1.0.0",
      version: null,
      notes: null,
      date: null,
    });
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("offline"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("aktuell"),
    );
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("ignoriert Progress-Events außerhalb des Downloads", async () => {
    invokeMock.mockResolvedValueOnce({
      available: false,
      current_version: "1.0.0",
      version: null,
      notes: null,
      date: null,
    });
    render(<UpdateCheck />);
    await userEvent.click(
      screen.getByRole("button", { name: "Nach Updates suchen" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("aktuell"),
    );
    emitProgress(999, 1000);
    emitInstalled("9.9.9");
    expect(screen.getByRole("status")).toHaveTextContent("aktuell");
    expect(
      screen.queryByRole("button", { name: "Jetzt neu starten" }),
    ).not.toBeInTheDocument();
  });
});
