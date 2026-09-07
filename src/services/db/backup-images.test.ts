// Tests: Bilder-Backup (Sprint 14, Agent 5) — Export/Restore mit Bild-Assets,
// Manifest-Hashes, Korruptions-/Fehlbehandlung. Baut auf backup.ts auf.
import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter } from "@/services/project";
import {
  IMAGE_BACKUP_VERSION,
  exportBackupWithImages,
  exportBackupWithImagesJson,
  serializeBackupWithImages,
  validateBackupWithImages,
  validateImages,
  restoreBackupWithImages,
  sha256HexSync,
  hashImageData,
  type ImageAssetInput,
  type StoredImageAsset,
} from "@/services/db/backup-images";

function doc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

const COVER: ImageAssetInput = {
  id: "img-cover-1",
  kind: "cover",
  projectId: "p1",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAACOVER",
};

const GEN: ImageAssetInput = {
  id: "img-gen-1",
  kind: "generated",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAAGENERATED",
};

let db: Database;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
});

describe("sha256HexSync", () => {
  it("erfuellt den FIPS-180-4-Testvektor ('abc')", () => {
    expect(sha256HexSync("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("leerer String ergibt den bekannten Leer-Hash", () => {
    expect(sha256HexSync("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("Bilder-Export", () => {
  it("exportiert Cover + generierte Bilder mit Manifest-Hashes und Zaehlern", async () => {
    const p = await createProject("Bilder-Buch");
    await createChapter(p.id, "Kapitel Eins", doc("Text mit Bild."));
    const b = exportBackupWithImages(
      [{ ...COVER, projectId: p.id }, GEN],
      db,
    );
    expect(b.imageBackupVersion).toBe(IMAGE_BACKUP_VERSION);
    expect(b.imageCounts).toEqual({ images: 2, cover: 1, generated: 1 });
    expect(b.images).toHaveLength(2);
    for (const img of b.images) {
      expect(img.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(img.sha256).toBe(hashImageData(img.dataUrl));
      expect(img.byteLength).toBe(img.dataUrl.length);
    }
    expect(b.counts).toEqual({ projects: 1, chapters: 1 });
  });

  it("gleicher Bildinhalt ergibt stabil den gleichen Hash", () => {
    const a = exportBackupWithImages([COVER], db);
    const b = exportBackupWithImages([{ ...COVER }], db);
    expect(a.images[0].sha256).toBe(b.images[0].sha256);
  });

  it("leere Bilderliste ergibt gueltiges Backup mit 0 Bildern", () => {
    const b = exportBackupWithImages([], db);
    expect(b.imageCounts).toEqual({ images: 0, cover: 0, generated: 0 });
    expect(validateBackupWithImages(JSON.stringify(b)).ok).toBe(true);
  });
});

describe("Bilder-Validierung", () => {
  it("akzeptiert ein Alt-Backup ohne images-Feld (Rueckwaertskompatibilitaet)", async () => {
    const p = await createProject("Alt-Buch");
    await createChapter(p.id, "K1", doc("Alt."));
    const { exportBackupJson } = await import("@/services/db/backup");
    const legacy = exportBackupJson(db);
    const res = validateBackupWithImages(legacy);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.backup.images ?? []).toEqual([]);
  });

  it("erkennt ein korruptes Bild (manipulierte dataUrl, Hash weicht ab)", () => {
    const b = exportBackupWithImages([COVER, GEN], db);
    const tampered = {
      ...b,
      images: b.images.map((img, i) =>
        i === 0 ? { ...img, dataUrl: img.dataUrl + "MANIPULIERT" } : img,
      ),
    };
    const res = validateImages(tampered);
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].kind).toBe("corrupt");
    expect(res.issues[0].id).toBe("img-cover-1");
    // Das intakte Bild bleibt gueltig.
    expect(res.images.map((i) => i.id)).toEqual(["img-gen-1"]);
  });

  it("meldet ein fehlendes Bild (leere dataUrl) als missing", () => {
    const b = exportBackupWithImages([COVER], db);
    const broken = {
      ...b,
      images: [{ ...b.images[0], dataUrl: "" }],
    };
    const res = validateImages(broken);
    expect(res.ok).toBe(false);
    expect(res.issues[0].kind).toBe("missing");
  });

  it("weist ungueltige Bildarten und Hash-Formate zurueck", () => {
    const badKind = { images: [{ ...COVER, kind: "thumbnail", sha256: hashImageData(COVER.dataUrl), byteLength: COVER.dataUrl.length }] };
    expect(validateImages(badKind).issues[0].kind).toBe("invalid");
    const badHash = { images: [{ ...COVER, sha256: "kein-hash", byteLength: COVER.dataUrl.length }] };
    expect(validateImages(badHash).issues[0].kind).toBe("invalid");
  });
});

describe("Bilder-Roundtrip + Restore", () => {
  it("Roundtrip: Export -> Restore stellt DB + Bilder wieder her", async () => {
    const p = await createProject("Roundtrip-Buch");
    await createChapter(p.id, "K1", doc("Roundtrip-Text."));
    const saved: StoredImageAsset[] = [];
    const json = exportBackupWithImagesJson(
      [{ ...COVER, projectId: p.id }, GEN],
      db,
    );
    // DB leeren, dann zurueckspielen.
    db.run("DELETE FROM chapters;");
    db.run("DELETE FROM projects;");
    const res = await restoreBackupWithImages(json, db, {
      imageStore: { save: (img) => void saved.push(img) },
    });
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.restoredProjects).toBe(1);
    expect(res.restoredChapters).toBe(1);
    expect(res.restoredImages).toBe(2);
    expect(res.skippedImages).toBe(0);
    expect(saved.map((s) => s.id).sort()).toEqual(["img-cover-1", "img-gen-1"]);
    // Hash-Integritaet der wiederhergestellten Bilder.
    for (const s of saved) expect(s.sha256).toBe(hashImageData(s.dataUrl));
  });

  it("korruptes Bild bricht Restore mit fail-Policy ab (DB bleibt unveraendert)", async () => {
    const p = await createProject("Korrupt-Buch");
    await createChapter(p.id, "K1", doc("Text."));
    const b = exportBackupWithImages([{ ...COVER, projectId: p.id }], db);
    const bad = serializeBackupWithImages({
      ...b,
      images: [{ ...b.images[0], dataUrl: b.images[0].dataUrl + "X" }],
    });
    db.run("DELETE FROM chapters;");
    db.run("DELETE FROM projects;");
    const res = await restoreBackupWithImages(bad, db);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("beschaedigt");
    expect(res.restoredProjects).toBe(0);
    expect(res.imageIssues[0].kind).toBe("corrupt");
  });

  it("skip-Policy stellt DB trotz fehlendem Bild wieder her", async () => {
    const p = await createProject("Skip-Buch");
    await createChapter(p.id, "K1", doc("Text."));
    const b = exportBackupWithImages([{ ...COVER, projectId: p.id }, GEN], db);
    const partial = serializeBackupWithImages({
      ...b,
      images: [{ ...b.images[0], dataUrl: "" }, b.images[1]],
    });
    db.run("DELETE FROM chapters;");
    db.run("DELETE FROM projects;");
    const res = await restoreBackupWithImages(partial, db, { onMissing: "skip" });
    expect(res.ok).toBe(true);
    expect(res.restoredProjects).toBe(1);
    expect(res.restoredImages).toBe(1);
    expect(res.skippedImages).toBe(1);
    expect(res.imageIssues[0].kind).toBe("missing");
  });
});
