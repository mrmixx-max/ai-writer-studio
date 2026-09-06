// Tests: KDP-Upload-Bundle (Sprint 11, Agent 3).
//
// Manifest-Korrektheit, SHA256-Stabilitaet, Validierungs-Gate.
// Alle Hashes laufen lokal (WebCrypto) — 0 echte API-Calls.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildKdpBundle,
  bundleToZip,
  serializeManifest,
  sha256Hex,
  verifyBundleHashes,
  KDP_BUNDLE_MANIFEST_NAME,
  KDP_BUNDLE_VERSION,
  type KdpBundleInput,
} from "./kdpPackage";
import type { KdpMetadata } from "@/types/bookwriter";

const META: KdpMetadata = {
  title: "Bundle-Roman",
  subtitle: "Sub",
  blurbVariants: ["Klappentext mit Inhalt. ".repeat(5)],
  shortDescription: "Kurz",
  keywords: ["bundle", "kdp"],
  categories: ["Fiction > Thriller"],
  authorBio: "Autorin.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: "cover.jpg",
  priceUsd: 4.99,
};

/** Manuskript-Bytes (>= 1 KB, sonst greift das KDP-Minimum aus der Validierung). */
function manuscriptBytes(seed = "Kapiteltext. "): Uint8Array {
  return new TextEncoder().encode(seed.repeat(200));
}

function input(overrides: Partial<KdpBundleInput> = {}): KdpBundleInput {
  return {
    title: "Bundle-Roman",
    author: "Test Autorin",
    language: "de",
    metadata: META,
    manuscript: {
      name: "bundle-roman.epub",
      mimeType: "application/epub+zip",
      blob: new Blob([manuscriptBytes() as BlobPart], { type: "application/epub+zip" }),
    },
    cover: {
      name: "cover.jpg",
      mimeType: "image/jpeg",
      blob: new Blob([new TextEncoder().encode("fake-cover-bytes")], { type: "image/jpeg" }),
    },
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe("sha256Hex", () => {
  it("liefert den bekannten SHA256-Vektor fuer 'abc'", async () => {
    const hash = await sha256Hex(new TextEncoder().encode("abc"));
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("ist stabil: gleiche Bytes liefern den gleichen Hash", async () => {
    const bytes = manuscriptBytes();
    expect(await sha256Hex(bytes)).toBe(await sha256Hex(bytes.slice()));
  });

  it("unterscheidet verschiedene Inhalte", async () => {
    const a = await sha256Hex(new TextEncoder().encode("fassung-a"));
    const b = await sha256Hex(new TextEncoder().encode("fassung-b"));
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("buildKdpBundle (Manifest)", () => {
  it("Manifest enthaelt Titel, Autor, Sprache und Version", async () => {
    const bundle = await buildKdpBundle(input());
    expect(bundle.manifest.title).toBe("Bundle-Roman");
    expect(bundle.manifest.author).toBe("Test Autorin");
    expect(bundle.manifest.language).toBe("de");
    expect(bundle.manifest.version).toBe(KDP_BUNDLE_VERSION);
  });

  it("ISBN wird uebernommen, fehlt sie ist sie null", async () => {
    const withIsbn = await buildKdpBundle(input({ isbn: "9783161484100" }));
    expect(withIsbn.manifest.isbn).toBe("9783161484100");
    const without = await buildKdpBundle(input({ isbn: null }));
    expect(without.manifest.isbn).toBeNull();
  });

  it("Dateigroessen im Manifest stimmen mit den Blob-Groessen ueberein", async () => {
    const cfg = input();
    const bundle = await buildKdpBundle(cfg);
    const ms = bundle.manifest.files.find((f) => f.role === "manuscript")!;
    const cover = bundle.manifest.files.find((f) => f.role === "cover")!;
    expect(ms.sizeBytes).toBe(cfg.manuscript.blob.size);
    expect(cover.sizeBytes).toBe(cfg.cover!.blob.size);
    expect(ms.sha256).toHaveLength(64);
  });

  it("Hash ist stabil ueber zwei Bundle-Laeufe mit identischen Bytes", async () => {
    const first = await buildKdpBundle(input());
    const second = await buildKdpBundle(input());
    const hashOf = (m: typeof first) => m.manifest.files.find((f) => f.role === "manuscript")!.sha256;
    expect(hashOf(first)).toBe(hashOf(second));
  });

  it("Manifest serialisiert als gueltiges JSON (Round-Trip)", async () => {
    const bundle = await buildKdpBundle(input());
    const parsed = JSON.parse(serializeManifest(bundle.manifest));
    expect(parsed.title).toBe("Bundle-Roman");
    expect(parsed.files).toHaveLength(2);
    expect(parsed.checklist.length).toBeGreaterThan(0);
  });
});

describe("buildKdpBundle (Validierungs-Gate)", () => {
  it("gueltiges Bundle mit Cover ist uploadfaehig", async () => {
    const bundle = await buildKdpBundle(input());
    expect(bundle.validation.isValid).toBe(true);
    expect(bundle.canUpload).toBe(true);
  });

  it("blockiert bei falschem Manuskript-Format (PDF)", async () => {
    const bundle = await buildKdpBundle(
      input({
        manuscript: {
          name: "buch.pdf",
          mimeType: "application/pdf",
          blob: new Blob([manuscriptBytes() as BlobPart], { type: "application/pdf" }),
        },
      }),
    );
    expect(bundle.validation.isValid).toBe(false);
    expect(bundle.canUpload).toBe(false);
    expect(bundle.validation.errorCount).toBeGreaterThan(0);
  });

  it("blockiert bei fehlendem Pflichtfeld (Titel leer)", async () => {
    const bundle = await buildKdpBundle(input({ metadata: { ...META, title: "  " } }));
    expect(bundle.canUpload).toBe(false);
    expect(bundle.manifest.validation.issues.some((i) => i.field === "metadata")).toBe(true);
  });

  it("blockiert ohne Cover-Nachweis, auch bei gueltiger Datei-Validierung", async () => {
    const bundle = await buildKdpBundle(
      input({ cover: null, metadata: { ...META, coverImage: null } }),
    );
    expect(bundle.validation.isValid).toBe(true);
    expect(bundle.manifest.coverPresent).toBe(false);
    expect(bundle.canUpload).toBe(false);
  });
});

describe("verifyBundleHashes", () => {
  it("bestaetigt intakte Bundle-Bytes", async () => {
    const cfg = input();
    const bundle = await buildKdpBundle(cfg);
    const payloads = {
      [cfg.manuscript.name]: new Uint8Array(await cfg.manuscript.blob.arrayBuffer()),
      [cfg.cover!.name]: new Uint8Array(await cfg.cover!.blob.arrayBuffer()),
    };
    const checks = await verifyBundleHashes(bundle.manifest, payloads);
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("erkennt manipulierte Bytes", async () => {
    const cfg = input();
    const bundle = await buildKdpBundle(cfg);
    const tampered = manuscriptBytes("Manipuliert! ");
    const payloads = {
      [cfg.manuscript.name]: tampered,
      [cfg.cover!.name]: new Uint8Array(await cfg.cover!.blob.arrayBuffer()),
    };
    const checks = await verifyBundleHashes(bundle.manifest, payloads);
    expect(checks.find((c) => c.name === cfg.manuscript.name)?.ok).toBe(false);
    expect(checks.find((c) => c.name === cfg.cover!.name)?.ok).toBe(true);
  });

  it("meldet fehlende Dateien als nicht-ok", async () => {
    const bundle = await buildKdpBundle(input());
    const checks = await verifyBundleHashes(bundle.manifest, {});
    expect(checks.every((c) => c.ok === false && c.actual === null)).toBe(true);
  });
});

describe("bundleToZip", () => {
  it("ZIP enthaelt Manuskript, Cover und Manifest", async () => {
    const bundle = await buildKdpBundle(input());
    const { filename, blob } = await bundleToZip(bundle);
    expect(filename).toMatch(/_kdp\.zip$/);
    expect(blob.size).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file(bundle.manuscript.name)).not.toBeNull();
    expect(zip.file(bundle.cover!.name)).not.toBeNull();
    const manifestFile = zip.file(KDP_BUNDLE_MANIFEST_NAME);
    expect(manifestFile).not.toBeNull();
    const parsed = JSON.parse(await manifestFile!.async("string"));
    expect(parsed.title).toBe("Bundle-Roman");
  });

  it("ZIP ohne Cover enthaelt nur Manuskript + Manifest", async () => {
    const bundle = await buildKdpBundle(
      input({ cover: null, metadata: { ...META, coverImage: "cover.jpg" } }),
    );
    const { blob } = await bundleToZip(bundle);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toHaveLength(2);
  });
});
