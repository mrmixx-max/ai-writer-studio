// Tests fuer die Security-Grundbausteine: Crypto-Roundtrip, Auth, Privacy-Gate.
import { describe, it, expect, afterEach } from "vitest";
import { encryptString, decryptString, isEncryptedPayload, sha256Hex } from "./crypto";
import {
  encryptChapterContent,
  decryptChapterContent,
  setMasterSecret,
  clearMasterSecret,
} from "./manuscriptEncryption";
import { createAuthRecord, verifyPassword, autoLockMs } from "./auth";
import { isPrivacyMode, setPrivacyMode, isCloudProvider, assertCloudAllowed } from "./privacy";
import { validateContainerShape, type BackupContainer } from "./secureBackup";

describe("crypto", () => {
  it("verschluesselt und entschluesselt AES-256-GCM", async () => {
    const cipher = await encryptString("Kapitel 1: Es war dunkel...", "mein-passwort");
    expect(isEncryptedPayload(cipher)).toBe(true);
    expect(cipher).not.toContain("Kapitel");
    const plain = await decryptString(cipher, "mein-passwort");
    expect(plain).toBe("Kapitel 1: Es war dunkel...");
  });

  it("wirft bei falschem Passwort", async () => {
    const cipher = await encryptString("geheim", "richtig");
    await expect(decryptString(cipher, "falsch")).rejects.toThrow();
  });

  it("erzeugt stabile SHA-256-Pruefsummen", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("manuscriptEncryption", () => {
  afterEach(() => clearMasterSecret());

  it("chiffriert Kapitelinhalt nur bei gesetztem Master-Geheimnis", async () => {
    await expect(encryptChapterContent("text")).rejects.toThrow();
    setMasterSecret("s");
    const c = await encryptChapterContent("Kapitelinhalt");
    expect(isEncryptedPayload(c)).toBe(true);
    // Idempotent: bereits chiffrierte Inhalte bleiben unangetastet.
    expect(await encryptChapterContent(c)).toBe(c);
    expect(await decryptChapterContent(c)).toBe("Kapitelinhalt");
  });

  it("laesst unverschluesselten Altbestand unverndert", async () => {
    setMasterSecret("s");
    expect(await decryptChapterContent("alt")).toBe("alt");
  });
});

describe("auth", () => {
  it("verifiziert PIN korrekt (positiv + negativ)", async () => {
    const rec = await createAuthRecord("1234");
    expect(await verifyPassword("1234", rec)).toBe(true);
    expect(await verifyPassword("9999", rec)).toBe(false);
  });

  it("lehnt zu kurze PINs ab", async () => {
    await expect(createAuthRecord("ab")).rejects.toThrow();
  });

  it("mappt Auto-Lock-Einstellungen", () => {
    expect(autoLockMs("off")).toBeNull();
    expect(autoLockMs("5m")).toBe(300_000);
    expect(autoLockMs("1h")).toBe(3_600_000);
  });
});

describe("privacy", () => {
  afterEach(() => setPrivacyMode(false));

  it("blockiert Cloud-Aufrufe im Privatsphaere-Modus", () => {
    setPrivacyMode(true);
    expect(isPrivacyMode()).toBe(true);
    expect(assertCloudAllowed("Test").allowed).toBe(false);
  });

  it("erlaubt Cloud-Aufrufe ohne Privatsphaere-Modus", () => {
    setPrivacyMode(false);
    expect(assertCloudAllowed("Test").allowed).toBe(true);
  });

  it("klassifiziert Provider", () => {
    expect(isCloudProvider("openai")).toBe(true);
    expect(isCloudProvider("openrouter")).toBe(true);
    expect(isCloudProvider("gpt2api")).toBe(true);
    expect(isCloudProvider("ollama")).toBe(false);
    expect(isCloudProvider("lmstudio")).toBe(false);
  });
});

describe("secureBackup (Container-Form)", () => {
  it("erkennt gueltige und ungueltige Container", () => {
    const good: BackupContainer = {
      format: "AIWS-BACKUP-1",
      createdAt: Date.now(),
      payload: "AWS1|YWJj|aXY=|Y2lwaGVydGV4dA==",
      checksum: "a".repeat(64),
    };
    expect(validateContainerShape(good)).toBe(true);
    expect(validateContainerShape({ ...good, format: "X" as never })).toBe(false);
    expect(validateContainerShape({ ...good, checksum: "zz" })).toBe(false);
  });
});
