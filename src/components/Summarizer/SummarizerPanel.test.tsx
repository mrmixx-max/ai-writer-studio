// Summarizer Panel Tests (Sprint 25, Agent 3)
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummarizerPanel } from "./SummarizerPanel";

describe("SummarizerPanel", () => {
  it("renders the panel title", () => {
    render(<SummarizerPanel />);
    expect(screen.getByText("📝 ZUSAMMENFASSER")).toBeDefined();
  });

  it("renders length selection buttons", () => {
    render(<SummarizerPanel />);
    expect(screen.getByText("KURZ")).toBeDefined();
    expect(screen.getByText("MITTEL")).toBeDefined();
    expect(screen.getByText("LANG")).toBeDefined();
  });

  it("renders style selection buttons", () => {
    render(<SummarizerPanel />);
    expect(screen.getByText("TEXT")).toBeDefined();
    expect(screen.getByText("LISTE")).toBeDefined();
    expect(screen.getByText("KERNPUNKTE")).toBeDefined();
  });

  it("renders language selection buttons", () => {
    render(<SummarizerPanel />);
    expect(screen.getByText("DE")).toBeDefined();
    expect(screen.getByText("EN")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<SummarizerPanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders summarize button", () => {
    render(<SummarizerPanel />);
    expect(screen.getByText("ZUSAMMENFASSEN")).toBeDefined();
  });

  it("button is disabled when text is empty", () => {
    render(<SummarizerPanel />);
    const button = screen.getByText("ZUSAMMENFASSEN") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("button is enabled when text is entered", () => {
    render(<SummarizerPanel />);
    const textarea = screen.getByPlaceholderText("Text hier einfügen...");
    fireEvent.change(textarea, { target: { value: "Test text for summarization" } });
    const button = screen.getByText("ZUSAMMENFASSEN") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
