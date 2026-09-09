// Style Analyzer Panel Tests (Sprint 27, Agent 5)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StyleAnalyzerPanel } from "./StyleAnalyzerPanel";

describe("StyleAnalyzerPanel", () => {
  it("renders the panel title", () => {
    render(<StyleAnalyzerPanel />);
    expect(screen.getByText("🎨 STIL-ANALYSE")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<StyleAnalyzerPanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<StyleAnalyzerPanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
