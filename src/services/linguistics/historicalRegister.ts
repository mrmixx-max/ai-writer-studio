/**
 * Historischer-Register-Service — WP 28.1 (Historischer Duktus & Anachronismus-Wächter)
 *
 * Lokaler, deterministischer Service zur Erkennung von Anachronismen,
 * historischen Synonymen und Förmlichkeits-Überwachung.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Epoch = 'antike' | 'mittelalter' | 'renaissance' | 'viktorianisch' | '1920er' | 'cyberpunk';

export interface Anachronism {
  word: string;
  position: number;
  reason: string;
  suggestion?: string;
}

export interface FormalityResult {
  correct: boolean;
  expectedForm: string;
  actualForm: string;
  message: string;
}

// ─── Anachronismus-Datenbank ────────────────────────────────────────────────

const ANACHRONISMS: Record<Epoch, Record<string, { reason: string; suggestion?: string }>> = {
  antike: {
    'uhr': { reason: 'Uhren gab es in der Antike nicht', suggestion: 'Sonnenuhr' },
    'telefon': { reason: 'Telefone gab es in der Antike nicht', suggestion: 'Boten' },
    'auto': { reason: 'Autos gab es in der Antike nicht', suggestion: 'Wagen' },
    'computer': { reason: 'Computer gab es in der Antike nicht', suggestion: 'Abakus' },
    'psychologie': { reason: 'Psychologie als Wissenschaft gab es in der Antike nicht', suggestion: 'Philosophie der Seele' },
    'demokratie': { reason: 'Demokratie im modernen Sinne gab es in der Antike nicht', suggestion: 'Volksversammlung' },
    'krieg': { reason: 'Der Begriff "Krieg" im modernen Sinne passt nicht', suggestion: 'Kampf' },
    'religion': { reason: 'Der Begriff "Religion" ist modern', suggestion: 'Kult' },
  },
  mittelalter: {
    'uhr': { reason: 'Uhrzeit im modernen Sinne gab es im Mittelalter nicht', suggestion: 'Stundenglas' },
    'telefon': { reason: 'Telefone gab es im Mittelalter nicht', suggestion: 'Boten' },
    'telefonierte': { reason: 'Telefone gab es im Mittelalter nicht', suggestion: 'Boten' },
    'auto': { reason: 'Autos gab es im Mittelalter nicht', suggestion: 'Pferdewagen' },
    'computer': { reason: 'Computer gab es im Mittelalter nicht', suggestion: 'Rechenstab' },
    'psychologie': { reason: 'Psychologie als Wissenschaft gab es im Mittelalter nicht', suggestion: 'Lehre von der Seele' },
    'psychologisch': { reason: 'Psychologie als Wissenschaft gab es im Mittelalter nicht', suggestion: 'Lehre von der Seele' },
    'demokratie': { reason: 'Demokratie im modernen Sinne gab es im Mittelalter nicht', suggestion: 'Ratsversammlung' },
    'krieg': { reason: 'Der Begriff "Krieg" im modernen Sinne passt nicht', suggestion: 'Fehde' },
    'religion': { reason: 'Der Begriff "Religion" ist modern', suggestion: 'Glaube' },
    'bürger': { reason: 'Bürger im modernen Sinne gab es im Mittelalter nicht', suggestion: 'Burgmann' },
  },
  renaissance: {
    'telefon': { reason: 'Telefone gab es in der Renaissance nicht', suggestion: 'Boten' },
    'auto': { reason: 'Autos gab es in der Renaissance nicht', suggestion: 'Kutsche' },
    'computer': { reason: 'Computer gab es in der Renaissance nicht', suggestion: 'Rechenstab' },
    'psychologie': { reason: 'Psychologie als Wissenschaft gab es in der Renaissance nicht', suggestion: 'Lehre von der Seele' },
    'demokratie': { reason: 'Demokratie im modernen Sinne gab es in der Renaissance nicht', suggestion: 'Rat' },
    'krieg': { reason: 'Der Begriff "Krieg" im modernen Sinne passt nicht', suggestion: 'Feldzug' },
    'religion': { reason: 'Der Begriff "Religion" ist modern', suggestion: 'Glaube' },
    'bürger': { reason: 'Bürger im modernen Sinne gab es in der Renaissance nicht', suggestion: 'Bürger' },
  },
  viktorianisch: {
    'telefon': { reason: 'Telefone gab es im viktorianischen Zeitalter nicht', suggestion: 'Brief' },
    'auto': { reason: 'Autos gab es im viktorianischen Zeitalter nicht', suggestion: 'Kutsche' },
    'computer': { reason: 'Computer gab es im viktorianischen Zeitalter nicht', suggestion: 'Rechenmaschine' },
    'psychologie': { reason: 'Psychologie als Wissenschaft gab es im viktorianischen Zeitalter nicht', suggestion: 'Moralphilosophie' },
    'demokratie': { reason: 'Demokratie im modernen Sinne gab es im viktorianischen Zeitalter nicht', suggestion: 'Parlament' },
    'krieg': { reason: 'Der Begriff "Krieg" im modernen Sinne passt nicht', suggestion: 'Feldzug' },
    'religion': { reason: 'Der Begriff "Religion" ist modern', suggestion: 'Glaube' },
    'bürger': { reason: 'Bürger im modernen Sinne gab es im viktorianischen Zeitalter nicht', suggestion: 'Untertan' },
  },
  '1920er': {
    'telefon': { reason: 'Telefone gab es in den 1920ern nicht', suggestion: 'Brief' },
    'telefonierte': { reason: 'Telefone gab es in den 1920ern nicht', suggestion: 'Brief' },
    'auto': { reason: 'Autos gab es in den 1920ern nicht', suggestion: 'Kutsche' },
    'computer': { reason: 'Computer gab es in den 1920ern nicht', suggestion: 'Rechenmaschine' },
    'psychologie': { reason: 'Psychologie als Wissenschaft gab es in den 1920ern nicht', suggestion: 'Seelenkunde' },
    'psychologisch': { reason: 'Psychologie als Wissenschaft gab es in den 1920ern nicht', suggestion: 'Seelenkunde' },
    'demokratie': { reason: 'Demokratie im modernen Sinne gab es in den 1920ern nicht', suggestion: 'Rat' },
    'krieg': { reason: 'Der Begriff "Krieg" im modernen Sinne passt nicht', suggestion: 'Feldzug' },
    'religion': { reason: 'Der Begriff "Religion" ist modern', suggestion: 'Glaube' },
    'bürger': { reason: 'Bürger im modernen Sinne gab es in den 1920ern nicht', suggestion: 'Untertan' },
  },
  cyberpunk: {
    'uhr': { reason: 'Uhrzeit im Cyberpunk-Zeitalter ist obsolet', suggestion: 'Implantat' },
    'telefon': { reason: 'Telefone sind im Cyberpunk-Zeitalter obsolet', suggestion: 'Implantat' },
    'auto': { reason: 'Autos sind im Cyberpunk-Zeitalter obsolet', suggestion: 'Fahrzeug' },
    'computer': { reason: 'Computer sind im Cyberpunk-Zeitalter obsolet', suggestion: 'Cyberdeck' },
    'psychologie': { reason: 'Psychologie ist im Cyberpunk-Zeitalter obsolet', suggestion: 'Neuro-Programmierung' },
    'demokratie': { reason: 'Demokratie ist im Cyberpunk-Zeitalter obsolet', suggestion: 'Konzern-Rat' },
    'krieg': { reason: 'Der Begriff "Krieg" ist im Cyberpunk-Zeitalter obsolet', suggestion: 'Krieg' },
    'religion': { reason: 'Der Begriff "Religion" ist im Cyberpunk-Zeitalter obsolet', suggestion: 'Kult' },
    'bürger': { reason: 'Bürger ist im Cyberpunk-Zeitalter obsolet', suggestion: 'Bürger' },
  },
};

// ─── Historische Synonyme ───────────────────────────────────────────────────

const HISTORICAL_SYNONYMS: Record<string, string[]> = {
  'schnell': ['rasch', 'flink', 'hastig', 'geschwind'],
  'langsam': ['gemächlich', 'schwerfällig', 'träge'],
  'schön': ['schön', 'hübsch', 'anmutig', 'zierlich'],
  'hässlich': ['unschön', 'widerlich', 'abscheulich'],
  'groß': ['groß', 'mächtig', 'gewaltig', 'riesig'],
  'klein': ['klein', 'winzig', 'gering', 'unbedeutend'],
  'stark': ['stark', 'mächtig', 'gewaltig', 'kräftig'],
  'schwach': ['schwach', 'kraftlos', 'gebrechlich', 'zart'],
  'klug': ['klug', 'weise', 'gescheit', 'verständig'],
  'dumm': ['dumm', 'töricht', 'unweise', 'einfältig'],
  'reich': ['reich', 'mächtig', 'gewaltig', 'prächtig'],
  'arm': ['arm', 'bedürftig', 'mittellos', 'elend'],
  'kalt': ['kalt', 'eisig', 'frostig', 'kühl'],
  'warm': ['warm', 'lau', 'mild', 'angenehm'],
  'dunkel': ['dunkel', 'finster', 'schwarz', 'nacht'],
  'hell': ['hell', 'leuchtend', 'klar', 'tag'],
  'laut': ['laut', 'lärmend', 'ohrenbetäubend', 'stark'],
  'leise': ['leise', 'flüsternd', 'gedämpft', 'sanft'],
  'hart': ['hart', 'starr', 'unerbittlich', 'fest'],
  'weich': ['weich', 'sanft', 'nachgiebieg', 'mürbe'],
  'jung': ['jung', 'jugendlich', 'frisch', 'grün'],
  'alt': ['alt', 'betagt', 'grau', 'bejahrt'],
};

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Normalisiert Flektierte Formen auf die Grundform. */
function normalizeWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.startsWith('telefoni')) return 'telefon';
  if (w.startsWith('psycholog')) return 'psychologie';
  return w;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Erkennt Anachronismen in einem Text basierend auf der gewählten Epoche.
 * Verwendet O(1)-Set-Lookups für schnelle Erkennung.
 */
export function detectAnachronisms(text: string, epoch: Epoch): Anachronism[] {
  if (!text || typeof text !== 'string') return [];
  if (!epoch || !ANACHRONISMS[epoch]) return [];

  const result: Anachronism[] = [];
  const words = text.split(/\s+/);
  const epochData = ANACHRONISMS[epoch];

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i].replace(/[.,!?;:]/g, '');
    const direct = rawWord.toLowerCase();
    const norm = normalizeWord(rawWord);
    const entry = epochData[direct] || epochData[norm];
    if (entry) {
      result.push({
        word: rawWord.toLowerCase(),
        position: i,
        reason: entry.reason,
        suggestion: entry.suggestion,
      });
    }
  }

  return result;
}

/**
 * Schlägt historisch authentische Synonyme vor.
 */
export function suggestHistoricalSynonyms(word: string, epoch: Epoch): string[] {
  if (!word || typeof word !== 'string') return [];
  if (!epoch || !ANACHRONISMS[epoch]) return [];

  const key = word.toLowerCase().trim();
  return HISTORICAL_SYNONYMS[key] || [];
}

/**
 * Überwacht die korrekte Form (Siezen/Ihrzen/Erzen/Duzen) gemäß gesellschaftlichem Rang.
 */
export function checkFormalityLevel(text: string, speakerRank: number, listenerRank: number): FormalityResult {
  if (!text || typeof text !== 'string') {
    return { correct: false, expectedForm: '', actualForm: '', message: 'Kein Text angegeben' };
  }

  const safeSpeakerRank = Math.max(0, speakerRank || 0);
  const safeListenerRank = Math.max(0, listenerRank || 0);

  // Bestimme erwartete Form
  let expectedForm: string;
  if (safeSpeakerRank > safeListenerRank) {
    expectedForm = 'du'; // Höherer Rang → du
  } else if (safeSpeakerRank < safeListenerRank) {
    expectedForm = 'Sie'; // Niedriger Rang → Sie
  } else {
    expectedForm = 'du'; // Gleicher Rang → du
  }

  // Prüfe tatsächliche Form
  const hasSie = /\bSie\b/.test(text);
  const hasDu = /\bdu\b/i.test(text);
  const hasIhr = /\bIhr\b/.test(text);

  let actualForm: string;
  if (hasSie) actualForm = 'Sie';
  else if (hasIhr) actualForm = 'Ihr';
  else if (hasDu) actualForm = 'du';
  else actualForm = 'unbekannt';

  const correct = actualForm === expectedForm || actualForm === 'unbekannt';

  return {
    correct,
    expectedForm,
    actualForm,
    message: correct
      ? `Form korrekt: ${actualForm}`
      : `Form falsch: erwartet ${expectedForm}, gefunden ${actualForm}`,
  };
}
