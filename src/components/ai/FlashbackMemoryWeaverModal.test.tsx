// @vitest-environment jsdom
/**
 * Tests: FlashbackMemoryWeaverModal (WP 58.2)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashbackMemoryWeaverModal } from "./FlashbackMemoryWeaverModal";

describe("FlashbackMemoryWeaverModal", () => {
  it("rendert die Komponente", () => {
    render(<FlashbackMemoryWeaverModal />);
    expect(screen.getByTestId("flashback-memory-weaver-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<FlashbackMemoryWeaverModal />);
    expect(screen.getByText("⏳ Flashback-Weaver")).toBeTruthy();
  });

  it("zeigt alle vier Sinneskanäle", () => {
    render(<FlashbackMemoryWeaverModal />);
    ["auditory", "smell", "taste", "touch"].forEach((s) => {
      expect(screen.getByTestId(`flashback-sense-${s}`)).toBeTruthy();
    });
  });

  it("zeigt alle drei Phasen", () => {
    render(<FlashbackMemoryWeaverModal />);
    expect(screen.getByTestId("flashback-phase-slip")).toBeTruthy();
    expect(screen.getByTestId("flashback-phase-memory")).toBeTruthy();
    expect(screen.getByTestId("flashback-phase-snapback")).toBeTruthy();
  });

  it("benennt die Phasen", () => {
    render(<FlashbackMemoryWeaverModal />);
    const text = screen.getByTestId("flashback-phases").textContent ?? "";
    expect(text).toContain("GLEITEN (SLIP-STREAM)");
    expect(text).toContain("SNAP-BACK");
  });

  it("wechselt den Sinneskanal", () => {
    render(<FlashbackMemoryWeaverModal />);
    const before = screen.getByTestId("flashback-phase-slip").textContent;
    fireEvent.click(screen.getByTestId("flashback-sense-touch"));
    expect(screen.getByTestId("flashback-phase-slip").textContent).not.toBe(before);
  });

  it("markiert den aktiven Kanal", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.click(screen.getByTestId("flashback-sense-taste"));
    expect(screen.getByTestId("flashback-sense-taste").getAttribute("aria-pressed")).toBe("true");
  });

  it("übernimmt den Trigger", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.change(screen.getByTestId("flashback-trigger-input"), {
      target: { value: "das Knarren der Diele" },
    });
    expect(screen.getByTestId("flashback-phase-slip").textContent).toContain("Knarren der Diele");
  });

  it("übernimmt die akute Gefahr", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.change(screen.getByTestId("flashback-danger-input"), {
      target: { value: "Das Feuer erreichte die Tür" },
    });
    expect(screen.getByTestId("flashback-phase-snapback").textContent).toContain(
      "Feuer erreichte die Tür",
    );
  });

  it("übernimmt die Figur", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.change(screen.getByTestId("flashback-character-input"), {
      target: { value: "Jonas" },
    });
    expect(screen.getByTestId("flashback-phase-memory").textContent).toContain("Jonas");
  });

  it("übernimmt den Erinnerungsinhalt", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.change(screen.getByTestId("flashback-memory-input"), {
      target: { value: "Der Kuchen war verbrannt" },
    });
    expect(screen.getByTestId("flashback-phase-memory").textContent).toContain(
      "Kuchen war verbrannt",
    );
  });

  it("zeigt die Übergangsqualität", () => {
    render(<FlashbackMemoryWeaverModal />);
    expect(screen.getByTestId("flashback-flow")).toBeTruthy();
    expect(screen.getByTestId("flashback-slip-quality")).toBeTruthy();
    expect(screen.getByTestId("flashback-snap-quality")).toBeTruthy();
  });

  it("erkennt Trigger im Beispieltext", () => {
    render(<FlashbackMemoryWeaverModal />);
    const total = Number(screen.getByTestId("flashback-scan-total").textContent);
    expect(total).toBeGreaterThan(0);
  });

  it("zeigt die Kanal-Verteilung", () => {
    render(<FlashbackMemoryWeaverModal />);
    ["auditory", "smell", "taste", "touch"].forEach((s) => {
      expect(screen.getByTestId(`flashback-scan-${s}`)).toBeTruthy();
    });
  });

  it("reagiert auf geänderten Scan-Text", () => {
    render(<FlashbackMemoryWeaverModal />);
    fireEvent.change(screen.getByTestId("flashback-scan-input"), {
      target: { value: "Er ging über den Hof." },
    });
    expect(screen.getByTestId("flashback-scan-total").textContent).toBe("0");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<FlashbackMemoryWeaverModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
