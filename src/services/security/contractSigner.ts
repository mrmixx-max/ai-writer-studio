/**
 * Contract-Signer-Service — WP 39.2 (Mehrparteien-Vertragssignatur)
 *
 * Erzeugt und prüft `.aiwscontract`-Hüllen für Autoren-Kollaborationen.
 * Signaturen basieren auf Ed25519 über die Web Crypto API
 * (`crypto.subtle`), die in Tauri/WebView2, modernen Browsern und
 * Node >= 20 verfügbar ist.
 *
 * Kette statt isolierter Signaturen:
 *   Jede Signatur bindet kryptografisch
 *     - die Domäne + Vertragsversion,
 *     - den Dokument-Hash,
 *     - die vollständige, geordnete Parteienliste,
 *     - den Unterzeichner und den Zeitstempel,
 *     - einen `prevChain`-Hash über ALLE bereits vorhandenen Signaturen.
 *
 *   Dadurch ist die Kette immun gegen:
 *     - Stripping: Entfernt man eine Signatur, bricht der `prevChain`
 *       der nachfolgenden Signaturen → Verifikation schlägt fehl.
 *     - Replay: Eine Signatur aus einem anderen Vertrag (anderer
 *       Dokument-Hash / andere Parteienliste) oder an anderer Position
 *       passt nicht mehr zum gebundenen Kontext → Verifikation schlägt fehl.
 *
 * Der öffentliche Schlüssel ist selbstbeschreibend in den Signatur-String
 * eingebettet, damit `verifyContract(envelope)` ohne externes Schlüssel-
 * register auskommt ("autarke Hülle").
 *
 * Deterministisch, rein lokal: kein LLM, kein Netzwerk, keine Seiteneffekte.
 * Alle Funktionen sind defensiv — ungültige Eingaben führen zu klaren
 * Fehlern (Werfen) bzw. zu `valid: false` statt zu Abstürzen.
 */

// ─── Typen ───────────────────────────────────────────────────────────────────

/** Eine einzelne Signatur innerhalb der Vertragshülle. */
export interface ContractSignature {
  /** Name/ID der unterzeichnenden Partei (muss in `parties` enthalten sein). */
  party: string;
  /**
   * Selbstbeschreibender Signatur-String:
   * `ed25519-v1:<publicKey-x-base64url>:<signature-hex>`.
   */
  signature: string;
  /** Unix-Millisekunden des Signaturzeitpunkts. */
  timestamp: number;
}

/** Die `.aiwscontract`-Hülle. */
export interface ContractEnvelope {
  /** Hash des zu signierenden Dokuments (z. B. Merkle-Root, SHA-256-Hex). */
  documentHash: string;
  /** Deklarierte Parteien in kanonischer Reihenfolge. */
  parties: string[];
  /** Bereits geleistete Signaturen in Signatur-Reihenfolge. */
  signatures: ContractSignature[];
  /** Vertrags-/Formatversion. */
  version: string;
}

/** Ergebnis einer Vertragsprüfung. */
export interface VerificationResult {
  /** true nur, wenn alle Parteien gültig signiert haben und keine Fehler vorliegen. */
  valid: boolean;
  /** Parteien mit gültiger Signatur (in Parteienreihenfolge). */
  signedBy: string[];
  /** Deklarierte Parteien ohne gültige Signatur. */
  missing: string[];
  /** Menschenlesbare Fehlermeldungen (leer, wenn keine vorliegen). */
  errors: string[];
}

/** Optionen für `signContract` (v. a. für deterministische Tests). */
export interface SignOptions {
  /** Fester Zeitstempel; Standard ist `Date.now()`. */
  timestamp?: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

/** Format-/Vertragsversion der Hülle. */
export const CONTRACT_VERSION = '1.0.0';

/** Domänentrenner gegen Cross-Protokoll-Replay. */
const DOMAIN = 'ai-writer-studio/contract';

/** Präfix der selbstbeschreibenden Signaturstrings. */
const SIG_PREFIX = 'ed25519-v1';

/**
 * PKCS#8-Präfix für einen rohen Ed25519-Seed (RFC 8410):
 * SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING <seed> } }.
 */
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

const HEX_RE = /^[0-9a-fA-F]+$/;

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Uint8Array → Kleinbuchstaben-Hex. */
function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/** Hex → Uint8Array (wirft bei ungerader Länge oder Nicht-Hex). */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length === 0 || clean.length % 2 !== 0 || !HEX_RE.test(clean)) {
    throw new Error('Ungültiges Hex-Format');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** SHA-256 als Hex-String. */
async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data) as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/** Normalisiert eine Parteienliste: trimmen, leere/ungültige entfernen, deduplizieren (Reihenfolge stabil). */
function normalizeParties(parties: unknown): string[] {
  if (!Array.isArray(parties)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parties) {
    if (typeof p !== 'string') continue;
    const name = p.trim();
    if (name.length === 0 || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** Klont eine Signaturliste defensiv (nur wohlgeformte Einträge). */
function cloneSignatures(signatures: unknown): ContractSignature[] {
  if (!Array.isArray(signatures)) return [];
  const out: ContractSignature[] = [];
  for (const s of signatures) {
    const r = asRecord(s);
    if (!r) continue;
    out.push({
      party: asString(r.party),
      signature: asString(r.signature),
      timestamp: typeof r.timestamp === 'number' ? r.timestamp : Number(r.timestamp),
    });
  }
  return out;
}

/** Kanonischer `prevChain`-Hash über eine Signaturliste. */
async function chainHash(signatures: ContractSignature[]): Promise<string> {
  const material = JSON.stringify(signatures.map((s) => [s.party, s.signature, s.timestamp]));
  return sha256Hex(material);
}

/**
 * Kanonische Nachricht, die signiert bzw. verifiziert wird.
 * Bindet Domäne, Version, Dokument-Hash, die GESAMTE Parteienliste,
 * Unterzeichner, Zeitstempel und den `prevChain`-Hash.
 */
function buildMessage(
  version: string,
  documentHash: string,
  parties: string[],
  party: string,
  timestamp: number,
  prevChain: string,
): string {
  return JSON.stringify({
    domain: DOMAIN,
    version,
    documentHash,
    parties,
    party,
    timestamp,
    prevChain,
  });
}

/** Importiert einen rohen 32-Byte-Seed als Ed25519-Signaturschlüssel. */
async function importSeed(seed: Uint8Array): Promise<CryptoKey> {
  const wrapped = new Uint8Array(ED25519_PKCS8_PREFIX.length + seed.length);
  wrapped.set(ED25519_PKCS8_PREFIX, 0);
  wrapped.set(seed, ED25519_PKCS8_PREFIX.length);
  return crypto.subtle.importKey('pkcs8', wrapped as BufferSource, { name: 'Ed25519' }, true, ['sign']);
}

/**
 * Importiert einen privaten Ed25519-Schlüssel aus einem String.
 * Akzeptierte Formate (defensiv, in dieser Reihenfolge):
 *   1. JWK-JSON (`{ ... }`)
 *   2. Hex mit 32 Byte  → roher Seed
 *   3. Hex mit 48 Byte  → PKCS#8
 *   4. Hex mit 64 Byte  → Seed (erste 32 Byte)
 *   5. Base64url mit 43 Zeichen → roher Seed
 */
async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  const raw = asString(privateKey).trim();
  if (raw.length === 0) throw new Error('Ungültiger privater Schlüssel (leer)');

  if (raw.startsWith('{')) {
    try {
      const jwk = JSON.parse(raw) as JsonWebKey;
      return await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['sign']);
    } catch {
      throw new Error('Ungültiger privater Schlüssel (JWK nicht lesbar)');
    }
  }

  if (HEX_RE.test(raw) && raw.length % 2 === 0) {
    const bytes = hexToBytes(raw);
    try {
      if (bytes.length === 32) return await importSeed(bytes);
      if (bytes.length === 48) {
        return await crypto.subtle.importKey('pkcs8', bytes as BufferSource, { name: 'Ed25519' }, true, ['sign']);
      }
      if (bytes.length === 64) return await importSeed(bytes.slice(0, 32));
    } catch {
      throw new Error('Ungültiger privater Schlüssel (Import fehlgeschlagen)');
    }
  }

  // Base64url-Seed (43 Zeichen = 32 Byte).
  if (/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    try {
      const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
      const seed = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) seed[i] = bin.charCodeAt(i);
      if (seed.length === 32) return await importSeed(seed);
    } catch {
      /* fällt durch zum Fehler unten */
    }
  }

  throw new Error('Ungültiges privates Schlüsselformat');
}

/** Ermittelt den öffentlichen JWK (inkl. `x`) aus einem privaten Schlüssel. */
async function publicJwkFromPrivate(priv: CryptoKey): Promise<JsonWebKey> {
  const jwk = await crypto.subtle.exportKey('jwk', priv);
  if (!jwk || !jwk.x) throw new Error('Öffentlicher Schlüssel konnte nicht ermittelt werden');
  return { kty: 'OKP', crv: 'Ed25519', x: jwk.x };
}

/** Baut einen Signaturstring `ed25519-v1:<x>:<sigHex>`. */
function encodeSignature(pubX: string, sigBytes: Uint8Array): string {
  return `${SIG_PREFIX}:${pubX}:${bytesToHex(sigBytes)}`;
}

/** Zerlegt einen Signaturstring; null bei ungültigem Format. */
function parseSignature(signature: string): { pubX: string; sig: Uint8Array } | null {
  const parts = asString(signature).split(':');
  if (parts.length !== 3 || parts[0] !== SIG_PREFIX) return null;
  const pubX = parts[1];
  if (!/^[A-Za-z0-9_-]{43}$/.test(pubX)) return null;
  let sig: Uint8Array;
  try {
    sig = hexToBytes(parts[2]);
  } catch {
    return null;
  }
  if (sig.length !== 64) return null;
  return { pubX, sig };
}

// ─── Interne Analyse (geteilt von verifyContract und Report) ────────────────

interface EntryAnalysis {
  party: string;
  timestamp: number;
  formatValid: boolean;
  declared: boolean;
  signatureValid: boolean;
}

interface ContractAnalysis {
  result: VerificationResult;
  entries: EntryAnalysis[];
  /** true, wenn die Hülle strukturell vollständig signiert wirkt (ohne Krypto). */
  structurallyComplete: boolean;
}

/**
 * Prüft eine Hülle vollständig: Form, Parteienzugehörigkeit, Duplikate,
 * Kettenbindung und Ed25519-Signaturen. Wirft nie.
 */
async function analyzeContract(envelope: unknown): Promise<ContractAnalysis> {
  const errors: string[] = [];
  const entries: EntryAnalysis[] = [];

  const root = asRecord(envelope);
  if (!root) {
    return {
      result: { valid: false, signedBy: [], missing: [], errors: ['Ungültige Vertragshülle'] },
      entries: [],
      structurallyComplete: false,
    };
  }

  const documentHash = asString(root.documentHash);
  const version = asString(root.version);
  const parties = normalizeParties(root.parties);
  const signatures = cloneSignatures(root.signatures);

  if (documentHash.trim().length === 0) errors.push('Dokument-Hash fehlt');
  if (version.trim().length === 0) errors.push('Vertragsversion fehlt');
  if (parties.length === 0) errors.push('Keine Parteien deklariert');

  const signedBy: string[] = [];
  const validByParty = new Set<string>();
  const seenParties = new Set<string>();
  let prevChain = await chainHash([]);

  for (let i = 0; i < signatures.length; i++) {
    const entry = signatures[i];
    const party = asString(entry.party).trim();
    const timestamp = entry.timestamp;

    const declared = parties.includes(party);
    const parsed = parseSignature(entry.signature);

    let signatureValid = false;

    if (!declared) {
      errors.push(`Signatur #${i + 1}: unbekannte Partei "${party || '(leer)'}"`);
    } else if (seenParties.has(party)) {
      errors.push(`Doppelte Signatur für Partei "${party}"`);
    } else if (!Number.isFinite(timestamp) || timestamp <= 0) {
      errors.push(`Signatur #${i + 1} ("${party}"): ungültiger Zeitstempel`);
    } else if (!parsed) {
      errors.push(`Signatur #${i + 1} ("${party}"): ungültiges Signaturformat`);
    } else {
      const message = buildMessage(version, documentHash, parties, party, timestamp, prevChain);
      try {
        const key = await crypto.subtle.importKey(
          'jwk',
          { kty: 'OKP', crv: 'Ed25519', x: parsed.pubX },
          { name: 'Ed25519' },
          false,
          ['verify'],
        );
        signatureValid = await crypto.subtle.verify(
          { name: 'Ed25519' },
          key,
          parsed.sig as BufferSource,
          new TextEncoder().encode(message) as BufferSource,
        );
      } catch {
        signatureValid = false;
      }
      if (!signatureValid) {
        errors.push(`Signatur #${i + 1} ("${party}"): Signatur ungültig (Kette oder Inhalt verändert)`);
      }
    }

    if (declared && !seenParties.has(party)) seenParties.add(party);
    if (declared && signatureValid && !validByParty.has(party)) {
      validByParty.add(party);
      signedBy.push(party);
    }

    entries.push({ party, timestamp, formatValid: parsed !== null, declared, signatureValid });

    // Kette NUR auf Basis der tatsächlich vorliegenden Einträge fortschreiben.
    prevChain = await chainHash(signatures.slice(0, i + 1));
  }

  const missing = parties.filter((p) => !validByParty.has(p));
  const valid = errors.length === 0 && missing.length === 0 && parties.length > 0;

  const structurallyComplete =
    parties.length > 0 &&
    signatures.length === parties.length &&
    parties.every((p) => signatures.filter((s) => asString(s.party).trim() === p).length === 1) &&
    signatures.every((s) => parseSignature(s.signature) !== null);

  return {
    result: { valid, signedBy, missing, errors },
    entries,
    structurallyComplete,
  };
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Erstellt eine neue, leere `.aiwscontract`-Hülle.
 *
 * @throws wenn `documentHash` leer ist oder keine gültige Partei übrig bleibt.
 */
export function createContract(documentHash: string, parties: string[]): ContractEnvelope {
  const hash = asString(documentHash).trim();
  if (hash.length === 0) throw new Error('Ungültiger Dokument-Hash (leer)');

  const normalized = normalizeParties(parties);
  if (normalized.length === 0) throw new Error('Mindestens eine Partei erforderlich');

  return {
    documentHash: hash,
    parties: normalized,
    signatures: [],
    version: CONTRACT_VERSION,
  };
}

/**
 * Fügt einer Hülle eine Ed25519-Signatur hinzu und gibt eine NEUE Hülle
 * zurück (die Eingabe bleibt unverändert).
 *
 * Die Signatur bindet Dokument-Hash, Version, die gesamte Parteienliste,
 * den Unterzeichner, den Zeitstempel und die Hash-Kette aller vorherigen
 * Signaturen. Ed25519 ist deterministisch: gleicher Schlüssel + gleiche
 * Nachricht ⇒ gleiche Signatur.
 *
 * @throws bei ungültiger Hülle, unbekannter Partei, Doppelsignatur oder
 *         nicht importierbarem Schlüssel.
 */
export async function signContract(
  envelope: ContractEnvelope,
  party: string,
  privateKey: string,
  options?: SignOptions,
): Promise<ContractEnvelope> {
  const root = asRecord(envelope);
  if (!root) throw new Error('Ungültige Vertragshülle');

  const documentHash = asString(root.documentHash).trim();
  const version = asString(root.version).trim() || CONTRACT_VERSION;
  const parties = normalizeParties(root.parties);
  const signatures = cloneSignatures(root.signatures);

  if (documentHash.length === 0) throw new Error('Ungültige Vertragshülle (Dokument-Hash fehlt)');
  if (parties.length === 0) throw new Error('Ungültige Vertragshülle (keine Parteien)');

  const signer = asString(party).trim();
  if (signer.length === 0) throw new Error('Ungültige Partei (leer)');
  if (!parties.includes(signer)) throw new Error(`Partei "${signer}" ist nicht im Vertrag deklariert`);
  if (signatures.some((s) => asString(s.party).trim() === signer)) {
    throw new Error(`Partei "${signer}" hat bereits signiert`);
  }

  const timestamp =
    options && typeof options.timestamp === 'number' && Number.isFinite(options.timestamp) && options.timestamp > 0
      ? Math.floor(options.timestamp)
      : Date.now();

  const priv = await importPrivateKey(privateKey);
  const pubJwk = await publicJwkFromPrivate(priv);
  const pubX = asString(pubJwk.x);

  const prevChain = await chainHash(signatures);
  const message = buildMessage(version, documentHash, parties, signer, timestamp, prevChain);
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, priv, new TextEncoder().encode(message) as BufferSource),
  );

  return {
    documentHash,
    parties,
    signatures: [...signatures, { party: signer, signature: encodeSignature(pubX, sigBytes), timestamp }],
    version,
  };
}

/**
 * Verifiziert ALLE Signaturen einer Hülle.
 *
 * Prüft Format, Parteienzugehörigkeit, Duplikate, die Hash-Kette und jede
 * einzelne Ed25519-Signatur. Erkennt Stripping (entfernte Signatur bricht
 * die Kette) und Replay (fremder Dokument-Hash / andere Position).
 * Wirft nie — ungültige Eingaben ergeben `valid: false`.
 */
export async function verifyContract(envelope: ContractEnvelope): Promise<VerificationResult> {
  const analysis = await analyzeContract(envelope);
  return analysis.result;
}

// ─── HTML-Prüfbericht ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '—';
  try {
    return new Date(ts).toISOString();
  } catch {
    return String(ts);
  }
}

/**
 * Erzeugt einen autarken HTML-Prüfbericht (Inline-Styles, keine externen
 * Ressourcen, kein Skript, kein Netzwerk). Die Signatur-Krypto selbst ist
 * asynchron und kann hier nicht geprüft werden; der Bericht weist daher den
 * strukturellen Status aus (Parteien, vorhandene Signaturen, Form, Fehler)
 * und verweist auf `verifyContract` für die vollständige Prüfung.
 *
 * Deterministisch und XSS-sicher: alle Eingaben werden HTML-escaped.
 * Bei ungültiger Hülle wird dennoch ein gültiges HTML-Dokument geliefert.
 */
export function generateHtmlReport(envelope: ContractEnvelope): string {
  const root = asRecord(envelope);
  const documentHash = root ? asString(root.documentHash) : '';
  const version = root ? asString(root.version) : '';
  const parties = root ? normalizeParties(root.parties) : [];
  const signatures = root ? cloneSignatures(root.signatures) : [];

  // Strukturelle Analyse (synchron, ohne Krypto).
  const errors: string[] = [];
  if (!root) errors.push('Ungültige Vertragshülle');
  if (documentHash.trim().length === 0) errors.push('Dokument-Hash fehlt');
  if (version.trim().length === 0) errors.push('Vertragsversion fehlt');
  if (parties.length === 0) errors.push('Keine Parteien deklariert');

  const seen = new Set<string>();
  for (const s of signatures) {
    const party = asString(s.party).trim();
    if (!parties.includes(party)) errors.push(`Unbekannte Partei "${party || '(leer)'}"`);
    else if (seen.has(party)) errors.push(`Doppelte Signatur für "${party}"`);
    else seen.add(party);
    if (parseSignature(s.signature) === null) errors.push(`Ungültiges Signaturformat für "${party || '(leer)'}"`);
  }

  const missing = parties.filter((p) => !seen.has(p));
  const complete = errors.length === 0 && missing.length === 0 && parties.length > 0;

  const statusLabel = !root
    ? 'Ungültige Hülle'
    : complete
      ? 'Vollständig signiert'
      : 'Unvollständig / fehlerhaft';

  const partyRows =
    parties.length > 0
      ? parties
          .map((p) => {
            const sig = signatures.find((s) => asString(s.party).trim() === p);
            const state = sig ? '✅ signiert' : '⏳ offen';
            const ts = sig ? escapeHtml(formatTimestamp(sig.timestamp)) : '—';
            return `        <tr><td>${escapeHtml(p)}</td><td>${state}</td><td>${ts}</td></tr>`;
          })
          .join('\n')
      : '        <tr><td colspan="3" class="muted">Keine Parteien</td></tr>';

  const signatureRows =
    signatures.length > 0
      ? signatures
          .map((s, i) => {
            const party = escapeHtml(asString(s.party).trim() || '(leer)');
            const ts = escapeHtml(formatTimestamp(s.timestamp));
            const formatOk = parseSignature(s.signature) !== null;
            const formatLabel = formatOk ? '✅ Format ok' : '❌ Format ungültig';
            const short = escapeHtml(asString(s.signature).slice(0, 32) || '—');
            return `        <tr><td>${i + 1}</td><td>${party}</td><td>${ts}</td><td>${formatLabel}</td><td class="mono">${short}…</td></tr>`;
          })
          .join('\n')
      : '        <tr><td colspan="5" class="muted">Keine Signaturen</td></tr>';

  const errorsBlock =
    errors.length > 0
      ? `      <h2>Befunde</h2>\n      <ul class="errors">\n${errors
          .map((e) => `        <li>${escapeHtml(e)}</li>`)
          .join('\n')}\n      </ul>`
      : `      <p class="ok">Keine strukturellen Fehler gefunden.</p>`;

  const missingBlock =
    missing.length > 0
      ? `      <p class="warn">Noch nicht signiert: ${missing.map((m) => escapeHtml(m)).join(', ')}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vertrags-Prüfbericht — ${escapeHtml(documentHash || 'ohne Hash')}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #fbfaf7; color: #1d1d1f; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.6; }
      main { max-width: 900px; margin: 0 auto; padding: 32px 20px 64px; }
      h1 { font-size: 1.6rem; margin: 0 0 4px; }
      h2 { font-size: 1.05rem; margin: 28px 0 8px; }
      .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 20px; }
      .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 600; font-size: 0.85rem; }
      .badge.ok { background: #dcfce7; color: #166534; }
      .badge.bad { background: #fee2e2; color: #991b1b; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.9rem; }
      th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      th { color: #6b7280; font-weight: 600; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: #374151; }
      .muted { color: #9ca3af; font-style: italic; }
      .ok { color: #166534; }
      .warn { color: #92400e; }
      .errors { color: #991b1b; margin: 8px 0 0; padding-left: 20px; }
      .hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
      .note { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Vertrags-Prüfbericht</h1>
      <div class="meta">
        Version: ${escapeHtml(version || '—')} &middot;
        Status: <span class="badge ${complete ? 'ok' : 'bad'}">${escapeHtml(statusLabel)}</span>
      </div>

      <h2>Dokument</h2>
      <p>Hash: <span class="hash">${escapeHtml(documentHash || '—')}</span></p>

      <h2>Parteien (${parties.length})</h2>
      <table>
        <thead><tr><th>Partei</th><th>Status</th><th>Zeitstempel</th></tr></thead>
        <tbody>
${partyRows}
        </tbody>
      </table>
${missingBlock}

      <h2>Signaturen (${signatures.length})</h2>
      <table>
        <thead><tr><th>#</th><th>Partei</th><th>Zeitstempel</th><th>Format</th><th>Signatur</th></tr></thead>
        <tbody>
${signatureRows}
        </tbody>
      </table>

${errorsBlock}

      <p class="note">
        Autarker Prüfbericht (keine externen Ressourcen). Dieser Bericht weist den
        strukturellen Status aus. Die vollständige kryptografische Prüfung aller
        Ed25519-Signaturen und der Signaturkette erfolgt über <code>verifyContract()</code>.
      </p>
    </main>
  </body>
</html>
`;
}
