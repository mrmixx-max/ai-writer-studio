// @vitest-environment jsdom
/**
 * Tests: GuestReviewModal (WP 42.2 — Lektoren-Freigabe-Portal)
 */


import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuestReviewModal } from "./GuestReviewModal";
import type { ReviewChapter } from "@/services/collaboration/guestReviewPortal";

const CHAPTERS: ReviewChapter[] = [
  { id: "c1", title: "Kapitel 1", content: "Es war einmal ein Held." },
  { id: "c2", title: "Kapitel 2", content: "Der Held zog los." },
];

describe("GuestReviewModal", () => {
  it("rendert nicht wenn geschlossen", () => {
    const { container } = render(
      <GuestReviewModal open={false} onClose={() => {}} chapters={CHAPTERS} />,
    );
    expect(container.querySelector('[data-testid="guest-review-modal"]')).toBeNull();
  });

  it("rendert wenn offen", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    expect(screen.getByTestId("guest-review-modal")).toBeTruthy();
  });

  it("zeigt Kapitelzahl", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    expect(screen.getByTestId("guest-review-modal").textContent).toContain("2 Kapitel");
  });

  it("bietet beide Modi an", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    expect(screen.getByTestId("guest-review-mode-readonly")).toBeTruthy();
    expect(screen.getByTestId("guest-review-mode-commentable")).toBeTruthy();
  });

  it("erzeugt Link und QR-Code nach Session-Start", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("guest-review-create"));
    expect(screen.getByTestId("guest-review-link")).toBeTruthy();
    expect(screen.getByTestId("guest-review-qr")).toBeTruthy();
  });

  it("Link enthält den Token-Pfad", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("guest-review-create"));
    expect(screen.getByTestId("guest-review-link").textContent).toContain("/review/");
  });

  it("QR-Code ist ein SVG", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("guest-review-create"));
    const qr = screen.getByTestId("guest-review-qr");
    expect(qr.innerHTML).toContain("<svg");
  });

  it("schließt bei Klick auf Schließen", () => {
    const onClose = vi.fn();
    render(<GuestReviewModal open onClose={onClose} chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("guest-review-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Import-Button ruft onImportComments", () => {
    const onImport = vi.fn();
    render(
      <GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} onImportComments={onImport} />,
    );
    fireEvent.click(screen.getByTestId("guest-review-create"));
    fireEvent.click(screen.getByTestId("guest-review-import"));
    expect(onImport).toHaveBeenCalled();
  });

  it("Modus wechseln ist möglich", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />);
    fireEvent.click(screen.getByTestId("guest-review-mode-readonly"));
    fireEvent.click(screen.getByTestId("guest-review-create"));
    expect(screen.getByTestId("guest-review-link")).toBeTruthy();
  });

  it("kommt mit leerer Kapitelliste zurecht", () => {
    render(<GuestReviewModal open onClose={() => {}} chapters={[]} />);
    expect(screen.getByTestId("guest-review-modal")).toBeTruthy();
  });

  it("nutzt Design-Token statt Hex-Farben", () => {
    const { container } = render(
      <GuestReviewModal open onClose={() => {}} chapters={CHAPTERS} />,
    );
    const html = container.innerHTML;
    // Keine hardcoded Hex-Farben in den Inline-Styles (Ausnahme: QR-Weiß)
    const hexes = html.match(/background:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes.filter((h) => !h.includes("#fff"))).toEqual([]);
  });
});
