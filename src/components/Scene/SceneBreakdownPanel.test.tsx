// Scene Breakdown Panel Tests (Sprint 27, Agent 1)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SceneBreakdownPanel } from "./SceneBreakdownPanel";

describe("SceneBreakdownPanel", () => {
  it("renders the panel title", () => {
    render(<SceneBreakdownPanel />);
    expect(screen.getByText("🎬 SCENE BREAKDOWN")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<SceneBreakdownPanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<SceneBreakdownPanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
