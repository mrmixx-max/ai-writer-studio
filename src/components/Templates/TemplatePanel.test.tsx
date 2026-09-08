// @vitest-environment jsdom
// Tests für das TemplatePanel: Liste, Filter, Generieren (Mock).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatePanel } from "./TemplatePanel";
import { resetTemplates } from "@/services/templates/templateManager";

beforeEach(async () => {
  await resetTemplates();
});

describe("TemplatePanel", () => {
  it("rendert die Template-Liste mit Seed-Vorlagen", async () => {
    render(<TemplatePanel generate={async () => "MOCK"} />);
    expect(await screen.findByTestId("template-panel")).toBeTruthy();
    expect(await screen.findByText(/Romanauftakt/)).toBeTruthy();
    expect(await screen.findByText(/Flash Fiction/)).toBeTruthy();
  });

  it("filtert die Liste nach Kategorie", async () => {
    const user = userEvent.setup();
    render(<TemplatePanel generate={async () => "MOCK"} />);
    await screen.findByText(/Romanauftakt/);
    await user.click(screen.getByRole("button", { name: "Roman" }));
    expect(screen.queryByText(/Romanauftakt/)).toBeTruthy();
    expect(screen.queryByText(/Formelle E-Mail/)).toBeNull();
  });

  it("generiert Text über den gerenderten Prompt (Mock)", async () => {
    const generate = vi.fn(async (_prompt: string) => "GENERATED-OUTPUT");
    const user = userEvent.setup();
    render(<TemplatePanel generate={generate} />);
    await user.click(await screen.findByText(/Romanauftakt/));
    await user.click(screen.getByRole("button", { name: /Generieren/ }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0][0]).toContain("Fantasy");
    expect(await screen.findByText("GENERATED-OUTPUT")).toBeTruthy();
  });

  it("legt ein neues Template über den Editor an", async () => {
    const user = userEvent.setup();
    render(<TemplatePanel generate={async () => "MOCK"} />);
    await screen.findByText(/Romanauftakt/);
    await user.click(screen.getByRole("button", { name: "+ Neu" }));
    await user.type(screen.getByLabelText("Template-Name"), "Mein Essay");
    await user.type(
      screen.getByLabelText("Template-Prompt"),
      "Essay über {{topic}}.",
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect((await screen.findAllByText(/Mein Essay/)).length).toBeGreaterThan(0);
    expect(screen.getByTestId("template-detail")).toBeTruthy();
  });
});
