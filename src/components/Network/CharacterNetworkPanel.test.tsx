// @vitest-environment jsdom
// Character Network Panel Tests (Sprint 27, Agent 3)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterNetworkPanel } from "./CharacterNetworkPanel";

describe("CharacterNetworkPanel", () => {
  it("renders the panel title", () => {
    render(<CharacterNetworkPanel />);
    expect(screen.getByText("🌐 CHARAKTER-NETZWERK")).toBeDefined();
  });

  it("renders input textarea", () => {
    render(<CharacterNetworkPanel />);
    expect(screen.getByPlaceholderText("Text hier einfügen...")).toBeDefined();
  });

  it("renders analyze button", () => {
    render(<CharacterNetworkPanel />);
    expect(screen.getByText("ANALYSIEREN")).toBeDefined();
  });
});
