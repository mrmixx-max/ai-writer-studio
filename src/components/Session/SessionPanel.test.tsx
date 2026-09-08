// @vitest-environment jsdom
// Component-Tests: SessionPanel (Sprint 24, Agent 3) — Liste, Speichern,
// Laden, Loeschen, Umbenennen, Vorschau, Quick-Load.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionPanel, type SessionManagerClient } from "./SessionPanel";
import type { Session } from "@/services/session/sessionManager";

function session(partial: Partial<Session> & { id: string; name: string }): Session {
  return {
    projectId: "proj-1",
    openTabs: ["ch-1", "ch-2"],
    activeTab: "ch-1",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...partial,
  };
}

function mockClient(initial: Session[] = []): SessionManagerClient & { store: Session[] } {
  const store = [...initial];
  return {
    store,
    saveSession: vi.fn(async (name: string) => {
      const s = session({ id: `session-test-${store.length + 1}`, name, updatedAt: Date.now() });
      store.push(s);
      return s;
    }),
    loadSession: vi.fn(async (id: string) => {
      const found = store.find((s) => s.id === id);
      if (!found) throw new Error("Session nicht gefunden");
      return { ...found };
    }),
    getSessions: vi.fn(async () => [...store]),
    deleteSession: vi.fn(async (id: string) => {
      const i = store.findIndex((s) => s.id === id);
      if (i < 0) throw new Error("Session nicht gefunden");
      store.splice(i, 1);
    }),
    renameSession: vi.fn(async (id: string, name: string) => {
      const found = store.find((s) => s.id === id);
      if (!found) throw new Error("Session nicht gefunden");
      found.name = name;
    }),
    restoreState: vi.fn(async () => undefined),
  };
}

describe("SessionPanel", () => {
  it("rendert Session-Liste mit allen Eintraegen", async () => {
    const client = mockClient([
      session({ id: "s1", name: "Erste" }),
      session({ id: "s2", name: "Zweite" }),
    ]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-item-s1")).toBeInTheDocument());
    expect(screen.getByTestId("session-item-s2")).toBeInTheDocument();
    expect(screen.getByTestId("session-count")).toHaveTextContent("2");
  });

  it("zeigt leeren Zustand ohne Sessions", async () => {
    render(<SessionPanel manager={mockClient([])} />);
    await waitFor(() => expect(screen.getByTestId("session-empty")).toBeInTheDocument());
  });

  it("'Speichern' mit Name-Dialog erzeugt eine Session", async () => {
    const user = userEvent.setup();
    const client = mockClient([]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-empty")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-save-open"));
    await user.type(screen.getByTestId("session-name-input"), "Abendstand");
    await user.click(screen.getByTestId("session-save-confirm"));
    await waitFor(() => expect(client.saveSession).toHaveBeenCalledWith("Abendstand"));
    await waitFor(() => expect(screen.getByTestId("session-notice")).toHaveTextContent("Abendstand"));
  });

  it("'Laden' ruft loadSession + restoreState auf", async () => {
    const user = userEvent.setup();
    const client = mockClient([session({ id: "s1", name: "Erste" })]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-item-s1")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-load-s1"));
    await waitFor(() => expect(client.loadSession).toHaveBeenCalledWith("s1"));
    expect(client.restoreState).toHaveBeenCalled();
  });

  it("Vorschau zeigt Projekt und offene Tabs, Umbenennen ruft renameSession", async () => {
    const user = userEvent.setup();
    const client = mockClient([session({ id: "s1", name: "Erste" })]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-item-s1")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-item-s1"));
    await waitFor(() => expect(screen.getByTestId("session-preview")).toBeInTheDocument());
    expect(screen.getByTestId("session-preview-project")).toHaveTextContent("proj-1");
    expect(screen.getByTestId("session-preview-tabs")).toHaveTextContent("ch-1");
    await user.type(screen.getByTestId("session-rename-input"), "Umbenannt");
    await user.click(screen.getByTestId("session-rename-confirm"));
    await waitFor(() => expect(client.renameSession).toHaveBeenCalledWith("s1", "Umbenannt"));
  });

  it("'Loeschen' entfernt die Session aus der Liste", async () => {
    const user = userEvent.setup();
    const client = mockClient([session({ id: "s1", name: "Erste" })]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-item-s1")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-delete-s1"));
    await waitFor(() => expect(client.deleteSession).toHaveBeenCalledWith("s1"));
  });

  it("Quick-Load zeigt letzte Sessions und laedt per Klick", async () => {
    const user = userEvent.setup();
    const client = mockClient([session({ id: "s1", name: "Erste" })]);
    render(<SessionPanel manager={client} />);
    await waitFor(() => expect(screen.getByTestId("session-quickload")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-quick-s1"));
    await waitFor(() => expect(client.loadSession).toHaveBeenCalledWith("s1"));
  });
});
