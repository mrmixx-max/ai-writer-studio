// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialMediaPostSynthesizerModal } from "./SocialMediaPostSynthesizerModal";

describe("SocialMediaPostSynthesizerModal", () => {
  it("rendert ohne Fehler", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByTestId("social-media-post-modal")).toBeInTheDocument();
  });

  it("zeigt Titel an", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByText(/Multi-Plattform-Post-Synthesizer/)).toBeInTheDocument();
  });

  it("listet alle vier Plattformen", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getAllByText(/BookTok \/ Reels/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Instagram-Karussell/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Threads & X/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LinkedIn \/ Substack/).length).toBeGreaterThan(0);
  });

  it("zeigt den Post mit Inhalt und Hashtags", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByText(/POST:/)).toBeInTheDocument();
    // Hashtags werden als einzelne Spans gerendert — prüfe, dass welche vorhanden sind
    const hashtagElements = screen.getAllByText(/#\w+/);
    expect(hashtagElements.length).toBeGreaterThan(0);
  });

  it("zeigt das Karussell", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByText(/KARUSSELL/)).toBeInTheDocument();
    expect(screen.getAllByText(/Folie 1:/).length).toBeGreaterThan(0);
  });

  it("zeigt den Hashtag-Kurator", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByText(/HASHTAG-KURATOR/)).toBeInTheDocument();
    expect(screen.getByText(/Primär:/)).toBeInTheDocument();
  });

  it("zeigt die Kampagnen-Übersicht", () => {
    render(<SocialMediaPostSynthesizerModal />);
    expect(screen.getByText(/KAMPAGNEN-ÜBERSICHT/)).toBeInTheDocument();
  });

  it("nutzt keine Hex-Farben", () => {
    const { container } = render(<SocialMediaPostSynthesizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
