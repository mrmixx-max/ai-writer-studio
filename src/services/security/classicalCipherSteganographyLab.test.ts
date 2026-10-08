// @vitest-environment jsdom
/**
 * Tests: Klassische Chiffren & Steganografie-Lab (Meilenstein 57.0 / v6.9.0)
 */

import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  encryptOneTimePad,
  decryptOneTimePad,
  encryptBookCipher,
  decryptBookCipher,
  hideMessage,
  extractMessage,
  createSampleOTP,
  createSampleSteganogram,
} from './classicalCipherSteganographyLab';

describe('hashString', () => {
  it('ist deterministisch: gleicher String ergibt gleichen Hash', () => {
    expect(hashString('hallo')).toBe(hashString('hallo'));
    expect(hashString('Ein langer Beispieltext mit Umlauten äöü')).toBe(
      hashString('Ein langer Beispieltext mit Umlauten äöü')
    );
  });

  it('unterschiedliche Strings ergeben unterschiedliche Hashes', () => {
    expect(hashString('hallo')).not.toBe(hashString('welt'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('')).not.toBe(hashString('a'));
  });

  it('liefert einen unsigned 32-bit Wert (nicht-negativ, ganzzahlig)', () => {
    for (const input of ['', 'a', 'hallo', 'Sehr langer String mit vielen Zeichen 12345!?']) {
      const h = hashString(input);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('liefert für unterschiedliche Seeds unterschiedliche Sequenzen', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('encryptOneTimePad', () => {
  it('liefert ciphertext, key und blocks', () => {
    const result = encryptOneTimePad('Hallo Welt');
    expect(typeof result.ciphertext).toBe('string');
    expect(Array.isArray(result.key)).toBe(true);
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  it('erzeugt für jeden Plaintext-Char einen Block', () => {
    const plaintext = 'Hallo Welt';
    const result = encryptOneTimePad(plaintext);
    expect(result.blocks.length).toBe(plaintext.length);
    expect(result.key.length).toBe(plaintext.length);
  });

  it('besteht aus 5-stelligen numerischen Blöcken', () => {
    const result = encryptOneTimePad('Geheim');
    for (const block of result.blocks) {
      expect(block).toMatch(/^\d{5}$/);
    }
    for (const part of result.ciphertext.split(' ')) {
      expect(part).toMatch(/^\d{5}$/);
    }
  });

  it('ciphertext ist die mit Leerzeichen verbundene Blockliste', () => {
    const result = encryptOneTimePad('Test');
    expect(result.ciphertext).toBe(result.blocks.join(' '));
  });

  it('ist deterministisch bei gleichem Plaintext', () => {
    const a = encryptOneTimePad('Hallo Welt');
    const b = encryptOneTimePad('Hallo Welt');
    expect(a.ciphertext).toBe(b.ciphertext);
    expect(a.key).toEqual(b.key);
  });
});

describe('decryptOneTimePad', () => {
  it('roundtrip: entschlüsselt zum ursprünglichen Plaintext', () => {
    const plaintext = 'Hallo Welt';
    const { ciphertext, key } = encryptOneTimePad(plaintext);
    expect(decryptOneTimePad(ciphertext, key)).toBe(plaintext);
  });

  it('roundtrip funktioniert für verschiedene Texte', () => {
    for (const plaintext of ['A', 'Geheime Botschaft', '12345', 'äöüß']) {
      const { ciphertext, key } = encryptOneTimePad(plaintext);
      expect(decryptOneTimePad(ciphertext, key)).toBe(plaintext);
    }
  });

  it('roundtrip mit explizit übergebenem Schlüssel', () => {
    const key = [1, 2, 3, 4, 5];
    const { ciphertext } = encryptOneTimePad('Test', key);
    expect(decryptOneTimePad(ciphertext, key)).toBe('Test');
  });
});

describe('encryptBookCipher', () => {
  const book = { pages: 10, linesPerPage: 5, wordsPerPage: 4 };

  it('liefert ciphertext, references und key', () => {
    const result = encryptBookCipher('Hi', book, 7);
    expect(typeof result.ciphertext).toBe('string');
    expect(Array.isArray(result.references)).toBe(true);
    expect(typeof result.key).toBe('string');
  });

  it('erzeugt für jeden Plaintext-Char eine Referenz', () => {
    const plaintext = 'Hallo';
    const result = encryptBookCipher(plaintext, book, 7);
    expect(result.references.length).toBe(plaintext.length);
  });

  it('Referenzen liegen innerhalb der Buch-Dimensionen', () => {
    const result = encryptBookCipher('Botschaft', book, 1);
    for (const ref of result.references) {
      expect(ref.page).toBeGreaterThanOrEqual(1);
      expect(ref.page).toBeLessThanOrEqual(book.pages);
      expect(ref.line).toBeGreaterThanOrEqual(1);
      expect(ref.line).toBeLessThanOrEqual(book.linesPerPage);
      expect(ref.word).toBeGreaterThanOrEqual(1);
      expect(ref.word).toBeLessThanOrEqual(book.wordsPerPage);
    }
  });

  it('ciphertext kodiert die Buch-Dimensionen, key enthält den Seed', () => {
    const result = encryptBookCipher('Hi', book, 7);
    expect(result.ciphertext).toBe('10x5x4');
    expect(result.key).toContain('seed:7');
  });
});

describe('decryptBookCipher', () => {
  const book = { pages: 10, linesPerPage: 5, wordsPerPage: 4 };

  it('roundtrip: entschlüsselt zum ursprünglichen Plaintext', () => {
    const plaintext = 'Hallo';
    const { ciphertext, references } = encryptBookCipher(plaintext, book, 7);
    expect(decryptBookCipher(ciphertext, references)).toBe(plaintext);
  });

  it('roundtrip funktioniert für verschiedene Texte', () => {
    for (const plaintext of ['A', 'Geheim', '12345', 'Botschaft an Agent 007']) {
      const { ciphertext, references } = encryptBookCipher(plaintext, book, 3);
      expect(decryptBookCipher(ciphertext, references)).toBe(plaintext);
    }
  });
});

describe('hideMessage', () => {
  const cover =
    'ein zwei drei vier fuenf sechs sieben acht neun zehn elf zwoelf dreizehn vierzehn fuenfzehn sechzehn siebzehn achtzehn neunzehn zwanzig einundzwanzig zweiundzwanzig dreiundzwanzig vierundzwanzig fuenfundzwanzig';

  it('liefert steganogram, positions und key', () => {
    const result = hideMessage(cover, 'Hallo');
    expect(typeof result.steganogram).toBe('string');
    expect(Array.isArray(result.positions)).toBe(true);
    expect(typeof result.key).toBe('string');
  });

  it('erzeugt für jeden geheimen Char eine Position', () => {
    const result = hideMessage(cover, 'Hallo');
    expect(result.positions.length).toBe('Hallo'.length);
  });

  it('versteckt mit Standard-Intervall 3 in jedem dritten Wort', () => {
    const result = hideMessage(cover, 'Hallo');
    expect(result.positions).toEqual([2, 5, 8, 11, 14]);
    expect(result.key).toContain('interval:3');
  });

  it('wirft einen Fehler, wenn der Cover-Text zu kurz ist', () => {
    expect(() => hideMessage('kurzer text', 'Lange Nachricht')).toThrow();
  });
});

describe('extractMessage', () => {
  const cover =
    'ein zwei drei vier fuenf sechs sieben acht neun zehn elf zwoelf dreizehn vierzehn fuenfzehn sechzehn siebzehn achtzehn neunzehn zwanzig einundzwanzig zweiundzwanzig dreiundzwanzig vierundzwanzig fuenfundzwanzig';

  it('roundtrip: extrahiert die ursprüngliche Nachricht', () => {
    const { steganogram, positions } = hideMessage(cover, 'Hallo');
    expect(extractMessage(steganogram, 3, positions)).toBe('Hallo');
  });

  it('roundtrip funktioniert für verschiedene Nachrichten', () => {
    for (const message of ['A', 'Geheim', 'abcde']) {
      const { steganogram, positions } = hideMessage(cover, message);
      expect(extractMessage(steganogram, 3, positions)).toBe(message);
    }
  });
});

describe('createSampleOTP', () => {
  it('liefert ein gültiges Beispiel-OTP', () => {
    const result = createSampleOTP();
    expect(typeof result.ciphertext).toBe('string');
    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(Array.isArray(result.key)).toBe(true);
    expect(result.key.length).toBeGreaterThan(0);
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(result.blocks.length).toBe(result.key.length);
  });

  it('Beispiel-OTP lässt sich wieder entschlüsseln', () => {
    const { ciphertext, key } = createSampleOTP();
    expect(decryptOneTimePad(ciphertext, key)).toBe('Hallo Welt');
  });
});

describe('createSampleSteganogram', () => {
  it('liefert ein gültiges Beispiel-Steganogramm', () => {
    const result = createSampleSteganogram();
    expect(typeof result.steganogram).toBe('string');
    expect(result.steganogram.length).toBeGreaterThan(0);
    expect(Array.isArray(result.positions)).toBe(true);
    expect(result.positions.length).toBeGreaterThan(0);
    expect(typeof result.key).toBe('string');
  });

  it('Beispiel-Steganogramm lässt die Nachricht wieder extrahieren', () => {
    const { steganogram, positions } = createSampleSteganogram();
    expect(extractMessage(steganogram, 3, positions)).toBe('Hallo');
  });
});
