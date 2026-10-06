// @vitest-environment jsdom
/**
 * Tests: StoryDoctorConsultantModal (WP 80.1)
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryDoctorConsultantModal } from "./StoryDoctorConsultantModal";

describe("StoryDoctorConsultantModal", () => {
  it("rendert die Komponente", () => {
    render(<StoryDoctorConsultantModal />);
    expect(screen.getByTestId("story-doctor-modal")).toBeTruthy();
  });

  it("zeigt den Titel", () => {
    render(<StoryDoctorConsultantModal />);
    expect(screen.getByText("🩺 Autonomer Story-Doctor & Manuskript-Diagnostiker")).toBeTruthy();
  });

  it("zeigt Gesundheit", () => {
    render(<StoryDoctorConsultantModal />);
    expect(screen.getByTestId("doctor-health")).toBeTruthy();
  });

  it("zeigt Diagnosen", () => {
    render(<StoryDoctorConsultantModal />);
    expect(screen.getByTestId("doctor-diagnoses")).toBeTruthy();
  });

  it("reagiert auf Text-Eingabe", () => {
    render(<StoryDoctorConsultantModal />);
    fireEvent.change(screen.getByTestId("doctor-text-input"), {
      target: { value: "Der Held versprach etwas." },
    });
    expect(screen.getByTestId("doctor-diagnoses")).toBeTruthy();
  });

  it("zeigt Text-Ausgabe", () => {
    render(<StoryDoctorConsultantModal />);
    expect(screen.getByTestId("doctor-text").textContent).toContain("STORY-DOCTOR");
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(<StoryDoctorConsultantModal />);
    const hexes = container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
