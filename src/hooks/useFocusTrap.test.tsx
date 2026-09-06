/**
 * @vitest-environment jsdom
 */
// useFocusTrap: Falle-Zyklen, ESC-Handler, Fokus-Restore (jsdom-Fokus-Assertions).
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

function Harness({
  onClose,
  enabled,
  autoFocus,
  extra,
}: {
  onClose?: () => void;
  enabled?: boolean;
  autoFocus?: boolean;
  extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose, { enabled, autoFocus });
  return (
    <div>
      <button data-testid="outside">außen</button>
      <div ref={ref} data-testid="trap">
        <button data-testid="first">eins</button>
        <button data-testid="second">zwei</button>
        <button data-testid="third">drei</button>
        {extra}
      </div>
    </div>
  );
}

function tab(shift = false) {
  fireEvent.keyDown(document, { key: "Tab", shiftKey: shift });
}

describe("useFocusTrap", () => {
  it("setzt den Fokus beim Mount auf das erste fokussierbare Element", () => {
    render(<Harness />);
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("Tab auf dem letzten Element springt zum ersten (Falle vorwärts)", () => {
    render(<Harness />);
    screen.getByTestId("third").focus();
    tab();
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("Shift+Tab auf dem ersten Element springt zum letzten (Falle rückwärts)", () => {
    render(<Harness />);
    screen.getByTestId("first").focus();
    tab(true);
    expect(screen.getByTestId("third")).toHaveFocus();
  });

  it("Tab in der Mitte löst keinen Wrap aus (kein preventDefault-Eingriff)", () => {
    render(<Harness />);
    const middle = screen.getByTestId("second");
    middle.focus();
    const evt = new KeyboardEvent("Tab", { bubbles: true, cancelable: true });
    // Direkt auf document feuern, damit der Capture-Listener greift.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    expect(middle).toHaveFocus();
    expect(evt.defaultPrevented).toBe(false);
  });

  it("Escape ruft onClose auf", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape ohne onClose wirft keinen Fehler", () => {
    render(<Harness />);
    expect(() => fireEvent.keyDown(document, { key: "Escape" })).not.toThrow();
  });

  it("gibt den Fokus beim Unmount an das Trigger-Element zurück", () => {
    const outside = document.createElement("button");
    outside.textContent = "trigger";
    document.body.appendChild(outside);
    outside.focus();
    expect(outside).toHaveFocus();
    const { unmount } = render(<Harness onClose={vi.fn()} />);
    expect(screen.getByTestId("first")).toHaveFocus();
    unmount();
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it("enabled:false — kein Autofokus, kein ESC, keine Falle", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} enabled={false} />);
    expect(screen.getByTestId("first")).not.toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    screen.getByTestId("third").focus();
    tab();
    // Kein Wrap: Fokus bleibt auf dem letzten Element.
    expect(screen.getByTestId("third")).toHaveFocus();
  });

  it("autoFocus:false — Falle und ESC bleiben aktiv, aber kein initialer Sprung", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    render(<Harness onClose={onClose} autoFocus={false} />);
    expect(trigger).toHaveFocus();
    screen.getByTestId("third").focus();
    tab();
    expect(screen.getByTestId("first")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    trigger.remove();
  });

  it("ignoriert andere Tasten (kein onClose, kein Fokus-Sprung)", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const first = screen.getByTestId("first");
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
    expect(first).toHaveFocus();
  });

  it("überspringt deaktivierte Elemente in der Falle", () => {
    const onClose = vi.fn();
    render(
      <Harness
        onClose={onClose}
        extra={<button data-testid="disabled" disabled />}
      />,
    );
    // Letztes *aktives* Element ist "drei" — disabled wird nicht gewrappt.
    screen.getByTestId("third").focus();
    tab();
    expect(screen.getByTestId("first")).toHaveFocus();
    // Autofokus landet auf "eins", nicht auf einem disabled Element.
    expect(screen.getByTestId("disabled")).not.toHaveFocus();
  });

  it("räumt den Keydown-Listener beim Unmount auf (kein onClose nach Close)", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Harness onClose={onClose} />);
    unmount();
    onClose.mockClear();
    fireEvent.keyDown(document, { key: "Escape" });
    tab();
    expect(onClose).not.toHaveBeenCalled();
  });
});
