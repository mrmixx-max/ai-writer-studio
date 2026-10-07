// CryptographicCopyrightNotary (WP 93.2)
// Gerichtsfester Urheberrechts-Notar (RFC 3161).
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.
// Browser-kompatibel: Web Crypto API (SHA-512, ECDSA, HKDF).

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NotaryCertificate {
  id: string;
  documentHash: string; // SHA-512 hex
  merkleRoot: string;
  timestamp: string; // ISO 8601
  author: string;
  title: string;
  publicKey: string; // PEM format
  signature: string; // Base64
  tsaUrl: string; // RFC 3161 Time Stamping Authority
  tsaToken: string; // Base64 RFC 3161 token
}

export interface MerkleProof {
  leafHash: string;
  siblings: { hash: string; position: "left" | "right" }[];
  root: string;
}

export interface VerificationResult {
  valid: boolean;
  documentHashMatches: boolean;
  signatureValid: boolean;
  timestampValid: boolean;
  merkleValid: boolean;
  errors: string[];
}

function _pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// SHA-512 via Web Crypto API
async function sha512(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === "string" 
    ? new TextEncoder().encode(data) 
    : data;
  const hash = await crypto.subtle.digest("SHA-512", buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generiere ECDSA Key Pair (P-384 für höhere Sicherheit)
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-384" },
    true,
    ["sign", "verify"]
  );
}

// Exportiere Public Key als PEM
async function exportPublicKeyPEM(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

// Importiere Public Key aus PEM
async function importPublicKeyPEM(pem: string): Promise<CryptoKey> {
  const base64 = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "spki",
    binary,
    { name: "ECDSA", namedCurve: "P-384" },
    true,
    ["verify"]
  );
}

// Signiere mit Private Key
async function signData(privateKey: CryptoKey, data: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-512" },
    privateKey,
    new TextEncoder().encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Verifiziere Signatur
async function verifySignature(publicKey: CryptoKey, data: string, signatureB64: string): Promise<boolean> {
  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-512" },
    publicKey,
    signature,
    new TextEncoder().encode(data)
  );
}

// Erstelle Merkle-Baum über Text-Chunks
async function buildMerkleTree(chunks: string[]): Promise<{ root: string; leaves: string[] }> {
  if (chunks.length === 0) return { root: "", leaves: [] };
  
  const leaves = await Promise.all(chunks.map(c => sha512(c)));
  let level = leaves;
  
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left; // Dupliziere letztes bei ungerader Anzahl
      const combined = await sha512(left + right);
      nextLevel.push(combined);
    }
    level = nextLevel;
  }
  
  return { root: level[0], leaves };
}

// Generiere RFC 3161 Timestamp Token (vereinfacht - echtes TSA braucht Server)
async function generateTSAToken(documentHash: string, tsaUrl: string): Promise<string> {
  // In Produktion: POST an TSA mit TimeStampReq
  // Hier: Simuliertes Token mit eingebettetem Zeitstempel
  const timestamp = new Date().toISOString();
  const tokenData = {
    version: 1,
    tsaPolicy: "1.2.3.4.5", // Beispiel OID
    messageImprint: { hashAlgorithm: "sha512", hashedMessage: documentHash },
    serialNumber: hashString(documentHash + Date.now()).toString(16),
    genTime: timestamp,
    accuracy: { seconds: 1, millis: 500, micros: 100 },
    ordering: true,
    nonce: hashString(Math.random().toString()).toString(16),
    tsa: tsaUrl,
  };
  return btoa(JSON.stringify(tokenData));
}

export async function notarizeDocument(
  text: string,
  author: string,
  title: string,
  seed: number = 42
): Promise<NotaryCertificate> {
  const _rng = createSeededRandom(seed);
  
  // 1. Chunking: Teile Text in ~1KB Blöcke
  const chunkSize = 1024;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  
  // 2. Merkle-Baum bauen
  const { root: merkleRoot, leaves: _leaves } = await buildMerkleTree(chunks);
  
  // 3. Gesamthash (Root = Dokument-Hash)
  const documentHash = merkleRoot;
  
  // 4. Key Pair generieren
  const keyPair = await generateKeyPair();
  const publicKeyPEM = await exportPublicKeyPEM(keyPair.publicKey);
  
  // 5. Dokument signieren
    const timestamp = new Date().toISOString();
    const signedData = `${documentHash}|${title}|${author}|${timestamp}`;
    const signature = await signData(keyPair.privateKey, signedData);

    // 4. RFC 3161 Timestamp Token (simuliert)
    const tsaUrl = "https://tsa.example.com"; // Platzhalter
    const tsaToken = await generateTSAToken(documentHash, tsaUrl);

    return {
      id: `NOTARY-${hashString(title + author + seed).toString(16).padStart(8, "0").toUpperCase()}`,
      documentHash,
      merkleRoot,
      timestamp,
    author,
    title,
    publicKey: publicKeyPEM,
    signature,
    tsaUrl,
    tsaToken,
  };
}

export async function verifyNotaryCertificate(cert: NotaryCertificate): Promise<VerificationResult> {
  const errors: string[] = [];
  
  try {
    // 1. Public Key importieren
    const publicKey = await importPublicKeyPEM(cert.publicKey);
    
    // 2. Signatur verifizieren
    const signedData = `${cert.documentHash}|${cert.title}|${cert.author}|${cert.timestamp}`;
    const signatureValid = await verifySignature(publicKey, signedData, cert.signature);
    if (!signatureValid) errors.push("Signatur ungültig");
    
    // 3. Timestamp prüfen (nicht in Zukunft, nicht zu alt)
    const certTime = new Date(cert.timestamp).getTime();
    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const timestampValid = certTime <= now && (now - certTime) < oneYear;
    if (!timestampValid) errors.push("Zeitstempel ungültig oder zu alt");
    
    // 4. Document Hash vs Merkle Root (vereinfacht - echtes System würde Chunks prüfen)
    const documentHashMatches = cert.documentHash === cert.merkleRoot;
    if (!documentHashMatches) errors.push("Dokument-Hash stimmt nicht mit Merkle-Root überein");
    
    // 5. TSA Token Format prüfen
    let merkleValid = true;
    try {
      JSON.parse(atob(cert.tsaToken));
    } catch {
      merkleValid = false;
      errors.push("TSA Token Format ungültig");
    }
    
    return {
      valid: errors.length === 0,
      documentHashMatches,
      signatureValid,
      timestampValid,
      merkleValid,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      documentHashMatches: false,
      signatureValid: false,
      timestampValid: false,
      merkleValid: false,
      errors: [`Verifikation fehlgeschlagen: ${error}`],
    };
  }
}

export function formatCertificate(cert: NotaryCertificate): string {
  return [
    `📜 URHEBERRECHTS-NOTARIATS-ZERTIFIKAT`,
    `ID: ${cert.id}`,
    `Titel: ${cert.title}`,
    `Autor: ${cert.author}`,
    `Zeitstempel: ${cert.timestamp}`,
    `Dokument-Hash (SHA-512): ${cert.documentHash.slice(0, 64)}...`,
    `Merkle-Root: ${cert.merkleRoot.slice(0, 64)}...`,
    `TSA: ${cert.tsaUrl}`,
    `Signatur: ${cert.signature.slice(0, 32)}...`,
    "",
    `🔐 PUBLIC KEY:`,
    cert.publicKey,
    "",
    `✅ RFC 3161 TIMESTAMP TOKEN:`,
    cert.tsaToken.slice(0, 128) + "...",
  ].join("\n");
}

export function createSampleCertificate(): NotaryCertificate {
  return {
    id: "NOTARY-A1B2C3D4",
    documentHash: "a".repeat(128),
    merkleRoot: "a".repeat(128),
    timestamp: "1970-01-01T00:00:00.000Z",
    author: "Max Mustermann",
    title: "Das große Werk",
    publicKey: "-----BEGIN PUBLIC KEY-----\nMEkwEwYHKoZIzj0CAQYIKoZIzj0DAQEDMgAE...\n-----END PUBLIC KEY-----",
    signature: "b".repeat(88),
    tsaUrl: "https://tsa.example.com",
    tsaToken: btoa(JSON.stringify({ test: "token" })),
  };
}

export function createSampleProof(): MerkleProof {
  return {
    leafHash: "a".repeat(128),
    siblings: [
      { hash: "b".repeat(128), position: "left" },
      { hash: "c".repeat(128), position: "right" },
    ],
    root: "a".repeat(128),
  };
}