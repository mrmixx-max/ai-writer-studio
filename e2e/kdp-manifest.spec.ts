// E2E Runde 2: KDP-Bundle-Manifest-Vorschau (offline, synthetische Dateien).
// Prüft die echte Bundle-Logik (buildKdpBundle/serializeManifest/
// verifyBundleHashes) im echten Browser: Manifest-Felder, SHA256-Hashes,
// Upload-Gate mit/ohne Cover.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

const KDP_MOD = "/src/services/bookwriter/kdpPackage.ts";

const METADATA = {
  title: "E2E-Testbuch",
  subtitle: "",
  blurbVariants: [],
  shortDescription: "Kurzbeschreibung",
  keywords: ["test"],
  categories: ["Fiction"],
  authorBio: "",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: null,
  priceUsd: 2.99,
};

async function buildBundle(
  page: Page,
  withCover: boolean,
): Promise<{
  fileNames: string[];
  title: string;
  coverPresent: boolean;
  canUpload: boolean;
  hashLen: number;
  manifestJson: string;
  manifestName: string;
  verifyOk: boolean;
}> {
  return page.evaluate(
    async ({ mod, metadata, withCover: wc }) => {
      const m = await import(mod);
      const filler = "Lorem ipsum dolor sit amet. ".repeat(200); // > 1 KB (KDP_MIN_FILE_BYTES)
      const manifestName = m.KDP_BUNDLE_MANIFEST_NAME as string;
      const manuscript = {
        name: "manuscript.epub",
        blob: new Blob([filler], { type: "application/epub+zip" }),
        mimeType: "application/epub+zip",
      };
      const cover = wc
        ? {
            name: "cover.jpg",
            blob: new Blob([new Uint8Array(2048).fill(7)], {
              type: "image/jpeg",
            }),
            mimeType: "image/jpeg",
          }
        : null;
      const bundle = await m.buildKdpBundle({
        title: "E2E-Testbuch",
        author: "E2E Autor",
        language: "de",
        isbn: null,
        metadata,
        manuscript,
        cover,
      });
      const json = m.serializeManifest(bundle.manifest);
      const toBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
      const payloads: Record<string, Uint8Array> = {
        [manuscript.name]: await toBytes(manuscript.blob),
      };
      if (cover) payloads[cover.name] = await toBytes(cover.blob);
      const checks = await m.verifyBundleHashes(bundle.manifest, payloads);
      const verifyOk = checks.length > 0 && checks.every((c: { ok: boolean }) => c.ok);
      return {
        fileNames: bundle.manifest.files.map((f: { name: string }) => f.name),
        title: bundle.manifest.title,
        coverPresent: bundle.manifest.coverPresent,
        canUpload: bundle.canUpload,
        hashLen: bundle.manifest.files[0]?.sha256?.length ?? 0,
        manifestJson: json,
        manifestName,
        verifyOk,
      };
    },
    { mod: KDP_MOD, metadata: METADATA, withCover },
  );
}

test("KDP-Manifest-Vorschau: Dateien + SHA256 + Titel stimmen", async ({
  page,
}) => {
  await pinGerman(page);
  await gotoApp(page);

  const b = await buildBundle(page, true);
  expect(b.title).toBe("E2E-Testbuch");
  expect(b.fileNames).toContain("manuscript.epub");
  expect(b.fileNames).toContain("cover.jpg");
  // kdp-manifest.json entsteht beim ZIP-Pack; hier liegt der Name als Konstante + Inhalt vor.
  expect(b.manifestName).toBe("kdp-manifest.json");
  expect(b.hashLen).toBe(64); // SHA256-Hex
  expect(b.manifestJson).toContain("E2E-Testbuch");
  expect(b.coverPresent).toBe(true);
});

test("KDP-Bundle-Hashes verifizieren fehlerfrei", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);

  const b = await buildBundle(page, true);
  expect(b.verifyOk).toBe(true);
});

test("KDP ohne Cover: Upload-Gate blockiert, Manifest belegt es", async ({
  page,
}) => {
  await pinGerman(page);
  await gotoApp(page);

  const b = await buildBundle(page, false);
  expect(b.coverPresent).toBe(false);
  expect(b.canUpload).toBe(false);
  expect(b.manifestJson).toContain("E2E-Testbuch");
});
