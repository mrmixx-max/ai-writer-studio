// @vitest-environment jsdom
// Sprint 23, Agent 4: Component-Tests fuers TimelinePanel (Engine-UI).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelinePanel } from "./TimelinePanel";
import { __resetTimelinesForTests } from "@/services/timeline/timeline";

beforeEach(() => {
  __resetTimelinesForTests();
});

async function createTimelineViaUI(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.type(screen.getByLabelText("Neuer Timeline-Titel"), title);
  await user.click(screen.getByRole("button", { name: "+ Timeline" }));
  await screen.findByTestId("timeline-track");
}

async function addEventViaUI(
  user: ReturnType<typeof userEvent.setup>,
  opts: { title: string; type?: string; characters?: string; time?: string },
) {
  await user.click(screen.getByTestId("timeline-add-open"));
  await user.type(screen.getByLabelText("Event-Titel"), opts.title);
  if (opts.time) await user.type(screen.getByLabelText("Event-Zeit"), opts.time);
  if (opts.type) await user.selectOptions(screen.getByLabelText("Event-Typ"), opts.type);
  if (opts.characters) await user.type(screen.getByLabelText("Event-Charaktere"), opts.characters);
  await user.click(screen.getByTestId("timeline-event-save"));
  await screen.findByText(opts.title);
}

describe("TimelinePanel", () => {
  it("rendert die Zeitleisten-Darstellung mit Timeline-Liste", async () => {
    render(<TimelinePanel />);
    expect(screen.getByTestId("timeline-panel")).toBeInTheDocument();
    expect(screen.getByText(/TIMELINE \/\/ Handlungs-Zeitleiste/)).toBeInTheDocument();
    expect(screen.getByTestId("timeline-select")).toBeInTheDocument();
  });

  it("legt eine Timeline an und fuegt ein Event mit Marker hinzu", async () => {
    const user = userEvent.setup();
    render(<TimelinePanel />);
    await createTimelineViaUI(user, "Plot A");
    await addEventViaUI(user, { title: "Aufbruch", type: "action", characters: "Aylin", time: "Tag 1" });

    const events = screen.getAllByTestId("timeline-event");
    expect(events).toHaveLength(1);
    expect(events[0]).toHaveAttribute("data-event-type", "action");
    expect(within(events[0]).getByTestId("timeline-event-type")).toHaveTextContent("Aktion");
  });

  it("filtert Events nach Typ und zeigt JSON-Export-Vorschau", async () => {
    const user = userEvent.setup();
    render(<TimelinePanel />);
    await createTimelineViaUI(user, "Plot B");
    await addEventViaUI(user, { title: "Kampf an der Bruecke", type: "conflict", time: "Tag 2" });
    await addEventViaUI(user, { title: "Versoehnung", type: "resolution", time: "Tag 9" });
    expect(screen.getAllByTestId("timeline-event")).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText("Nach Typ filtern"), "conflict");
    const filtered = screen.getAllByTestId("timeline-event");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toHaveTextContent("Kampf an der Bruecke");

    await user.selectOptions(screen.getByLabelText("Nach Typ filtern"), "alle");
    await user.click(screen.getByTestId("timeline-export"));
    const jsonText = screen.getByTestId("timeline-json").textContent ?? "";
    const parsed = JSON.parse(jsonText);
    expect(parsed.title).toBe("Plot B");
    expect(parsed.events).toHaveLength(2);
  });

  it("bearbeitet ein Event (Titel, Zeit, Typ, Charaktere)", async () => {
    const user = userEvent.setup();
    render(<TimelinePanel />);
    await createTimelineViaUI(user, "Plot C");
    await addEventViaUI(user, { title: "Alter Titel", type: "action", time: "Tag 1" });

    await user.click(screen.getByRole("button", { name: /Alter Titel bearbeiten/ }));
    const titleBox = screen.getByLabelText("Event-Titel");
    await user.clear(titleBox);
    await user.type(titleBox, "Neuer Titel");
    await user.click(screen.getByTestId("timeline-event-save"));

    await screen.findByText("Neuer Titel");
    expect(screen.queryByText("Alter Titel")).not.toBeInTheDocument();
  });
});
