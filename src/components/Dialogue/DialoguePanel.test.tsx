// @vitest-environment jsdom
// Dialogue Panel Tests (Sprint 27, Agent 2)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialoguePanel } from "./DialoguePanel";

describe("DialoguePanel", () => {
  it("renders the panel title", () => {
    render(<DialoguePanel />);
    expect(screen.getByText("💬 DIALOG-ANALYSE")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<DialoguePanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<DialoguePanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
