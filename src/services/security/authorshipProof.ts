/**
 * Authorship-Proof-Service — WP 29.2 (Kryptografischer Urheberschafts-Beweis)
 *
 * Lokaler, deterministischer Service zur Erzeugung von Merkle-Trees,
 * signierten Proof-Zertifikaten und Verifikation.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MerkleTree {
  root: string;
  leaves: string[];
  layers: string[][];
}

export interface ProofMetadata {
  title: string;
  author: string;
  timestamp: number;
  version: string;
}

export interface ProofCertificate {
  metadata: ProofMetadata;
  merkleRoot: string;
  signature: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  details?: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const PROOF_VERSION = '1.0.0';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Baut einen Merkle-Tree über Kapitel.
 */
export async function buildMerkleTree(chapters: string[]): Promise<MerkleTree> {
  if (!chapters || chapters.length === 0) {
    return { root: '', leaves: [], layers: [] };
  }

  // Blatt-Hashes
  const leaves: string[] = [];
  for (const chapter of chapters) {
    const hash = await sha256(chapter);
    leaves.push(hash);
  }

  // Baum aufbauen
  const layers: string[][] = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left;
      const combined = await sha256(left + right);
      nextLayer.push(combined);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = currentLayer[0] || '';

  return { root, leaves, layers };
}

/**
 * Erzeugt ein signiertes Proof-Zertifikat.
 */
export async function signProof(tree: MerkleTree, metadata: ProofMetadata): Promise<ProofCertificate> {
  if (!tree || !tree.root) {
    throw new Error('Ungültiger Merkle-Tree');
  }

  const safeMetadata: ProofMetadata = {
    title: metadata?.title || 'Unbekannt',
    author: metadata?.author || 'Unbekannt',
    timestamp: metadata?.timestamp || Date.now(),
    version: metadata?.version || PROOF_VERSION,
  };

  // Signatur: SHA-256 über Root + Metadaten
  const signatureData = `${tree.root}:${safeMetadata.title}:${safeMetadata.author}:${safeMetadata.timestamp}:${safeMetadata.version}`;
  const signature = await sha256(signatureData);

  return {
    metadata: safeMetadata,
    merkleRoot: tree.root,
    signature,
  };
}

/**
 * Verifiziert ein Proof-Zertifikat gegen Kapitel.
 */
export async function verifyProof(certificate: ProofCertificate, chapters: string[]): Promise<VerificationResult> {
  if (!certificate || !certificate.merkleRoot || !certificate.signature) {
    return { valid: false, message: 'Ungültiges Zertifikat' };
  }

  if (!chapters || chapters.length === 0) {
    return { valid: false, message: 'Keine Kapitel angegeben' };
  }

  // Merkle-Tree neu berechnen
  const tree = await buildMerkleTree(chapters);

  // Root vergleichen
  if (tree.root !== certificate.merkleRoot) {
    return {
      valid: false,
      message: 'Merkle-Root stimmt nicht überein',
      details: `Erwartet: ${certificate.merkleRoot}, Berechnet: ${tree.root}`,
    };
  }

  // Signatur verifizieren
  const signatureData = `${tree.root}:${certificate.metadata.title}:${certificate.metadata.author}:${certificate.metadata.timestamp}:${certificate.metadata.version}`;
  const expectedSignature = await sha256(signatureData);

  if (expectedSignature !== certificate.signature) {
    return {
      valid: false,
      message: 'Signatur stimmt nicht überein',
      details: `Erwartet: ${certificate.signature}, Berechnet: ${expectedSignature}`,
    };
  }

  return {
    valid: true,
    message: 'Zertifikat gültig',
    details: `Titel: ${certificate.metadata.title}, Autor: ${certificate.metadata.author}, Zeitstempel: ${new Date(certificate.metadata.timestamp).toISOString()}`,
  };
}
