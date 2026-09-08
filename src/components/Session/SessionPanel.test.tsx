// @vitest-environment jsdom
// Component-Tests: SessionPanel (Sprint 24, Agent 3).
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionPanel } from "./SessionPanel";
import type { Session } from "@/services/session/sessionManager";

function sess(partial: Partial<Session> = {}): Session {
  return {
    id: "s1",
    name: "Demo",
    projectId: "p1",
    openTabs: ["c1", "c2"],
    activeTab: "c1",
    createdAt: 1,
    updatedAt: 2,
    ...partial,
  };
}

describe("SessionPanel", () => {
  it("rendert Session-Liste mit Vorschau", async () => {
    render(<SessionPanel list={async () => [sess()]} />);
    await waitFor(() => expect(screen.getByTestId("session-list")).toBeInTheDocument());
    expect(screen.getByTestId("session-item-s1")).toBeInTheDocument();
    expect(screen.getByTestId("session-preview")).toHaveTextContent("Demo");
    expect(screen.getByTestId("session-preview-tabs")).toHaveTextContent("c1, c2");
  });

  it("zeigt Empty-State ohne Sessions", async () => {
    render(<SessionPanel list={async () => []} />);
    await waitFor(() => expect(screen.getByTestId("session-empty")).toBeInTheDocument());
  });

  it("Speichern ruft save() mit Name-Dialog auf", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (name: string) => sess({ id: "neu", name }));
    render(
      <SessionPanel
        list={async () => []}
        save={save}
        promptName={() => "Meine Session"}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("session-empty")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-save"));
    await waitFor(() => expect(save).toHaveBeenCalledWith("Meine Session"));
  });

  it("Laden ruft load()+restore() für Auswahl auf", async () => {
    const user = userEvent.setup();
    const load = vi.fn(async () => sess());
    const restore = vi.fn(async () => {});
    render(<SessionPanel list={async () => [sess()]} load={load} restore={restore} />);
    await waitFor(() => expect(screen.getByTestId("session-load")).toBeInTheDocument());
    await user.click(screen.getByTestId("session-load"));
    await waitFor(() => expect(load).toHaveBeenCalledWith("s1"));
    expect(restore).toHaveBeenCalledOnce();
  });

  it("Quick-Load rendert letzte Sessions", async () => {
    const all = [sess({ id: "a", name: "A" }), sess({ id: "b", name: "B" })];
    render(<SessionPanel list={async () => all} />);
    await waitFor(() => expect(screen.getByTestId("session-quick-a")).toBeInTheDocument());
    expect(screen.getByTestId("session-quick-b")).toBeInTheDocument();
  });
});
