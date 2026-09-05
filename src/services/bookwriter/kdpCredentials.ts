// KDP-Credential-Store (Sprint 7, Agent 1).
//
// Sichere Speicherung von KDP-API-Credentials (OAuth2-Client + Refresh-Token)
// im Settings-KV-Store. AKZEPTANZKRITERIUM: Credentials werden NIE im Code
// oder im Klartext persistiert:
//
//   - Payload wird per AES-256-GCM (WebCrypto, AWS1-Format aus
//     src/services/security/crypto.ts) verschlüsselt abgelegt.
//   - Die Master-Passphrase wird NIE gespeichert — sie kommt zur Laufzeit vom
//     User (App-PIN-Verifikation, CLI-Prompt oder injizierte Callback).
//   - Falsche Passphrase → GCM-Authentizitätsprüfung schlägt fehl → sprechender
//     Fehler; Klartext fließt nie über die Platte.
//   - Für CI/CLI ohne gespeicherte Credentials: Env-Override `KDP_API_KEY`
//     (wird VOR dem Store geprüft, damit keine Klartext-Notlage entsteht).
//
// Die eigentliche IO (Tauri-Settings-KV) ist über `CredentialKV` injizierbar —
// damit ist die Logik ohne Tauri-Kontext vollständig testbar.

import {
  encryptString,
  decryptString,
  isEncryptedPayload,
} from "@/services/security/crypto";

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
  /** Master-Passphrase — wird NIE persistiert. */
  masterPassphrase: string;
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

/**
 * Erstellt den Credential-Store. Die Passphrase wird ausschließlich im
 * Speicher der Instanz gehalten — nicht persistiert, nicht geloggt.
 */
export function createKdpCredentialStore(options: KdpCredentialStoreOptions) {
  const { storage, masterPassphrase } = options;

  if (!masterPassphrase || !masterPassphrase.trim()) {
    throw new KdpCredentialError(
      "KDP-Credential-Store benötigt eine Master-Passphrase (wird nicht gespeichert).",
    );
  }

  return {
    /** true, wenn (verschlüsselte) Credentials im Store liegen. */
    has(): boolean {
      return storage.load() !== null;
    },

    /** Speichert die Credentials verschlüsselt (AES-256-GCM / AWS1). */
    async save(credentials: KdpCredentials): Promise<void> {
      const payload = JSON.stringify(credentials);
      const cipher = await encryptString(payload, masterPassphrase);
      storage.save(cipher);
    },

    /**
     * Lädt und entschlüsselt die Credentials. Wirft KdpCredentialError bei
     * falscher Passphrase oder beschädigten Daten.
     */
    async load(): Promise<KdpCredentials | null> {
      const raw = storage.load();
      if (!raw) return null;
      if (!isEncryptedPayload(raw)) {
        throw new KdpCredentialError(
          "Gespeicherte KDP-Credentials liegen nicht im verschlüsselten Format vor (AWS1 erwartet).",
        );
      }
      try {
        const plain = await decryptString(raw, masterPassphrase);
        return JSON.parse(plain) as KdpCredentials;
      } catch (err) {
        throw new KdpCredentialError(
          "Entschlüsselung der KDP-Credentials fehlgeschlagen: falsche Master-Passphrase oder beschädigte Daten.",
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
     * In einer späteren Ausbaustufe tauscht (1)+(2) hier den OAuth2-Flow
     * gegen ein kurzlebiges Access-Token (LWA grant_type=refresh_token).
     */
    async getAccessToken(env: Record<string, string | undefined> = process.env): Promise<string | null> {
      const envKey = credentialFromEnv(env);
      if (envKey) return envKey;
      const creds = await this.load();
      return creds ? creds.refreshToken : null;
    },
  };
}
