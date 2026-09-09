// Writing Pace Panel Tests (Sprint 27, Agent 4)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WritingPacePanel } from "./WritingPacePanel";

describe("WritingPacePanel", () => {
  it("renders the panel title", () => {
    render(<WritingPacePanel />);
    expect(screen.getByText("🏃 WRITING PACE")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<WritingPacePanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<WritingPacePanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
