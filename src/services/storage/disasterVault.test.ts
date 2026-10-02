// ---------------------------------------------------------------------------
// WP 23.2 — Tests fuer den Disaster-Vault (AES-256-GCM & Integritaetspruefung)
// ---------------------------------------------------------------------------
// Der Service ist rein lokal und deterministisch: keine LLM-Aufrufe, kein Netz,
// keine Tauri-IPC. Fuer reproduzierbare Bytes werden Salt/IV/Zeitstempel per
// Options injiziert; ansonsten sind Salt und IV pro Archiv zufaellig.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  DEFAULT_CHUNK_SIZE,
  VAULT_HEADER_SIZE,
  VAULT_MAGIC,
  VAULT_SALT_SIZE,
  VAULT_IV_SIZE,
  exportToVault,
  isVaultArchive,
  normalizeVaultProject,
  restoreFromVault,
  sha256Bytes,
  verifyIntegrity,
  type VaultProject,
} from "./disasterVault";

// Feste, gueltige Krypto-Vorgaben fuer deterministische Tests.
const SALT = new Uint8Array(VAULT_SALT_SIZE).fill(0x11);
const IV = new Uint8Array(VAULT_IV_SIZE).fill(0x22);
const FAST_ITERATIONS = 1_000; // Testgeschwindigkeit; Produktion nutzt 310_000
const DETERMINISTIC = { salt: SALT, iv: IV, createdAt: 1_700_000_000_000, iterations: FAST_ITERATIONS } as const;

function sampleProject(): VaultProject {
  return {
    name: "Der letzte Tresor",
    chapters: ["Kapitel 1: Ankunft", "Kapitel 2: Der Absturz", "Kapitel 3: Restore"],
    database: new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x00, 0xff, 0x10, 0x20]),
    images: [new Uint8Array([1, 2, 3, 4, 5]), new Uint8Array([255, 254, 253])],
    audioCues: ["cue-01", "cue-02"],
    notes: ["Backup vor dem Umzug", "PIN im Safe"],
  };
}

/** Liest die Manifest-Laenge (u32 bei Offset 128) aus dem Container. */
function manifestLength(archive: Uint8Array): number {
  return new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(VAULT_HEADER_SIZE, false);
}

function payloadStart(archive: Uint8Array): number {
  return VAULT_HEADER_SIZE + 4 + manifestLength(archive);
}

describe("disasterVault — sha256Bytes (synchron, FIPS 180-4)", () => {
  it("stimmt mit Nodes crypto.createHash('sha256') ueberein", () => {
    const inputs: Uint8Array[] = [
      new Uint8Array(0),
      new TextEncoder().encode("a"),
      new TextEncoder().encode("hello world"),
      new Uint8Array(55).fill(0xab), // Padding-Grenze 55 Byte
      new Uint8Array(56).fill(0xcd), // Padding-Grenze 56 Byte (Extra-Block)
      new Uint8Array(1000).map((_, i) => i % 256),
    ];
    for (const input of inputs) {
      const expected = createHash("sha256").update(Buffer.from(input)).digest("hex");
      expect(Buffer.from(sha256Bytes(input)).toString("hex")).toBe(expected);
    }
  });

  it("liefert immer genau 32 Byte", () => {
    expect(sha256Bytes(new Uint8Array(0)).length).toBe(32);
    expect(sha256Bytes(new Uint8Array(4096)).length).toBe(32);
  });
});

describe("disasterVault — normalizeVaultProject (defensive Fallbacks)", () => {
  it("ersetzt fehlende Felder durch sichere Defaults", () => {
    const p = normalizeVaultProject({});
    expect(p.name).toBe("Unbenannt");
    expect(p.chapters).toEqual([]);
    expect(p.database).toBeInstanceOf(Uint8Array);
    expect(p.database.length).toBe(0);
    expect(p.images).toEqual([]);
    expect(p.audioCues).toEqual([]);
    expect(p.notes).toEqual([]);
  });

  it("verwirft ungueltige Array-Eintraege statt zu werfen", () => {
    const p = normalizeVaultProject({
      name: "  ",
      chapters: ["ok", 42, null, undefined, { x: 1 }] as unknown as string[],
      images: [null, new Uint8Array([9]), undefined] as unknown as Uint8Array[],
    });
    expect(p.name).toBe("Unbenannt"); // leerer/Whitespace-Name wird ersetzt
    expect(p.chapters).toEqual(["ok", "42"]);
    expect(p.images).toHaveLength(1);
    expect(Array.from(p.images[0])).toEqual([9]);
  });

  it("ist idempotent", () => {
    const once = normalizeVaultProject(sampleProject());
    const twice = normalizeVaultProject(once);
    expect(twice.name).toBe(once.name);
    expect(twice.chapters).toEqual(once.chapters);
    expect(Array.from(twice.database)).toEqual(Array.from(once.database));
  });
});

describe("disasterVault — exportToVault / restoreFromVault (Roundtrip)", () => {
  it("stellt ein vollstaendiges Projekt byte-genau wieder her", async () => {
    const project = sampleProject();
    const archive = await exportToVault(project, "streng-geheim", DETERMINISTIC);

    expect(archive).toBeInstanceOf(Uint8Array);
    expect(archive.length).toBeGreaterThan(VAULT_HEADER_SIZE);
    expect(isVaultArchive(archive)).toBe(true);

    const restored = await restoreFromVault(archive, "streng-geheim");
    expect(restored.name).toBe(project.name);
    expect(restored.chapters).toEqual(project.chapters);
    expect(Array.from(restored.database)).toEqual(Array.from(project.database));
    expect(restored.images).toHaveLength(2);
    expect(Array.from(restored.images[0])).toEqual([1, 2, 3, 4, 5]);
    expect(Array.from(restored.images[1])).toEqual([255, 254, 253]);
    expect(restored.audioCues).toEqual(project.audioCues);
    expect(restored.notes).toEqual(project.notes);
  });

  it("schreibt den Magic-Header an den Anfang des Containers", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const magic = Array.from(archive.subarray(0, VAULT_MAGIC.length))
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(magic).toBe(VAULT_MAGIC);
    expect(archive[12]).toBe(1); // version
  });

  it("versteckt Klartext im Archiv (Kapitel/Notizen nicht lesbar)", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const asLatin1 = Buffer.from(archive).toString("latin1");
    expect(asLatin1).not.toContain("Kapitel 1");
    expect(asLatin1).not.toContain("PIN im Safe");
    expect(asLatin1).not.toContain("SQLite");
  });

  it("handhabt ein leeres Projekt ohne Fehler", async () => {
    const empty: VaultProject = {
      name: "Leer",
      chapters: [],
      database: new Uint8Array(0),
      images: [],
      audioCues: [],
      notes: [],
    };
    const archive = await exportToVault(empty, "pw", DETERMINISTIC);
    const restored = await restoreFromVault(archive, "pw");
    expect(restored).toEqual(empty);
  });

  it("wirft bei leerem Passwort (Export und Restore)", async () => {
    await expect(exportToVault(sampleProject(), "")).rejects.toThrow(/Passwort/);
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    await expect(restoreFromVault(archive, "")).rejects.toThrow(/Passwort/);
  });

  it("wirft bei falschem Passwort mit klarer Meldung", async () => {
    const archive = await exportToVault(sampleProject(), "richtig", DETERMINISTIC);
    await expect(restoreFromVault(archive, "falsch")).rejects.toThrow(/Entschluesselung fehlgeschlagen/);
  });

  it("weist zu kurze Salt-/IV-Vorgaben zurueck", async () => {
    await expect(
      exportToVault(sampleProject(), "pw", { ...DETERMINISTIC, salt: new Uint8Array(8) }),
    ).rejects.toThrow(/Salt/);
    await expect(
      exportToVault(sampleProject(), "pw", { ...DETERMINISTIC, iv: new Uint8Array(4) }),
    ).rejects.toThrow(/IV/);
  });
});

describe("disasterVault — Determinismus und Nonce-Hygiene", () => {
  it("erzeugt mit identischen Vorgaben byte-identische Archive", async () => {
    const a = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const b = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    expect(Buffer.from(a).toString("hex")).toBe(Buffer.from(b).toString("hex"));
  });

  it("erzeugt ohne Vorgaben unterschiedliche Salt und IV (keine Nonce-Wiederverwendung)", async () => {
    const a = await exportToVault(sampleProject(), "pw");
    const b = await exportToVault(sampleProject(), "pw");
    expect(Buffer.from(a).toString("hex")).not.toBe(Buffer.from(b).toString("hex"));
    // Salt liegt bei Offset 16..32, IV bei 32..44 — beide muessen sich unterscheiden.
    expect(Buffer.from(a.subarray(16, 32)).toString("hex")).not.toBe(
      Buffer.from(b.subarray(16, 32)).toString("hex"),
    );
    expect(Buffer.from(a.subarray(32, 44)).toString("hex")).not.toBe(
      Buffer.from(b.subarray(32, 44)).toString("hex"),
    );
  });

  it("bindet Salt in die Schluesselableitung ein (gleiche Daten, anderes Salt -> anderes Chiffrat)", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const other = await exportToVault(sampleProject(), "pw", {
      ...DETERMINISTIC,
      salt: new Uint8Array(VAULT_SALT_SIZE).fill(0x99),
    });
    // Beide Archive sind jeweils mit ihrem eigenen Salt entschluesselbar ...
    await expect(restoreFromVault(other, "pw")).resolves.toBeTruthy();
    await expect(restoreFromVault(archive, "pw")).resolves.toBeTruthy();
    // ... aber die Chiffretexte unterscheiden sich trotz identischer Nutzdaten.
    const payloadOf = (a: Uint8Array) => Buffer.from(a.subarray(payloadStart(a))).toString("hex");
    expect(payloadOf(archive)).not.toBe(payloadOf(other));
  });
});

describe("disasterVault — verifyIntegrity (SHA-256 pro Chunk)", () => {
  it("meldet ein unveraendertes Archiv als gueltig", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const result = verifyIntegrity(archive);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.chunksChecked).toBeGreaterThan(0);
  });

  it("prueft alle Chunks eines grossen, mehrteiligen Archivs", async () => {
    const big: VaultProject = {
      ...sampleProject(),
      chapters: Array.from({ length: 200 }, (_, i) => `Kapitel ${i}: ${"Inhalt ".repeat(50)}`),
    };
    const archive = await exportToVault(big, "pw", { ...DETERMINISTIC, chunkSize: 256 });
    const result = verifyIntegrity(archive);
    expect(result.valid).toBe(true);
    expect(result.chunksChecked).toBeGreaterThan(1);
    const restored = await restoreFromVault(archive, "pw");
    expect(restored.chapters).toHaveLength(200);
  });

  it("erkennt einen gekippten Byte im Chiffretext", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const start = payloadStart(archive);
    const tampered = new Uint8Array(archive);
    tampered[start + 1] ^= 0xff; // ein Bit im Nutzdaten-Chiffretext kippen

    const result = verifyIntegrity(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/SHA-256 stimmt nicht/);
    expect(result.chunksChecked).toBeGreaterThan(0);

    await expect(restoreFromVault(tampered, "pw")).rejects.toThrow(/beschaedigt/);
  });

  it("erkennt einen abgeschnittenen Container", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const truncated = archive.subarray(0, archive.length - 8);
    const result = verifyIntegrity(truncated);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("erkennt einen manipulierten Header (AAD-Schutz)", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    const tampered = new Uint8Array(archive);
    tampered[32] ^= 0x01; // erstes IV-Byte veraendern -> Header-Checksumme bricht
    const result = verifyIntegrity(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Header/);
  });

  it("weist Fremddaten und zu kurze Puffer sauber zurueck", () => {
    expect(verifyIntegrity(new Uint8Array(0))).toEqual({
      valid: false,
      chunksChecked: 0,
      errors: expect.arrayContaining([expect.stringMatching(/zu kurz/)]),
    });
    const junk = new Uint8Array(200).fill(0x41);
    const result = verifyIntegrity(junk);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Magic/);
    expect(isVaultArchive(junk)).toBe(false);
    expect(isVaultArchive(new Uint8Array(10))).toBe(false);
  });

  it("funktioniert ohne Passwort (nur Struktur und Chunk-Hashes)", async () => {
    const archive = await exportToVault(sampleProject(), "voellig-egal", DETERMINISTIC);
    expect(verifyIntegrity(archive).valid).toBe(true);
  });
});

describe("disasterVault — Konstanten und Formatvertrag", () => {
  it("haelt die dokumentierten Groessen ein", async () => {
    const archive = await exportToVault(sampleProject(), "pw", DETERMINISTIC);
    expect(VAULT_HEADER_SIZE).toBe(128);
    expect(VAULT_SALT_SIZE).toBe(16);
    expect(VAULT_IV_SIZE).toBe(12);
    expect(DEFAULT_CHUNK_SIZE).toBe(64 * 1024);
    const dv = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    expect(dv.getUint32(48, false)).toBeGreaterThan(0); // chunkCount > 0
    expect(dv.getUint32(116, false)).toBe(FAST_ITERATIONS); // iterations roundtrip
  });
});
