// @vitest-environment jsdom
/**
 * Tests: CrowdfundingStudio (WP 46.1 — Crowdfunding- & Kickstarter-Studio)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrowdfundingStudio } from "./CrowdfundingStudio";

describe("CrowdfundingStudio", () => {
  it("rendert das Studio", () => {
    render(<CrowdfundingStudio />);
    expect(screen.getByTestId("crowdfunding-studio")).toBeTruthy();
  });

  it("zeigt Tiers", () => {
    render(<CrowdfundingStudio />);
    expect(screen.getByTestId("crowdfunding-tiers")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-tier-t1")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-tier-t2")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-tier-t3")).toBeTruthy();
  });

  it("zeigt Stretch-Goals", () => {
    render(<CrowdfundingStudio />);
    expect(screen.getByTestId("crowdfunding-stretch-goals")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-stretch-s1")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-stretch-s2")).toBeTruthy();
    expect(screen.getByTestId("crowdfunding-stretch-s3")).toBeTruthy();
  });

  it("berechnet Kosten", () => {
    render(<CrowdfundingStudio />);
    expect(screen.getByTestId("crowdfunding-print-costs").textContent).toContain("€");
    expect(screen.getByTestId("crowdfunding-packaging-costs").textContent).toContain("€");
    expect(screen.getByTestId("crowdfunding-shipping-costs").textContent).toContain("€");
    expect(screen.getByTestId("crowdfunding-platform-fees").textContent).toContain("€");
    expect(screen.getByTestId("crowdfunding-total-costs").textContent).toContain("€");
  });

  it("zeigt Netto-Gewinn", () => {
    render(<CrowdfundingStudio />);
    expect(screen.getByTestId("crowdfunding-net-profit").textContent).toContain("€");
  });

  it("Titeländerung wirkt", () => {
    render(<CrowdfundingStudio />);
    fireEvent.change(screen.getByTestId("crowdfunding-title"), {
      target: { value: "Neue Kampagne" },
    });
    expect(screen.getByTestId("crowdfunding-studio").textContent).toContain("Neue Kampagne");
  });

  it("Export-Format umschaltbar", () => {
    render(<CrowdfundingStudio />);
    fireEvent.change(screen.getByTestId("crowdfunding-export-format"), {
      target: { value: "html" },
    });
    fireEvent.click(screen.getByTestId("crowdfunding-export"));
    expect(screen.getByTestId("crowdfunding-export-output").textContent).toContain("<");
  });

  it("Markdown-Export enthält Markdown-Syntax", () => {
    render(<CrowdfundingStudio />);
    fireEvent.click(screen.getByTestId("crowdfunding-export"));
    const out = screen.getByTestId("crowdfunding-export-output").textContent ?? "";
    expect(out).toContain("#");
    expect(out).toContain("**");
  });

  it("HTML-Export enthält HTML-Tags", () => {
    render(<CrowdfundingStudio />);
    fireEvent.change(screen.getByTestId("crowdfunding-export-format"), {
      target: { value: "html" },
    });
    fireEvent.click(screen.getByTestId("crowdfunding-export"));
    const out = screen.getByTestId("crowdfunding-export-output").textContent ?? "";
    expect(out).toContain("<h1");
    expect(out).toContain("<p>");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<CrowdfundingStudio />);
    const hexes = container.innerHTML.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
