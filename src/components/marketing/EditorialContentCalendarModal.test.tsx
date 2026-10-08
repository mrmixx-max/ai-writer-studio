// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorialContentCalendarModal } from "./EditorialContentCalendarModal";

describe("EditorialContentCalendarModal", () => {
  it("rendert ohne Fehler", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getByTestId("editorial-calendar-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getByText(/30-Tage-Launch-Redaktionskalender/)).toBeInTheDocument();
  });

  it("listet alle vier Kampagnen-Phasen", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getByText(/Pre-Order \/ Ankündigung \(Tag 1–10\)/)).toBeInTheDocument();
    expect(screen.getByText(/Hype-Countdown \(Tag 11–20\)/)).toBeInTheDocument();
    expect(screen.getByText(/Release-Week \(Tag 21–25\)/)).toBeInTheDocument();
    expect(screen.getByText(/Post-Launch \(Tag 26–30\)/)).toBeInTheDocument();
  });

  it("listet alle fünf Kanäle", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getAllByText(/Instagram/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BookTok/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Threads \/ X/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Newsletter/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LinkedIn/).length).toBeGreaterThan(0);
  });

  it("zeigt den ausgewählten Tag mit Details", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getByText(/TAG 15:/)).toBeInTheDocument();
    expect(screen.getByText(/Phase:/)).toBeInTheDocument();
    expect(screen.getByText(/Kanal:/)).toBeInTheDocument();
  });

  it("zeigt den Export", () => {
    render(<EditorialContentCalendarModal />);
    expect(screen.getByText(/EXPORT/)).toBeInTheDocument();
    expect(screen.getByText(/CSV:/)).toBeInTheDocument();
    expect(screen.getByText(/Markdown:/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<EditorialContentCalendarModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
