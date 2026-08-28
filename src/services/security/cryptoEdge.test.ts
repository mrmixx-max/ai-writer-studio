// Ergaenzende Krypto- und Privacy-Gate-Edge-Cases (ohne Tauri-Abhaengigkeit).
// Datei: src/services/security/cryptoEdge.test.ts
import { describe, it, expect, afterEach } from "vitest";
import {
  toBase64,
  fromBase64,
  randomBytes,
  sha256Hex,
  isEncryptedPayload,
  encryptString,
  decryptString,
} from "./crypto";
import { requireCloudAllowed, assertCloudAllowed, setPrivacyMode } from "./privacy";
import { createAuthRecord, verifyPassword } from "./auth";

describe("base64-Helfer", () => {
  it("rundet Bytes hin und her", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = toBase64(bytes);
    expect([...fromBase64(b64)]).toEqual([...bytes]);
  });

  it("handhabt leere Eingaben", () => {
    expect(toBase64(new Uint8Array(0))).toBe("");
    expect(fromBase64("").length).toBe(0);
  });
});

describe("randomBytes / sha256", () => {
  it("erzeugt die angeforderte Laenge und unterschiedliche Werte", () => {
    const a = randomBytes(16);
    const b = randomBytes(16);
    expect(a.length).toBe(16);
    expect(b.length).toBe(16);
    expect([...a]).not.toEqual([...b]);
  });

  it("akzeptiert Bytes und Strings fuer SHA-256", async () => {
    const fromString = await sha256Hex("abc");
    const fromBytes = await sha256Hex(new TextEncoder().encode("abc"));
    expect(fromString).toBe(fromBytes);
  });
});

describe("isEncryptedPayload", () => {
  it("erkennt das AWS1-Format", () => {
    expect(isEncryptedPayload("AWS1|a|b|c")).toBe(true);
    expect(isEncryptedPayload("AWS1")).toBe(false);
    expect(isEncryptedPayload("AWS2|x")).toBe(false);
    expect(isEncryptedPayload("")).toBe(false);
    expect(isEncryptedPayload(undefined as never)).toBe(false);
  });
});

describe("decryptString Edge-Cases", () => {
  it("wirft bei fehlendem AWS1-Praefix", async () => {
    await expect(decryptString("RAND|a|b|c", "pw")).rejects.toThrow(/Chiffreformat/);
  });

  it("wirft bei falscher Feldanzahl", async () => {
    await expect(decryptString("AWS1|a|b", "pw")).rejects.toThrow(/Chiffreformat/);
    await expect(decryptString("AWS1|a|b|c|d", "pw")).rejects.toThrow(/Chiffreformat/);
  });

  it("leert einen verschluesselten String korrekt ab", async () => {
    const cipher = await encryptString("", "pw");
    expect(await decryptString(cipher, "pw")).toBe("");
  });

  it("verschluesselt Unicode / Umlaute verlustfrei", async () => {
    const text = "Grüße aus Köln — Müller ⌀ 🚀";
    const cipher = await encryptString(text, "pässwort");
    expect(await decryptString(cipher, "pässwort")).toBe(text);
  });
});

describe("requireCloudAllowed (Privacy-Gate-Wirkung)", () => {
  afterEach(() => setPrivacyMode(false));

  it("wirft im Privatsphaere-Modus mit erkennbarem Kontext", () => {
    setPrivacyMode(true);
    expect(() => requireCloudAllowed("checkForUpdates")).toThrow(/checkForUpdates/);
    const d = assertCloudAllowed("checkForUpdates");
    expect(d).toEqual({ allowed: false, reason: "privacy-mode" });
  });

  it("erlaubt ohne Privatsphaere-Modus", () => {
    setPrivacyMode(false);
    const d = assertCloudAllowed("checkForUpdates");
    expect(d).toEqual({ allowed: true, reason: "ok" });
    expect(() => requireCloudAllowed("checkForUpdates")).not.toThrow();
  });
});

describe("verifyPassword Robustheit", () => {
  it("lehnt ein Passwort gegen einen anderen Record ab (kein Crash)", async () => {
    const rec = await createAuthRecord("seite-a");
    const other = await createAuthRecord("seite-b");
    expect(await verifyPassword("seite-a", other)).toBe(false);
    expect(await verifyPassword("", rec)).toBe(false);
  });

  it("erzeugt Records mit 64-Hex-Hash und Base64-Salt", async () => {
    const rec = await createAuthRecord("123456");
    expect(rec.hashHex).toMatch(/^[0-9a-f]{64}$/);
    expect(() => atob(rec.saltB64)).not.toThrow();
    expect(rec.iterations).toBeGreaterThan(100_000);
    expect(typeof rec.createdAt).toBe("number");
  });
});
