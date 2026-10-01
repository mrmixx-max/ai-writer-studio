// @vitest-environment jsdom
// Component-Tests: WritersRoomPanel — vier Agenten-Personas als Karten.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WritersRoomPanel } from "./WritersRoomPanel";

const CONTEXT = "Der Held findet eine Karte, die seine Herkunft verrät.";

describe("WritersRoomPanel", () => {
  it("rendert das Panel und den Titel", () => {
    render(<WritersRoomPanel />);
    expect(screen.getByTestId("writers-room-panel")).toBeTruthy();
    expect(screen.getByTestId("writers-room-title")).toBeTruthy();
  });

  it("zeigt genau vier Persona-Karten", () => {
    render(<WritersRoomPanel context={CONTEXT} />);
    expect(screen.getByTestId("writers-room-grid")).toBeTruthy();
    for (const id of ["dramaturg", "psychologe", "worldbuilder", "teufelsadvokat"]) {
      expect(screen.getByTestId(`writers-room-card-${id}`)).toBeTruthy();
    }
  });

  it("jede Karte hat Name, Rolle und Icon", () => {
    render(<WritersRoomPanel context={CONTEXT} />);
    expect(screen.getByTestId("writers-room-name-dramaturg").textContent).toBe("Dramaturg");
    expect(screen.getByTestId("writers-room-role-dramaturg").textContent).toBe(
      "Struktur & Kausalität",
    );
    expect(screen.getByTestId("writers-room-icon-dramaturg").textContent).toBe("🎭");

    expect(screen.getByTestId("writers-room-name-psychologe").textContent).toBe("Psychologe");
    expect(screen.getByTestId("writers-room-name-worldbuilder").textContent).toBe("Worldbuilder");
    expect(screen.getByTestId("writers-room-name-teufelsadvokat").textContent).toBe(
      "Teufelsadvokat",
    );
  });

  it("zeigt für jede Persona einen Prompt (aus buildPersonaPrompt)", () => {
    render(<WritersRoomPanel context={CONTEXT} />);
    const prompt = screen.getByTestId("writers-room-prompt-dramaturg");
    expect(prompt.textContent).toContain("Du bist der Dramaturg");
    expect(prompt.textContent).toContain("--- KONTEXT ---");
    expect(prompt.textContent).toContain(CONTEXT);
  });

  it("nutzt den Platzhalter, wenn kein Kontext angegeben ist", () => {
    render(<WritersRoomPanel />);
    expect(screen.getByTestId("writers-room-context-empty")).toBeTruthy();
    expect(screen.getByTestId("writers-room-prompt-psychologe").textContent).toContain(
      "(Kein Kontext angegeben)",
    );
  });

  it("erlaubt die Auswahl einer Persona über den Button", async () => {
    const user = userEvent.setup();
    render(<WritersRoomPanel context={CONTEXT} />);
    const card = screen.getByTestId("writers-room-card-worldbuilder");
    expect(card.getAttribute("data-selected")).toBe("false");

    await user.click(screen.getByTestId("writers-room-select-worldbuilder"));

    expect(
      screen.getByTestId("writers-room-card-worldbuilder").getAttribute("data-selected"),
    ).toBe("true");
    expect(
      screen.getByTestId("writers-room-select-worldbuilder").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("rendert mit className prop", () => {
    render(<WritersRoomPanel className="custom-class" />);
    expect(screen.getByTestId("writers-room-panel").className).toContain("custom-class");
  });
});
