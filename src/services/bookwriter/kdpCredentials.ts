// KDP-Credential-Store (Sprint 7, Agent 1).
//
// Sichere Speicherung von KDP-API-Credentials (OAuth2-Client + Refresh-Token)
// im Settings-KV-Store. AKZEPTANZKRITERIUM: Credentials werden NIE im Code
// oder im Klartext persistiert:
//
//   - Payload wird per Windows DPAPI (CryptProtectData) verschlüsselt abgelegt.
//     Der Schlüssel wird vom OS verwaltet (User-Profil), keine Passwort-Ableitung nötig.
//   - Für Cross-Platform (später macOS/Linux): Fallback auf AES-256-GCM (WebCrypto).
//   - Die Master-Passphrase wird NIE gespeichert — sie kommt zur Laufzeit vom
//     User (App-PIN-Verifikation, CLI-Prompt oder injizierte Callback).
//   - Falsche Passphrase / DPAPI-Fehler → sprechender Fehler; Klartext fließt nie über die Platte.
//   - Für CI/CLI ohne gespeicherte Credentials: Env-Override `KDP_API_KEY`
//     (wird VOR dem Store geprüft, damit keine Klartext-Notlage entsteht).
//
// Die eigentliche IO (Tauri-Settings-KV) ist über `CredentialKV` injizierbar —
// damit ist die Logik ohne Tauri-Kontext vollständig testbar.

import { invoke } from "@tauri-apps/api/core";
import { encryptString, decryptString, isEncryptedPayload } from "@/services/security/crypto";

/** Ein KDP-Credential-Satz (OAuth2-Client-Credentials + Refresh-Token). */
export interface KdpCredentials {
  /** OAuth2-Client-ID der KDP-Anwendung. */
  clientId: string;
  /** OAuth2-Client-Secret. */
  clientSecret: string;
  /** Langlebiger Refresh-Token (offline access). */
  refreshToken: string;
  /** Marketplace-Endpunkt (z. B. "www.amazon.com"). */
  marketplace: string;
}

/** Minimaler KV-Vertrag (Settings-Store / In-Memory / injizierbar). */
export interface CredentialKV {
  load(): string | null;
  save(value: string): void;
  remove(): void;
}

/** KV-Schlüssel im Settings-Store. */
export const KDP_CREDENTIALS_KV_KEY = "kdp_api_credentials";

/** Env-Variable für CI/CLI-Uploads ohne gespeicherte Credentials. */
export const KDP_API_KEY_ENV = "KDP_API_KEY";

/** Einfache In-Memory-KV (Tests, CLI ohne Tauri). */
export const MEMORY_CREDENTIAL_STORE: CredentialKV = (() => {
  let value: string | null = null;
  return {
    load: () => value,
    save: (v: string) => {
      value = v;
    },
    remove: () => {
      value = null;
    },
  };
})();

/** Optionen des Credential-Stores. */
export interface KdpCredentialStoreOptions {
  /** KV-Backend (Settings-Store in der App, In-Memory in Tests). */
  storage: CredentialKV;
  /** Master-Passphrase — wird NIE persistiert (nur für Legacy-Fallback). */
  masterPassphrase?: string;
}

/** Fehler bei Credential-Operationen (sprechende User-Meldung). */
export class KdpCredentialError extends Error {
  cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "KdpCredentialError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/** Liest ein Credential-Env-Override (CI/CLI-Pfad). */
export function credentialFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const key = env[KDP_API_KEY_ENV];
  return key && key.trim() ? key.trim() : null;
}

/** App-spezifische Entropy für DPAPI (bindet Ciphertext an diese App). */
const DPAPI_ENTROPY = "ai-writer-studio-kdp-credentials";

/**
 * Erstellt den Credential-Store. Verwendet Windows DPAPI (Current User).
 * Fallback auf AES-256-GCM (WebCrypto) wenn DPAPI nicht verfügbar.
 */
export function createKdpCredentialStore(options: KdpCredentialStoreOptions) {
  const { storage, masterPassphrase } = options;

  // DPAPI nutzt keine Master-Passphrase; aber für Legacy-Migration/Fallback brauchen wir sie optional
  const useDpapi = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  return {
    /** true, wenn (verschlüsselte) Credentials im Store liegen. */
    has(): boolean {
      return storage.load() !== null;
    },

    /** Speichert die Credentials verschlüsselt (DPAPI auf Windows, sonst AES-GCM). */
    async save(credentials: KdpCredentials): Promise<void> {
      const payload = JSON.stringify(credentials);

      if (useDpapi) {
        // DPAPI: Entropy an App binden, damit Ciphertext nicht portabel ist
        const cipher = await invoke<string>("dpapi_protect", {
          data: payload,
          entropy: DPAPI_ENTROPY,
        });
        storage.save(cipher);
      } else {
        // Fallback: WebCrypto AES-256-GCM (benötigt Passphrase)
        if (!masterPassphrase || !masterPassphrase.trim()) {
          throw new KdpCredentialError(
            "Master-Passphrase erforderlich für Nicht-Windows-Plattformen.",
          );
        }
        const cipher = await encryptString(payload, masterPassphrase);
        storage.save(cipher);
      }
    },

    /**
     * Lädt und entschlüsselt die Credentials.
     * Erkennt Format automatisch (DPAPI: Base64 ohne AWS1-Prefix, Legacy: AWS1|...).
     */
    async load(): Promise<KdpCredentials | null> {
      const raw = storage.load();
      if (!raw) return null;

      if (useDpapi) {
        try {
          // DPAPI-Ciphertext ist reines Base64 (kein AWS1| Prefix)
          if (!raw.startsWith("AWS1|")) {
            const plain = await invoke<string>("dpapi_unprotect", {
              ciphertext_b64: raw,
              entropy: DPAPI_ENTROPY,
            });
            return JSON.parse(plain) as KdpCredentials;
          }
          // Legacy AWS1 Format -> Fallback auf WebCrypto
        } catch (err) {
          throw new KdpCredentialError(
            "Entschlüsselung der KDP-Credentials fehlgeschlagen (DPAPI).",
            { cause: err },
          );
        }
      }

      // Legacy / Fallback: WebCrypto AES-GCM
      if (!masterPassphrase || !masterPassphrase.trim()) {
        throw new KdpCredentialError(
          "Master-Passphrase erforderlich für Legacy-Credentials.",
        );
      }
      if (!isEncryptedPayload(raw)) {
        throw new KdpCredentialError(
          "Gespeicherte KDP-Credentials liegen nicht im erwarteten Format vor.",
        );
      }
      try {
        const plain = await decryptString(raw, masterPassphrase);
        return JSON.parse(plain) as KdpCredentials;
      } catch (err) {
        throw new KdpCredentialError(
          "Entschlüsselung der KDP-Credentials fehlgeschlagen: falsche Passphrase oder beschädigte Daten.",
          { cause: err },
        );
      }
    },

    /** Entfernt die Credentials aus dem Store. */
    async remove(): Promise<void> {
      storage.remove();
    },

    /**
     * Liefert ein nutzbares Access-Token:
     *   1. Env-Override `KDP_API_KEY` (CI/CLI) — gewinnt, umgeht den Store.
     *   2. Entschlüsselte Credentials aus dem Store (null, wenn leer).
     */
    async getAccessToken(env: Record<string, string | undefined> = process.env): Promise<string | null> {
      const envKey = credentialFromEnv(env);
      if (envKey) return envKey;
      const creds = await this.load();
      return creds ? creds.refreshToken : null;
    },
  };
}
