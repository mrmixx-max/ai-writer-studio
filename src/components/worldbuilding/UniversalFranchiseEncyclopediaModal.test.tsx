// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UniversalFranchiseEncyclopediaModal } from "./UniversalFranchiseEncyclopediaModal";

describe("UniversalFranchiseEncyclopediaModal", () => {
  it("rendert ohne Fehler", () => {
    render(<UniversalFranchiseEncyclopediaModal />);
    expect(
      screen.getByTestId("franchise-encyclopedia-modal"),
    ).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<UniversalFranchiseEncyclopediaModal />);
    expect(
      screen.getByText(/Universelle Franchise-Enzyklopädie \(Silmarillion\)/),
    ).toBeInTheDocument();
  });

  it("zeigt Wiki-Verlinker", () => {
    render(<UniversalFranchiseEncyclopediaModal />);
    expect(screen.getByText(/WIKI-VERLINKER/)).toBeInTheDocument();
  });

  it("zeigt Taxonomie", () => {
    render(<UniversalFranchiseEncyclopediaModal />);
    expect(screen.getByText(/TAXONOMIE & EPOCHEN/)).toBeInTheDocument();
  });

  it("zeigt Begleitband", () => {
    render(<UniversalFranchiseEncyclopediaModal />);
    expect(screen.getByText(/BEGLEITBAND/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<UniversalFranchiseEncyclopediaModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
