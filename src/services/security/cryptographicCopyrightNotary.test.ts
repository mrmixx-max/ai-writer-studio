// @vitest-environment jsdom
/** Tests: CryptographicCopyrightNotary (WP 93.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  notarizeDocument,
  verifyNotaryCertificate,
  formatCertificate,
  createSampleCertificate as _createSampleCertificate,
  createSampleProof as _createSampleProof,
  type NotaryCertificate as _NotaryCertificate,
  type MerkleProof as _MerkleProof,
} from "./cryptographicCopyrightNotary";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("notarizeDocument", () => {
  it("erzeugt Zertifikat mit allen Feldern", async () => {
    const cert = await notarizeDocument("Test-Manuskript", "Autor", "Titel", 123);
    expect(cert.id).toContain("NOTARY-");
    expect(cert.documentHash).toBeTruthy();
    expect(cert.merkleRoot).toBeTruthy();
    expect(cert.timestamp).toBeTruthy();
    expect(cert.author).toBe("Autor");
    expect(cert.title).toBe("Titel");
    expect(cert.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(cert.signature).toBeTruthy();
    expect(cert.tsaUrl).toBeTruthy();
    expect(cert.tsaToken).toBeTruthy();
  });

  it("erzeugt deterministische Zertifikate (Hash, Merkle Root)", async () => {
    const c1 = await notarizeDocument("Test", "Autor", "Titel", 42);
    const c2 = await notarizeDocument("Test", "Autor", "Titel", 42);
    // ID ist deterministisch, aber Timestamp, KeyPair und Signatur nicht
    expect(c1.documentHash).toBe(c2.documentHash);
    expect(c1.merkleRoot).toBe(c2.merkleRoot);
  });

  it("verschiedene Texte erzeugen verschiedene Hashes", async () => {
    const c1 = await notarizeDocument("Text A", "Autor", "Titel", 1);
    const c2 = await notarizeDocument("Text B", "Autor", "Titel", 1);
    expect(c1.documentHash).not.toBe(c2.documentHash);
  });
});

describe("verifyNotaryCertificate", () => {
  it("verifiziert gültiges Zertifikat", async () => {
    const cert = await notarizeDocument("Test", "Autor", "Titel", 42);
    const result = await verifyNotaryCertificate(cert);
    expect(result.valid).toBe(true);
    expect(result.documentHashMatches).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.timestampValid).toBe(true);
    expect(result.merkleValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("erkennnt manipulierte Signatur", async () => {
    const cert = await notarizeDocument("Test", "Autor", "Titel", 42);
    const tamperedCert = { ...cert, signature: "X".repeat(cert.signature.length) };
    const result = await verifyNotaryCertificate(tamperedCert);
    expect(result.valid).toBe(false);
    expect(result.signatureValid).toBe(false);
  });
});

describe("formatCertificate", () => {
  it("formatiert als lesbaren Text", () => {
    const cert = _createSampleCertificate();
    const text = formatCertificate(cert);
    expect(text).toContain("URHEBERRECHTS-NOTARIATS-ZERTIFIKAT");
    expect(text).toContain("PUBLIC KEY");
    expect(text).toContain("RFC 3161 TIMESTAMP TOKEN");
  });
});

describe("createSampleCertificate", () => {
  it("erzeugt Beispielzertifikat", () => {
    const cert = _createSampleCertificate();
    expect(cert.id).toContain("NOTARY-");
    expect(cert.author).toBe("Max Mustermann");
  });
});

describe("createSampleProof", () => {
  it("erzeugt Beispiel-Merkle-Proof", () => {
    const proof = _createSampleProof();
    expect(proof.leafHash).toBeTruthy();
    expect(proof.siblings.length).toBeGreaterThan(0);
    expect(proof.root).toBeTruthy();
  });
});