/**
 * Phonetik-Lexikon-Service — WP 32.2 (Phonetischer IPA-Wächter & Aussprache-Lexikon)
 *
 * Lokaler, deterministischer Service zur Generierung von IPA-Lautschrift,
 * Silben- und Betonungs-Mapping und Sprecher-Glossar-Export.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IpaResult {
  word: string;
  ipa: string;
  simplified: string;
}

export interface SyllableStressResult {
  word: string;
  syllables: string[];
  primaryStress: number;
  secondaryStress?: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const IPA_MAP: Record<string, string> = {
  'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
  'ä': 'ɛ', 'ö': 'ø', 'ü': 'y',
  'b': 'b', 'd': 'd', 'f': 'f', 'g': 'g', 'h': 'h',
  'j': 'j', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n',
  'p': 'p', 'r': 'r', 's': 's', 't': 't', 'v': 'v',
  'w': 'w', 'x': 'ks', 'z': 'ts',
  'sch': 'ʃ', 'ch': 'x', 'th': 't', 'ph': 'f',
  'ei': 'aɪ', 'au': 'aʊ', 'eu': 'ɔʏ', 'ie': 'iː',
  'sh': 'ʃ', 'ng': 'ŋ', 'ck': 'k', 'tz': 'ts',
};

const SIMPLIFIED_MAP: Record<string, string> = {
  'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
  'ä': 'Ä', 'ö': 'Ö', 'ü': 'Ü',
  'sch': 'SH', 'ch': 'CH', 'th': 'T', 'ph': 'F',
  'ei': 'EI', 'au': 'AU', 'eu': 'EU', 'ie': 'I',
  'sh': 'SH', 'ng': 'NG', 'ck': 'K', 'tz': 'Z',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generiert Internationales Phonetisches Alphabet und vereinfachte Lautschrift.
 */
export function generateIPA(word: string): IpaResult {
  if (!word || typeof word !== 'string') {
    return { word: '', ipa: '', simplified: '' };
  }

  const clean = word.trim().toLowerCase();
  let ipa = '';
  let simplified = '';

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const twoChar = clean.slice(i, i + 2);

    if (IPA_MAP[twoChar]) {
      ipa += IPA_MAP[twoChar];
      simplified += SIMPLIFIED_MAP[twoChar] || twoChar.toUpperCase();
      i++;
    } else if (IPA_MAP[char]) {
      ipa += IPA_MAP[char];
      simplified += SIMPLIFIED_MAP[char] || char.toUpperCase();
    } else {
      ipa += char;
      simplified += char.toUpperCase();
    }
  }

  return { word: clean, ipa: `/${ipa}/`, simplified };
}

/**
 * Markiert primäre und sekundäre Wortbetonungen.
 */
export function mapSyllableStress(word: string): SyllableStressResult {
  if (!word || typeof word !== 'string') {
    return { word: '', syllables: [], primaryStress: 0 };
  }

  const clean = word.trim().toLowerCase();
  const vowels = 'aeiouäöü';
  const syllables: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    current += char;

    if (vowels.includes(char) && i < clean.length - 1) {
      const nextChar = clean[i + 1];
      if (!vowels.includes(nextChar)) {
        syllables.push(current);
        current = '';
      }
    }
  }

  if (current) {
    syllables.push(current);
  }

  if (syllables.length === 0) {
    syllables.push(clean);
  }

  // Primäre Betonung auf erste Silbe (Deutsch-Standard)
  const primaryStress = 0;
  // Sekundäre Betonung auf dritte Silbe bei langen Wörtern
  const secondaryStress = syllables.length > 2 ? 2 : undefined;

  return { word: clean, syllables, primaryStress, secondaryStress };
}

/**
 * Generiert ein kompaktes Aussprache-Dossier für das Tonstudio.
 */
export function exportSpeakerGlossary(words: string[]): string {
  if (!words || words.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== AUSSPACHE-GLOSSAR ===');
  lines.push('');

  for (const word of words) {
    const ipa = generateIPA(word);
    const stress = mapSyllableStress(word);
    lines.push(`${word}: ${ipa.ipa} (${ipa.simplified})`);
    lines.push(`  Silben: ${stress.syllables.join(' · ')}`);
    lines.push(`  Betonung: Silbe ${stress.primaryStress + 1}`);
    if (stress.secondaryStress !== undefined) {
      lines.push(`  Sekundär: Silbe ${stress.secondaryStress + 1}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
