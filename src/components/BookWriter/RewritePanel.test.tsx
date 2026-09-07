// @vitest-environment jsdom
// Component-Tests: RewritePanel (Sprint 17, Agent 5) — Befund-Anzeige,
// Vorher/Nachher-Vergleich, Accept/Reject, Ton-/Längen-Optionen, Loading.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RewritePanel, type RewriteFinding } from "./RewritePanel";

const FINDINGS: RewriteFinding[] = [
  {
    id: "f1",
    chapterId: "c1",
    message: "Füllwörter",
    before: "Er ging eigentlich irgendwie nach Hause.",
    suggestion: "Er ging nach Hause.",
  },
  {
    id: "f2",
    chapterId: "c2",
    message: "Passiv",
    before: "Das Haus wurde von ihm gebaut.",
  },
];

function renderPanel(props?: Partial<React.ComponentProps<typeof RewritePanel>>) {
  return render(
    <RewritePanel
      findings={FINDINGS}
      onAccept={() => {}}
      onReject={() => {}}
      {...props}
    />,
  );
}

describe("RewritePanel", () => {
  it("rendert das Panel mit allen Befunden", () => {
    renderPanel();
    expect(screen.getByTestId("rewrite-panel")).toBeTruthy();
    expect(screen.getAllByTestId("rewrite-finding")).toHaveLength(2);
  });

  it("zeigt Vorher-Text je Befund", () => {
    renderPanel();
    const findings = screen.getAllByTestId("rewrite-finding");
    const first = within(findings[0]);
    expect(first.getByTestId("rewrite-before").textContent).toContain(
      "Er ging eigentlich irgendwie nach Hause.",
    );
  });

  it("zeigt den mitgelieferten Vorschlag als Nachher-Vorschau", () => {
    renderPanel();
    const findings = screen.getAllByTestId("rewrite-finding");
    expect(within(findings[0]).getByTestId("rewrite-after").textContent).toContain(
      "Er ging nach Hause.",
    );
  });

  it("zeigt ohne Vorschlag einen Platzhalter statt Nachher-Vorschau", () => {
    renderPanel();
    const findings = screen.getAllByTestId("rewrite-finding");
    expect(
      within(findings[1]).getByTestId("rewrite-no-preview"),
    ).toBeTruthy();
    expect(
      within(findings[1]).queryByTestId("rewrite-after"),
    ).toBeNull();
  });

  it("Accept meldet id + Vorschau-Text und entfernt den Befund", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderPanel({ onAccept });
    const findings = screen.getAllByTestId("rewrite-finding");
    await user.click(within(findings[0]).getByTestId("rewrite-accept"));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0]).toBe("f1");
    expect(onAccept.mock.calls[0][1]).toContain("Er ging nach Hause.");
    expect(screen.getAllByTestId("rewrite-finding")).toHaveLength(1);
  });

  it("Reject meldet die id und entfernt den Befund", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    renderPanel({ onReject });
    const findings = screen.getAllByTestId("rewrite-finding");
    await user.click(within(findings[1]).getByTestId("rewrite-reject"));
    expect(onReject).toHaveBeenCalledWith("f2");
    expect(screen.getAllByTestId("rewrite-finding")).toHaveLength(1);
  });

  it("Fortschritt zählt erledigte Befunde (1 von 2)", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.getByTestId("rewrite-progress").textContent).toContain(
      "0 von 2",
    );
    const findings = screen.getAllByTestId("rewrite-finding");
    await user.click(within(findings[0]).getByTestId("rewrite-accept"));
    expect(screen.getByTestId("rewrite-progress").textContent).toContain(
      "1 von 2",
    );
    expect(screen.getByTestId("rewrite-progress-bar").getAttribute("data-resolved")).toBe("1");
  });

  it("Ton-Wechsel aktualisiert die Option", async () => {
    const user = userEvent.setup();
    renderPanel();
    const select = screen.getByTestId("rewrite-tone") as HTMLSelectElement;
    expect(select.value).toBe("neutral");
    await user.selectOptions(select, "lebendig");
    expect(select.value).toBe("lebendig");
  });

  it("Längen-Wechsel aktualisiert die Option", async () => {
    const user = userEvent.setup();
    renderPanel();
    const select = screen.getByTestId("rewrite-length") as HTMLSelectElement;
    expect(select.value).toBe("gleich");
    await user.selectOptions(select, "kürzer");
    expect(select.value).toBe("kürzer");
  });

  it("Rewrite-Button ruft rewrite mit Befund + Optionen auf und zeigt das Ergebnis", async () => {
    const user = userEvent.setup();
    const rewrite = vi.fn(async () => "Das Haus baute er selbst.");
    renderPanel({ rewrite });
    const findings = screen.getAllByTestId("rewrite-finding");
    await user.click(within(findings[1]).getByTestId("rewrite-regenerate"));
    await waitFor(() => expect(rewrite).toHaveBeenCalledTimes(1));
    const call = rewrite.mock.calls[0] as unknown as [RewriteFinding, { tone: string; length: string }];
    expect(call[0].id).toBe("f2");
    expect(call[1]).toEqual({ tone: "neutral", length: "gleich" });
    await waitFor(() => {
      expect(
        within(screen.getAllByTestId("rewrite-finding")[1]).getByTestId("rewrite-after")
          .textContent,
      ).toContain("Das Haus baute er selbst.");
    });
  });

  it("zeigt während des Rewrites einen Ladezustand und deaktiviert den Button", async () => {
    const user = userEvent.setup();
    let resolve!: (v: string) => void;
    const rewrite = vi.fn(() => new Promise<string>((res) => { resolve = res; }));
    renderPanel({ rewrite });
    const findings = screen.getAllByTestId("rewrite-finding");
    const btn = within(findings[1]).getByTestId("rewrite-regenerate");
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getAllByTestId("rewrite-finding")[1].textContent).toContain(
        "Formuliert um …",
      );
    });
    expect(
      (within(screen.getAllByTestId("rewrite-finding")[1]).getByTestId(
        "rewrite-regenerate",
      ) as HTMLButtonElement).disabled,
    ).toBe(true);
    resolve("fertig");
    await waitFor(() => {
      expect(
        within(screen.getAllByTestId("rewrite-finding")[1]).queryByTestId("rewrite-after")
          ?.textContent,
      ).toContain("fertig");
    });
  });

  it("leere Befundliste zeigt den Leerzustand", () => {
    render(<RewritePanel findings={[]} />);
    expect(screen.getByTestId("rewrite-empty")).toBeTruthy();
    expect(screen.queryByTestId("rewrite-findings")).toBeNull();
  });
});
