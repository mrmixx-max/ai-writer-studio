/**
 * Tests: Authorship-Proof-Service (WP 29.2)
 */

import { describe, it, expect } from 'vitest';
import {
  buildMerkleTree,
  signProof,
  verifyProof,
  type ProofMetadata,
} from './authorshipProof';

describe('buildMerkleTree', () => {
  it('leeres Array ergibt leeren Tree', async () => {
    const tree = await buildMerkleTree([]);
    expect(tree.root).toBe('');
    expect(tree.leaves).toEqual([]);
  });

  it('null/undefined ergibt leeren Tree', async () => {
    const tree = await buildMerkleTree(null as unknown as string[]);
    expect(tree.root).toBe('');
  });

  it('ein Kapitel ergibt einen Leaf', async () => {
    const tree = await buildMerkleTree(['Kapitel 1']);
    expect(tree.leaves.length).toBe(1);
    expect(tree.root).toBe(tree.leaves[0]);
  });

  it('zwei Kapitel ergibt einen Root', async () => {
    const tree = await buildMerkleTree(['Kapitel 1', 'Kapitel 2']);
    expect(tree.leaves.length).toBe(2);
    expect(tree.root).not.toBe('');
    expect(tree.root).not.toBe(tree.leaves[0]);
  });

  it('drei Kapitel ergibt einen Root', async () => {
    const tree = await buildMerkleTree(['A', 'B', 'C']);
    expect(tree.leaves.length).toBe(3);
    expect(tree.root).not.toBe('');
  });

  it('Root ist ein SHA-256-Hash', async () => {
    const tree = await buildMerkleTree(['Test']);
    expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
  });

  it('gleiche Kapitel ergeben gleichen Root', async () => {
    const tree1 = await buildMerkleTree(['A', 'B']);
    const tree2 = await buildMerkleTree(['A', 'B']);
    expect(tree1.root).toBe(tree2.root);
  });

  it('verschiedene Kapitel ergeben verschiedenen Root', async () => {
    const tree1 = await buildMerkleTree(['A', 'B']);
    const tree2 = await buildMerkleTree(['A', 'C']);
    expect(tree1.root).not.toBe(tree2.root);
  });
});

describe('signProof', () => {
  const metadata: ProofMetadata = {
    title: 'Testbuch',
    author: 'Testautor',
    timestamp: 1234567890,
    version: '1.0.0',
  };

  it('erzeugt ein Zertifikat', async () => {
    const tree = await buildMerkleTree(['Kapitel 1']);
    const cert = await signProof(tree, metadata);
    expect(cert.merkleRoot).toBe(tree.root);
    expect(cert.signature).not.toBe('');
    expect(cert.metadata.title).toBe('Testbuch');
  });

  it('Signatur ist ein SHA-256-Hash', async () => {
    const tree = await buildMerkleTree(['Kapitel 1']);
    const cert = await signProof(tree, metadata);
    expect(cert.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('un gültiger Tree wirft Fehler', async () => {
    await expect(signProof({ root: '', leaves: [], layers: [] }, metadata)).rejects.toThrow();
  });

  it('gleiche Metadaten ergeben gleiche Signatur', async () => {
    const tree = await buildMerkleTree(['A']);
    const cert1 = await signProof(tree, metadata);
    const cert2 = await signProof(tree, metadata);
    expect(cert1.signature).toBe(cert2.signature);
  });

  it('verschiedene Metadaten ergeben verschiedene Signatur', async () => {
    const tree = await buildMerkleTree(['A']);
    const cert1 = await signProof(tree, metadata);
    const cert2 = await signProof(tree, { ...metadata, title: 'Anderes Buch' });
    expect(cert1.signature).not.toBe(cert2.signature);
  });
});

describe('verifyProof', () => {
  const metadata: ProofMetadata = {
    title: 'Testbuch',
    author: 'Testautor',
    timestamp: 1234567890,
    version: '1.0.0',
  };

  it('gültiges Zertifikat wird verifiziert', async () => {
    const chapters = ['Kapitel 1', 'Kapitel 2'];
    const tree = await buildMerkleTree(chapters);
    const cert = await signProof(tree, metadata);
    const result = await verifyProof(cert, chapters);
    expect(result.valid).toBe(true);
  });

  it('ungültiges Zertifikat wird abgelehnt', async () => {
    const result = await verifyProof(null as unknown as any, []);
    expect(result.valid).toBe(false);
  });

  it('geänderte Kapitel werden erkannt', async () => {
    const chapters = ['Kapitel 1', 'Kapitel 2'];
    const tree = await buildMerkleTree(chapters);
    const cert = await signProof(tree, metadata);
    const result = await verifyProof(cert, ['Kapitel 1', 'Geändert']);
    expect(result.valid).toBe(false);
  });

  it('leere Kapitel werden abgelehnt', async () => {
    const tree = await buildMerkleTree(['A']);
    const cert = await signProof(tree, metadata);
    const result = await verifyProof(cert, []);
    expect(result.valid).toBe(false);
  });

  it('Verifikation enthält Details', async () => {
    const chapters = ['A'];
    const tree = await buildMerkleTree(chapters);
    const cert = await signProof(tree, metadata);
    const result = await verifyProof(cert, chapters);
    expect(result.details).toBeDefined();
    expect(result.details).toContain('Testbuch');
  });
});
