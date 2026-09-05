// Tests: KDP-Credential-Store (Sprint 7, Agent 1).
//
// Akzeptanzkriterium: Credentials werden sicher gespeichert (nicht im Code).
// - Payload liegt ausschließlich AES-256-GCM-verschlüsselt (AWS1-Format) im KV-Store
// - Master-Passphrase wird NIE persistiert
// - Falsche Passphrase → sprechender Fehler, kein Klartext-Leak
// - Env-Override (KDP_API_KEY) für CI/CLI ohne gespeicherte Credentials
import { describe, it, expect, beforeEach } from "vitest";
import {
  createKdpCredentialStore,
  MEMORY_CREDENTIAL_STORE,
  type CredentialKV,
} from "./kdpCredentials";
import { isEncryptedPayload } from "@/services/security/crypto";

function makeKv(): CredentialKV & { raw: () => string | null } {
  let value: string | null = null;
  return {
    load: () => value,
    save: (v: string) => {
      value = v;
    },
    remove: () => {
      value = null;
    },
    raw: () => value,
  };
}

const CREDS = {
  clientId: "amzn1.application-oa2-client.abc123",
  clientSecret: "super-secret-42",
  refreshToken: "Atzr|IwEBIA...",
  marketplace: "www.amazon.com",
};

describe("createKdpCredentialStore", () => {
  let kv: ReturnType<typeof makeKv>;

  beforeEach(() => {
    kv = makeKv();
  });

  it("speichert Credentials verschlüsselt — Rohwert ist AWS1-Chiffretext, kein Klartext", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "master-pin-1234" });
    await store.save(CREDS);

    const raw = kv.raw();
    expect(raw).not.toBeNull();
    expect(isEncryptedPayload(raw as string)).toBe(true);
    expect(raw).not.toContain(CREDS.clientSecret);
    expect(raw).not.toContain(CREDS.clientId);
    expect(raw).not.toContain(CREDS.refreshToken);
  });

  it("lädt gespeicherte Credentials mit korrekter Passphrase wieder aus", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "master-pin-1234" });
    await store.save(CREDS);

    // Neuer Store-Instance (Simuliert App-Neustart), gleiche Passphrase.
    const store2 = createKdpCredentialStore({ storage: kv, masterPassphrase: "master-pin-1234" });
    const loaded = await store2.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.clientId).toBe(CREDS.clientId);
    expect(loaded?.clientSecret).toBe(CREDS.clientSecret);
    expect(loaded?.refreshToken).toBe(CREDS.refreshToken);
  });

  it("wirft bei falscher Passphrase eine klare Fehlermeldung (kein Crash, kein Klartext)", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "richtig" });
    await store.save(CREDS);

    const store2 = createKdpCredentialStore({ storage: kv, masterPassphrase: "falsch" });
    await expect(store2.load()).rejects.toThrow(/Entschlüsselung|Passphrase/i);
  });

  it("load() ohne gespeicherte Credentials gibt null zurück (kein Throw)", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
    expect(await store.load()).toBeNull();
  });

  it("leere/fehlende Master-Passphrase wird abgelehnt (keine unverschlüsselte Ablage)", async () => {
    expect(() => createKdpCredentialStore({ storage: kv, masterPassphrase: "" })).toThrow(
      /Master-Passphrase/i,
    );
  });

  it("remove() löscht den Eintrag; danach load() → null", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
    await store.save(CREDS);
    await store.remove();
    expect(kv.raw()).toBeNull();
    const store2 = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
    expect(await store2.load()).toBeNull();
  });

  it("has() erkennt vorhandene Credentials ohne Entschlüsselung", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
    expect(await store.has()).toBe(false);
    await store.save(CREDS);
    expect(await store.has()).toBe(true);
  });

  it("getAccessToken: Env-Override KDP_API_KEY gewinnt und umgeht den Store (CI-Pfad)", async () => {
    process.env.KDP_API_KEY = "env-token-99";
    try {
      const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
      const token = await store.getAccessToken();
      expect(token).toBe("env-token-99");
      // Nichts wurde verschlüsselt abgelegt.
      expect(kv.raw()).toBeNull();
    } finally {
      delete process.env.KDP_API_KEY;
    }
  });

  it("getAccessToken ohne Env und ohne gespeicherte Credentials → null (graceful)", async () => {
    const store = createKdpCredentialStore({ storage: kv, masterPassphrase: "x" });
    expect(await store.getAccessToken()).toBeNull();
  });

  it("MEMORY_CREDENTIAL_STORE ist eine gültige In-Memory-KV (für Tests/CLI ohne Tauri)", async () => {
    await MEMORY_CREDENTIAL_STORE.save("AWS1|x|y|z");
    expect(MEMORY_CREDENTIAL_STORE.load()).toBe("AWS1|x|y|z");
    MEMORY_CREDENTIAL_STORE.remove();
    expect(MEMORY_CREDENTIAL_STORE.load()).toBeNull();
  });
});
