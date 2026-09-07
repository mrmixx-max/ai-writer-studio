// @vitest-environment jsdom
// Component-Tests für ToastContainer.tsx (Sprint 18, Agent 6):
// Render, Typ-Styling, Stacking, Auto-Dismiss, manueller Dismiss.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  ToastContainer,
  showToast,
  dismissToast,
  resetToastStateForTests,
} from "./ToastContainer";

beforeEach(() => {
  vi.useFakeTimers();
  resetToastStateForTests();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  resetToastStateForTests();
});

describe("ToastContainer", () => {
  it("rendert leeren Container mit aria-live region", () => {
    render(<ToastContainer />);
    const region = screen.getByRole("region", { name: "Benachrichtigungen" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveClass("toast-container");
  });

  it("showToast zeigt Nachricht mit Default-Typ info", () => {
    render(<ToastContainer />);
    let id = 0;
    act(() => {
      id = showToast("Hallo Welt");
    });
    expect(screen.getByText("Hallo Welt")).toBeInTheDocument();
    const toast = screen.getByTestId(`toast-${id}`);
    expect(toast).toHaveClass("toast--info");
    expect(toast).toHaveAttribute("data-type", "info");
  });

  it("weist jedem Typ die korrekte Styling-Klasse zu", () => {
    render(<ToastContainer />);
    const ids: number[] = [];
    act(() => {
      ids.push(showToast("i", "info"));
      ids.push(showToast("s", "success"));
      ids.push(showToast("w", "warn"));
      ids.push(showToast("e", "error"));
    });
    expect(screen.getByTestId(`toast-${ids[0]}`)).toHaveClass("toast--info");
    expect(screen.getByTestId(`toast-${ids[1]}`)).toHaveClass("toast--success");
    expect(screen.getByTestId(`toast-${ids[2]}`)).toHaveClass("toast--warn");
    expect(screen.getByTestId(`toast-${ids[3]}`)).toHaveClass("toast--error");
  });

  it("error-Toast nutzt role=alert, andere role=status", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Fehler!", "error");
      showToast("Info.", "info");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Fehler!");
    expect(screen.getByRole("status")).toHaveTextContent("Info.");
  });

  it("stapelt mehrere Toasts gleichzeitig", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Erste Nachricht", "info");
      showToast("Zweite Nachricht", "success");
      showToast("Dritte Nachricht", "warn");
    });
    expect(screen.getByText("Erste Nachricht")).toBeInTheDocument();
    expect(screen.getByText("Zweite Nachricht")).toBeInTheDocument();
    expect(screen.getByText("Dritte Nachricht")).toBeInTheDocument();
    expect(document.querySelectorAll(".toast")).toHaveLength(3);
  });

  it("dismissed Toast automatisch nach duration", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Vergänglich", "info", 3000);
    });
    expect(screen.getByText("Vergänglich")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText("Vergänglich")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Vergänglich")).not.toBeInTheDocument();
  });

  it("respektiert custom duration (kein zu frühes Dismiss)", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Langlebig", "success", 10000);
      showToast("Kurzlebig", "info", 1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Kurzlebig")).not.toBeInTheDocument();
    expect(screen.getByText("Langlebig")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.queryByText("Langlebig")).not.toBeInTheDocument();
  });

  it("schließt Toast manuell über ✕-Button", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Wegklickbar", "warn");
    });
    expect(screen.getByText("Wegklickbar")).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Wegklickbar/ }));
    });
    expect(screen.queryByText("Wegklickbar")).not.toBeInTheDocument();
  });

  it("dismissToast(id) entfernt gezielt einen Toast", () => {
    render(<ToastContainer />);
    let keep = 0;
    let drop = 0;
    act(() => {
      keep = showToast("Bleibt", "info", 0);
      drop = showToast("Geht", "info", 0);
    });
    act(() => {
      dismissToast(drop);
    });
    expect(screen.getByTestId(`toast-${keep}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`toast-${drop}`)).not.toBeInTheDocument();
  });

  it("duration=0 deaktiviert Auto-Dismiss", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Dauerhaft", "info", 0);
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Dauerhaft")).toBeInTheDocument();
  });
});
