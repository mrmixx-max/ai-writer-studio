// @vitest-environment jsdom
// Genre Panel Tests (Sprint 27, Agent 6)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenrePanel } from "./GenrePanel";

describe("GenrePanel", () => {
  it("renders the panel title", () => {
    render(<GenrePanel />);
    expect(screen.getByText("🎭 GENRE-ANALYSE")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<GenrePanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<GenrePanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
