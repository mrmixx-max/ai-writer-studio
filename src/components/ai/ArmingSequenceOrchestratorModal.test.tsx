// @vitest-environment jsdom
/**
 * Tests: ArmingSequenceOrchestratorModal (Meilenstein 59.0 / v7.1.0)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArmingSequenceOrchestratorModal } from "./ArmingSequenceOrchestratorModal";

describe("ArmingSequenceOrchestratorModal", () => {
  it("rendert ohne Fehler", () => {
    render(<ArmingSequenceOrchestratorModal />);
    expect(screen.getByTestId("arming-sequence-modal")).toBeTruthy();
  });

  it("zeigt Titel an", () => {
    render(<ArmingSequenceOrchestratorModal />);
    expect(screen.getByText(/Ritueller Einkleidungs- & Rüstungs-Orchestrator/)).toBeTruthy();
  });

  it("zeigt Spannungs-Verwebung", () => {
    render(<ArmingSequenceOrchestratorModal />);
    expect(screen.getByText(/SPANNUNGS-VERWEBUNG/)).toBeTruthy();
  });

  it("zeigt Einkleidungsszene", () => {
    render(<ArmingSequenceOrchestratorModal />);
    expect(screen.getByText(/EINKLEIDUNGSSZENE/)).toBeTruthy();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<ArmingSequenceOrchestratorModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
