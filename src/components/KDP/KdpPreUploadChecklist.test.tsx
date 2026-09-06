/**
 * @vitest-environment jsdom
 */
// Tests: KDP-Pre-Upload-Checkliste (Sprint 9, Agent 3).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildPreUploadChecklist, KdpPreUploadChecklist } from "./KdpPreUploadChecklist";
import type { UploadFile } from "@/services/bookwriter/kdpUploadValidation";
import type { KdpMetadata } from "@/types/bookwriter";

const META: KdpMetadata = {
  title: "Checklisten-Roman",
  subtitle: "Sub",
  blurbVariants: ["Klappentext mit Inhalt. ".repeat(5)],
  shortDescription: "Kurz",
  keywords: ["check"],
  categories: ["Fiction > Thriller"],
  authorBio: "Autorin.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: "cover.jpg",
  priceUsd: 4.99,
};

const FILE: UploadFile = { name: "manuscript.docx", sizeBytes: 2_000_000, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

describe("buildPreUploadChecklist (reine Funktion)", () => {
  it("alle Punkte ok bei gültigem Paket mit Cover", () => {
    const items = buildPreUploadChecklist({ file: FILE, metadata: META });
    expect(items).toHaveLength(6);
    expect(items.filter((i) => i.required).every((i) => i.ok)).toBe(true);
  });

  it("meldet falsches Format (PDF) als Pflicht-Fehler", () => {
    const items = buildPreUploadChecklist({ file: { ...FILE, name: "buch.pdf" }, metadata: META });
    expect(items.find((i) => i.id === "format")?.ok).toBe(false);
    expect(items.find((i) => i.id === "format")?.required).toBe(true);
  });

  it("meldet fehlende Metadaten (Titel leer) und fehlendes Cover", () => {
    const items = buildPreUploadChecklist({
      file: FILE,
      metadata: { ...META, title: "  ", coverImage: null },
    });
    expect(items.find((i) => i.id === "metadata")?.ok).toBe(false);
    expect(items.find((i) => i.id === "cover")?.ok).toBe(false);
  });

  it("meldet fehlende Datei und ungültige ISBN", () => {
    const items = buildPreUploadChecklist({ file: null, metadata: META, isbn: "123" });
    expect(items.find((i) => i.id === "format")?.ok).toBe(false);
    expect(items.find((i) => i.id === "isbn")?.ok).toBe(false);
    expect(items.find((i) => i.id === "isbn")?.required).toBe(false);
  });

  it("Preis außerhalb des Bereichs ist ein Fehler, Cover-Hint erklärt Review-Risiko", () => {
    const items = buildPreUploadChecklist({
      file: FILE,
      metadata: { ...META, priceUsd: 500, coverImage: null },
    });
    expect(items.find((i) => i.id === "price")?.ok).toBe(false);
    expect(items.find((i) => i.id === "cover")?.hint).toContain("Review");
  });
});

describe("KdpPreUploadChecklist (Komponente)", () => {
  it("rendert 6 Punkte + Summary und aktiven Upload-Button bei gültigem Paket", () => {
    const onUpload = vi.fn();
    render(<KdpPreUploadChecklist file={FILE} metadata={META} onUpload={onUpload} />);
    expect(screen.getByTestId("kdp-preupload-checklist")).toBeTruthy();
    expect(screen.getByTestId("kdp-preupload-summary").textContent).toContain("6/6");
    const btn = screen.getByTestId("kdp-preupload-upload-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("blockiert den Upload-Button bei offenem Pflichtpunkt", () => {
    render(<KdpPreUploadChecklist file={FILE} metadata={{ ...META, coverImage: null }} onUpload={() => {}} />);
    const btn = screen.getByTestId("kdp-preupload-upload-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId("kdp-preupload-blocking").textContent).toContain("blockiert");
    expect(screen.getByTestId("kdp-preupload-item-cover").getAttribute("data-ok")).toBe("false");
  });
});
