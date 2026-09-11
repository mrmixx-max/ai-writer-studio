// @vitest-environment jsdom
// Component-Tests fuer CloudSyncPanel (Sprint 24, Agent 1).
// Datei: src/components/CloudSync/CloudSyncPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CloudSyncPanel, type CloudSyncClient } from "./CloudSyncPanel";

function client(overrides: Partial<CloudSyncClient> = {}): CloudSyncClient {
  return {
    testConnection: async () => true,
    syncAll: async () => ({ uploaded: 1, downloaded: 2, conflicts: 0, lastSync: 1700000000000 }),
    getRemoteFiles: async () => [{ name: "buch", modified: 1700000000000 }],
    ...overrides,
  };
}

describe("CloudSyncPanel", () => {
  it("rendert Provider-Auswahl mit allen 4 Providern", () => {
    render(<CloudSyncPanel client={client()} />);
    const select = screen.getByTestId("cloudsync-provider") as HTMLSelectElement;
    const values = [...select.querySelectorAll("option")].map((o) => o.getAttribute("value"));
    expect(values).toEqual(["dropbox", "google-drive", "onedrive", "webdav"]);
    expect(screen.getByTestId("cloudsync-token")).toBeTruthy();
    expect(screen.getByTestId("cloudsync-test")).toBeTruthy();
    expect(screen.getByTestId("cloudsync-sync")).toBeTruthy();
    expect(screen.getByTestId("cloudsync-autosync")).toBeTruthy();
    expect(screen.getByTestId("cloudsync-interval")).toBeTruthy();
  });

  it("Verbindungstest zeigt Erfolg an", async () => {
    render(<CloudSyncPanel client={client()} />);
    fireEvent.click(screen.getByTestId("cloudsync-test"));
    await waitFor(() => {
      expect(screen.getByTestId("cloudsync-conn").textContent).toContain("Verbunden");
    });
  });

  it("Sync-Button zeigt Upload/Download/Conflicts-Status", async () => {
    render(<CloudSyncPanel client={client()} />);
    fireEvent.click(screen.getByTestId("cloudsync-sync"));
    await waitFor(() => {
      expect(screen.getByTestId("cloudsync-uploaded").textContent).toContain("1");
      expect(screen.getByTestId("cloudsync-downloaded").textContent).toContain("2");
      expect(screen.getByTestId("cloudsync-conflicts").textContent).toContain("0");
    });
  });
});
