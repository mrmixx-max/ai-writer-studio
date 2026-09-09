// Mindmap Panel Tests (Sprint 25, Agent 2)
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MindmapPanel } from "./MindmapPanel";

describe("MindmapPanel", () => {
  it("renders the panel title", () => {
    render(<MindmapPanel />);
    expect(screen.getByText("🧠 MINDMAP")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<MindmapPanel />);
    expect(screen.getByTestId("mindmap-input")).toBeDefined();
  });

  it("renders generate button", () => {
    render(<MindmapPanel />);
    expect(screen.getByTestId("mindmap-generate")).toBeDefined();
  });

  it("renders export buttons after generation", async () => {
    render(<MindmapPanel />);
    const textarea = screen.getByTestId("mindmap-input");
    fireEvent.change(textarea, { target: { value: "Test text for mindmap" } });
    const generateBtn = screen.getByTestId("mindmap-generate");
    fireEvent.click(generateBtn);
    // Wait for generation
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByTestId("mindmap-export-mermaid")).toBeDefined();
  });

  it("button is disabled when text is empty", () => {
    render(<MindmapPanel />);
    const button = screen.getByTestId("mindmap-generate") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("button is enabled when text is entered", () => {
    render(<MindmapPanel />);
    const textarea = screen.getByTestId("mindmap-input");
    fireEvent.change(textarea, { target: { value: "Test text for mindmap generation" } });
    const button = screen.getByTestId("mindmap-generate") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
