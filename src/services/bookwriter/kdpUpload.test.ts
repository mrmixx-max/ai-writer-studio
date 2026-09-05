// Tests: KDP-Upload-Service (Sprint 7, Agent 1).
//
// End-to-End über die Service-Fassade: Validierung → Upload-Paket → Status-
// Tracking. ALLE Netzwerk-Calls laufen über injizierbare Fakes (0 echte API-Calls).
import { describe, it, expect, vi } from "vitest";
import {
  uploadToKdp,
  buildUploadPackage,
  prepareUpload,
  createKdpUploadService,
  type KdpUploadDeps,
} from "./kdpUpload";
import { validateUploadArtefact, type UploadFile } from "./kdpUploadValidation";
import type { KdpMetadata } from "@/types/bookwriter";

const VALID_META: KdpMetadata = {
  title: "Der Testtitan",
  subtitle: "Ein Unit-Test-Roman",
  blurbVariants: ["Klappentext " + "mit Inhalt. ".repeat(5)],
  shortDescription: "Kurzbeschreibung",
  keywords: ["tests", "qualitätssicherung"],
  categories: ["Fiction > Thriller"],
  authorBio: "Autorin.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: "cover.jpg",
  priceUsd: 4.99,
};

const FILE: UploadFile = {
  name: "manuscript.epub",
  sizeBytes: 1_500_000,
  mimeType: "application/epub+zip",
};

function deps(overrides: Partial<KdpUploadDeps> = {}): KdpUploadDeps {
  return {
    now: () => 1_000,
    randomId: () => "test-upload-id",
    ...overrides,
  };
}

describe("prepareUpload (Paket + Validierung)", () => {
  it("gültiges Paket: liefert Artefakt + Metadaten + Bestätigung", () => {
    const p = prepareUpload(FILE, VALID_META, deps());
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.package.uploadId).toBe("test-upload-id");
      expect(p.package.file.name).toBe("manuscript.epub");
      expect(p.package.metadata.title).toBe("Der Testtitan");
      expect(p.package.checklist.length).toBeGreaterThan(0);
    }
  });

  it("invalides Paket: ok=false + Issues, kein Upload-Paket", () => {
    const p = prepareUpload({ ...FILE, name: "manuscript.pdf" }, VALID_META, deps());
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.validation.issues.length).toBeGreaterThan(0);
      expect(p.validation.errorCount).toBeGreaterThan(0);
    }
  });
});

describe("buildUploadPackage", () => {
  it("erzeugt Deterministisches Paket mit ISBN-Feld und Zeitstempel", () => {
    const pkg = buildUploadPackage(FILE, VALID_META, { uploadId: "u-1", now: () => 5_000 });
    expect(pkg.uploadId).toBe("u-1");
    expect(pkg.createdAt).toBe(5_000);
    expect(pkg.isbn).toBeNull();
    expect(pkg.metadata.keywords).toEqual(VALID_META.keywords);
  });

  it("nimmt ISBN aus Optionen auf", () => {
    const pkg = buildUploadPackage(FILE, VALID_META, { uploadId: "u-2", isbn: "9783161484100" });
    expect(pkg.isbn).toBe("9783161484100");
  });
});

describe("uploadToKdp (Status-Flow, Fake-API)", () => {
  it("läuft uploading → processing → live und trackt jeden Status", async () => {
    const statuses: string[] = [];
    const result = await uploadToKdp(FILE, VALID_META, {
      ...deps(),
      onStatus: (s) => statuses.push(s.status),
      uploadFn: async () => ({ remoteId: "kdp-remote-1" }),
      pollFn: async () => "live",
    });

    expect(result.state.status).toBe("live");
    expect(statuses).toEqual(["uploading", "processing", "live"]);
    expect(result.remoteId).toBe("kdp-remote-1");
    expect(result.state.history.length).toBeGreaterThanOrEqual(2);
  });

  it("bricht mit rejected ab, wenn die Validierung fehlschlägt — ohne uploadFn zu rufen", async () => {
    const uploadFn = vi.fn(async () => ({ remoteId: "should-not-happen" }));
    const result = await uploadToKdp({ ...FILE, name: "buch.txt" }, VALID_META, { ...deps(), uploadFn });

    expect(result.state.status).toBe("rejected");
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it("reicht API-Fehler (Upload wirft) als rejected mit Grund weiter", async () => {
    const result = await uploadToKdp(FILE, VALID_META, {
      ...deps(),
      uploadFn: async () => {
        throw new Error("503 Service Unavailable");
      },
    });
    expect(result.state.status).toBe("rejected");
    expect(result.state.reason).toContain("503");
  });

  it("rejected-Polling-Ergebnis wird übernommen (KDP lehnt ab)", async () => {
    const result = await uploadToKdp(FILE, VALID_META, {
      ...deps(),
      uploadFn: async () => ({ remoteId: "r-1" }),
      pollFn: async () => "rejected",
    });
    expect(result.state.status).toBe("rejected");
  });

  it("ohne uploadFn (kein KDP-Zugang): prepare-only — endet in uploading mit Paket", async () => {
    const result = await uploadToKdp(FILE, VALID_META, deps());
    expect(result.state.status).toBe("uploading");
    expect(result.package).not.toBeNull();
    expect(result.remoteId).toBeNull();
  });
});

describe("createKdpUploadService (Fassade für CLI/Dashboard)", () => {
  it("exponiert Tracker + Upload + Status-Label", async () => {
    const svc = createKdpUploadService(deps());
    const statuses: string[] = [];
    svc.tracker.subscribe((s) => statuses.push(s.status));

    await svc.upload(FILE, VALID_META, {
      uploadFn: async () => ({ remoteId: "r-9" }),
      pollFn: async () => "live",
    });

    expect(statuses).toEqual(["uploading", "processing", "live"]);
    expect(svc.render()).toContain("Live");
  });
});

describe("validateUploadArtefact — Integration", () => {
  it("ist über den Service erreichbar (Public API des Moduls)", () => {
    expect(typeof validateUploadArtefact).toBe("function");
  });
});
