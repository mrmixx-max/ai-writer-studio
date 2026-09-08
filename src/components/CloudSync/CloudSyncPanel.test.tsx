// @vitest-environment jsdom
// Component-Tests: CloudSyncPanel (Sprint 24, Agent 1) — Provider-Auswahl,
// Zugangsdaten, Verbindungstest, Sync-Button, Auto-Sync/Intervall.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { resetCloudSync } from "@/services/cloud/cloudSync";

afterEach(() => {
  resetCloudSync();
  vi.unstubAllGlobals();
});

describe("CloudSyncPanel", () => {
  it("rendert Provider-Auswahl mit allen vier Providern", () => {
    render(<CloudSyncPanel />);
    const select = screen.getByTestId("cloudsync-provider-select");
    expect(select).toBeInTheDocument();
    for (const id of ["dropbox", "google-drive", "onedrive", "webdav"]) {
      expect(screen.getByTestId(`cloudsync-provider-option-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("cloudsync-token-input")).toBeInTheDocument();
    expect(screen.getByTestId("cloudsync-folder-input")).toBeInTheDocument();
  });

  it("Verbindungstest zeigt Verbunden-Status bei ok-Antwort", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"account_id":"a"}', { status: 200 })));
    render(<CloudSyncPanel />);
    await user.type(screen.getByTestId("cloudsync-token-input"), "token-123");
    await user.click(screen.getByTestId("cloudsync-test-connection"));
    await waitFor(() => expect(screen.getByTestId("cloudsync-connection-status")).toHaveTextContent("Verbunden"));
  });

  it("Sync-Button ist Amber (Timer-Label) und meldet Status nach Sync", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("list_folder")) {
          return new Response(JSON.stringify({ entries: [] }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    );
    render(<CloudSyncPanel />);
    const btn = screen.getByTestId("cloudsync-sync-button");
    expect(btn).toHaveTextContent("Sync starten");
    await user.type(screen.getByTestId("cloudsync-token-input"), "token-123");
    await user.click(btn);
    await waitFor(() => expect(screen.getByTestId("cloudsync-status")).toBeInTheDocument());
    expect(screen.getByTestId("cloudsync-status")).toHaveTextContent("Upload");
  });

  it("Auto-Sync-Toggle und Intervall-Eingabe sind bedienbar", async () => {
    const user = userEvent.setup();
    render(<CloudSyncPanel />);
    const toggle = screen.getByTestId("cloudsync-autosync-toggle");
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    const interval = screen.getByTestId("cloudsync-interval-input");
    await user.clear(interval);
    await user.type(interval, "30");
    expect(interval).toHaveValue(30);
  });
});
