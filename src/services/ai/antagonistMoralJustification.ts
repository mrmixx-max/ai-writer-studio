// antagonistMoralJustification.ts (WP 130.1, Meilenstein 63.0 / v7.5.0)
//
// Antagonisten-Selbstrechtfertigungs-Synthesizer.
//
// Dieses Modul erzeugt moralische Rechtfertigungen für literarische
// Antagonisten. Es modelliert vier philosophische Grundhaltungen, aus
// denen ein Monolog-Synthesizer selbstredende Reden generiert und ein
// Verführungs-Regler die emotionale Nähe zum Leser kalibriert.
//
// Design-Regeln (analog psychologicalGaslightingWeaver / propheticOracleSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input + gleicher Seed → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Browser-kompatibel: keine node:-Module.
//
// Hinweis: Dieses Werkzeug dient ausschließlich der literarischen Darstellung
// moralischer Selbstrechtfertigung, nicht deren Anwendung.

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer, vorzeichenloser Seed. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  const text = typeof input === 'string' ? input : '';
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wählt ein Element zufällig aus. Wirft bei leerem Array. */
function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('pick: leeres Array');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)];
}

/** Zahl auf einen Bereich klemmen; ungültige Werte fallen auf min zurück. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine philosophische Grundhaltung eines Antagonisten. */
export interface AntagonistPhilosophy {
  /** Stabiler Bezeichner (englisch). */
  id: string;
  /** Menschenlesbarer Name. */
  name: string;
  /** Kurzbeschreibung der Haltung. */
  description: string;
  /** Der zentrale Glaubenssatz (erste Person, prägnant). */
  coreBelief: string;
  /** Literarische Vorbilder und Beispiele. */
  examples: string[];
}

/** Eingabe für den Monolog-Synthesizer. */
export interface MonologueInput {
  /** ID der Philosophie (z. B. 'utilitarianMartyr'). */
  philosophyId: string;
  /** Name der antagonistischen Figur. */
  villainName: string;
  /** Anzahl der Opfer (optional, für Skalierung). */
  victimCount?: number;
  /** Das Ziel des Antagonisten (optional). */
  goal?: string;
}

/** Ergebnis des Monolog-Synthesizers. */
export interface JustificationMonologue {
  /** Name der verwendeten Philosophie. */
  philosophy: string;
  /** Der generierte Monologtext. */
  monologue: string;
  /** Erkennbare rhetorische Mittel im Monolog. */
  rhetoricalDevices: string[];
  /** Wortzahl des Monologs. */
  wordCount: number;
  /** Die kälteste, prägnanteste Zeile des Monologs. */
  chillingLine: string;
}

/** Ergebnis des Verführungs-Reglers. */
export interface SeductionCalibration {
  /** Kalibrierter Level (0–100). */
  level: number;
  /** Menschenlesbare Bezeichnung des Levels. */
  label: string;
  /** Ton-Anleitung für den Monolog. */
  toneGuidance: string;
  /** Eine Beispielzeile im entsprechenden Ton. */
  sampleLine: string;
  /** Erwarteter Effekt auf den Leser. */
  readerEffect: string;
}

// ---------------------------------------------------------------------------
// 1) Antagonisten-Philosophien
// ---------------------------------------------------------------------------

/** Die vier philosophischen Grundhaltungen von Antagonisten. */
export const ANTAGONIST_PHILOSOPHIES: readonly AntagonistPhilosophy[] = [
  {
    id: 'utilitarianMartyr',
    name: 'Der utilitaristische Märtyrer',
    description:
      'Tötet Tausende, um Millionen zu retten. Die Opfer sind ein notwendiger Preis für das größte Gut — und der Antagonist sieht sich als einzigen, der die Rechnung aufmachen kann.',
    coreBelief:
      'Ich trage die Last, die anderen nicht tragen können. Jeder, den ich opfere, rettet tausend andere — und nur ich habe den Mut, diese Rechnung zu lösen.',
    examples: [
      'Ozymandias (Watchmen) — opfert eine Stadt, um den Weltfrieden zu erzwingen',
      'Thanos (Marvel) — eliminiert die Hälfte aller Leben, um Ressourcen zu retten',
      'Der Großinquisitor (Die Brüder Karamasow) — opfert Einzelne für die Glückseligkeit der Mehrheit',
    ],
  },
  {
    id: 'traumatizedMirror',
    name: 'Der traumatisierte Vergeltungs-Spiegel',
    description:
      'Hat selbst unermessliches Leid erfahren und projiziert sein Trauma auf die Welt. Jede Tat ist eine Antwort auf ein früheres Verbrechen — die Grenze zwischen Opfer und Täter ist längst verwischt.',
    coreBelief:
      'Die Welt hat mir alles genommen. Ich nehme nur zurück, was mir gehört — und wenn andere dabei leiden, dann ist das ihre Lehre, nicht meine Schuld.',
    examples: [
      'Killmonger (Black Panther) — verwandelt kollektives Trauma in persönliche Vergeltung',
      'The Joker (The Dark Knight) — spiegelt den Chaos der Gesellschaft zurück',
      'Javert (Die Elenden) — verfolgt, weil das Gesetz seine einzige Wunde ist',
    ],
  },
  {
    id: 'darwinistClimber',
    name: 'Der darwinistische Aufsteiger',
    description:
      'Nur Schmerz treibt Evolution. Der Antagonist sieht sich als Katalysator, der die Menschheit durch Not und Unterdrückung zu höherer Stärke zwingt.',
    coreBelief:
      'Die Schwachen sterben, die Starken regieren — und ich bin der Messer, der die Menschheit zwingt, sich zu beweisen. Ohne mich gäbe es nur Stillstand.',
    examples: [
      'Magneto (X-Men) — schützt Mutanten durch radikale Ausgrenzung',
      'Negan (The Walking Dead) — regiert durch Angst als Evolutionstrieb',
      'Iago (Othello) — zerstört, weil er die Schwäche anderer beweist',
    ],
  },
  {
    id: 'benevolentDespot',
    name: 'Der wohlwollende Despot',
    description:
      'Die Menschheit erträgt keine Freiheit. Der Antagonist nimmt den Menschen ihre Selbstbestimmung ab — aus Liebe, aus Fürsorge, aus der tiefen Überzeugung, dass sie ohne ihn scheitern würden.',
    coreBelief:
      'Ich weiß, was für sie das Beste ist. Ihre Freiheit ist ein Geschenk, das sie nicht verstehen — also nehme ich es ihnen ab, bevor sie es selbst zerstören.',
    examples: [
      'O’Brien (1984) — kontrolliert aus tiefer Überzeugung der Notwendigkeit',
      'Andrew Ryan (BioShock) — schafft eine Utopie, die Freiheit ausschließt',
      'The Governor (The Walking Dead) — regiert mit eiserner Fürsorge',
    ],
  },
];

// ---------------------------------------------------------------------------
// Monolog-Bausteine je Philosophie
// ---------------------------------------------------------------------------

/** Ein Absatz-Baustein für den Monolog. */
interface MonologueSeed {
  /** Erster Absatz: Einstieg und Selbstpositionierung. */
  opening: string;
  /** Zweiter Absatz: Die Rechtfertigung. */
  justification: string;
  /** Dritter Absatz: Die Konfrontation. */
  confrontation: string;
  /** Vierter Absatz: Der Schluss. */
  closing: string;
}

/** Baustein-Pools je Philosophie-ID. */
const MONOLOGUE_POOLS: Record<string, readonly MonologueSeed[]> = {
  utilitarianMartyr: [
    {
      opening:
        'Ich habe die Rechnung aufgestellt, {villain}. Jeder Name auf dieser Liste rettet tausend andere. Du wirst mich niemals verstehen, weil du nicht zählen kannst.',
      justification:
        'Ich töte nicht aus Hass, sondern aus Pflicht. Die Tausenden, die ich opfere, sind der Preis für die Millionen, die leben werden. Niemand sonst hat den Mut, diese Entscheidung zu treffen.',
      confrontation:
        'Du nennst mich Monster, {villain}. Aber wenn du die Zahl der Geretteten kennst, wirst du schweigen. Deine Moral ist ein Luxus, den sich die Toten nicht leisten können.',
      closing:
        'Ich trage diese Last allein. Wenn die Geschichte mich verdamnt, dann verdammt sie die Wahrheit, dass es keine andere Wahl gab.',
    },
    {
      opening:
        'Es gibt Dinge, die tun müssen, auch wenn sie niemand tun will. Ich bin derjenige, der sie tut, {villain}.',
      justification:
        'Jeder Tropfen Blut, den ich vergieße, fließt in ein Meer aus Leben. Die Mathematik ist brutal, aber klar: eins gegen tausend ist keine Frage, sondern eine Antwort.',
      confrontation:
        'Du siehst die Opfer, {villain}. Ich sehe die Geretteten. Dein Blick ist zu eng, dein Herz zu klein für die Wahrheit.',
      closing:
        'Wenn die Zukunft kommt, wird sie mir danken — oder sie wird nicht mehr existieren, um mich zu verurteilen.',
    },
  ],
  traumatizedMirror: [
    {
      opening:
        'Du weißt nicht, was sie mir angetan haben, {villain}. Du kennst den Schmerz nicht, der mich jede Nacht wach hält. Also urteile nicht.',
      justification:
        'Ich nehme nur, was mir gehört. Jede Tat ist eine Antwort auf ein Verbrechen, das niemand ahnte. Die Welt hat mich gelehrt, dass Schmerz die einzige Währung ist.',
      confrontation:
        'Du siehst einen Täter, {villain}. Ich sehe ein Opfer, das endlich zurückschlägt. Die Grenze zwischen uns ist längst verwischt — du stehst auf der falschen Seite.',
      closing:
        'Wenn du einmal verloren hast, wie ich es verloren habe, wirst du verstehen. Oder du wirst sterben — beides ist mir gleich.',
    },
    {
      opening:
        'Ich war einmal wie du, {villain}. Dann haben sie mir alles genommen — und ich habe gelernt, dass nur Stärke zählt.',
      justification:
        'Meine Taten sind die Spiegel meines Schmerzes. Jeder, den ich verletze, trägt ein Stück dessen, what sie mir angetan haben. Es ist keine Rache — es ist Gerechtigkeit.',
      confrontation:
        'Du verachtest mich, {villain}. Aber du hast nie gespürt, was ich spüre. Dein Urteil ist das Urteil derer, die nie verloren haben.',
      closing:
        'Ich bin das, was die Welt aus mir gemacht hat. Wenn du mich verdamnst, verdamnst du dich selbst.',
    },
  ],
  darwinistClimber: [
    {
      opening:
        'Die Evolution kennt keine Gnade, {villain}. Nur Schmerz treibt die Menschheit vorwärts — und ich bin der Schmerz, der sie zwingt, sich zu beweisen.',
      justification:
        'Die Schwachen sterben, die Starken regieren. Ich bin nicht grausam — ich bin der Katalysator, der die Menschheit zu höherer Stärke zwingt. Ohne mich gäbe es nur Stillstand.',
      confrontation:
        'Du siehst Grausamkeit, {villain}. Ich sehe Notwendigkeit. Die Geschichte wird mich als denjenigen ehren, der den Mut hatte, die harte Wahrheit zu leben.',
      closing:
        'Die Zukunft gehört den Starken. Ich sorge dafür, dass es eine Zukunft gibt — auch wenn ich dabei zerstören muss.',
    },
    {
      opening:
        'Du verstehst es nicht, {villain}. Die Menschheit braucht den Druck, die Not, den Schmerz — nur so wird sie stark.',
      justification:
        'Jede Zivilisation ist durch Blut gewachsen. Ich bin der Messer, der die Schwächen abschneidet, damit die Stärken überleben. Es ist kein Verbrechen — es ist Evolution.',
      confrontation:
        'Du kämpfst gegen mich, {villain}. Aber du kämpfst gegen die Natur selbst. Die Natur siegt immer — und ich bin ihr Werkzeug.',
      closing:
        'Wenn die Starken regieren, werden sie sich erinnern, dass ich sie dorthin gebracht habe. Die Schwachen werden vergessen sein.',
    },
  ],
  benevolentDespot: [
    {
      opening:
        'Ich tue es für sie, {villain}. Die Menschheit erträgt keine Freiheit — sie braucht jemanden, der ihr die Last der Entscheidung abnimmt.',
      justification:
        'Ich nehme ihnen ihre Selbstbestimmung, weil sie sie missbrauchen würden. Meine Fürsorge ist echt, meine Liebe ist tief — und mein Griff ist eisern, weil es sein muss.',
      confrontation:
        'Du nennst mich Tyrann, {villain}. Aber sie sind glücklich unter meiner Führung. Deine Freiheit ist ein Geschenk, das sie nicht verstehen — also nehme ich es ihnen ab.',
      closing:
        'Eines Tagen werden sie mir danken. Bis dahin trage ich die Last der Kontrolle, die sie nicht tragen können.',
    },
    {
      opening:
        'Du siehst die Ketten, {villain}. Ich sehe den Schutz. Die Menschheit ist nicht fähig, sich selbst zu führen — ich bin die Ausnahme, die sie braucht.',
      justification:
        'Jede Entscheidung, die ich für sie treffe, ist eine Entscheidung, die sie nicht treffen könnten. Meine Fürsorge ist grenzenlos, meine Kontrolle unausweichlich.',
      confrontation:
        'Du kämpfst für ihre Freiheit, {villain}. Aber Freiheit ist das, was sie am meisten fürchten. Ich gebe ihnen, was sie wirklich brauchen: Sicherheit.',
      closing:
        'Die Geschichte wird mich als den Wohltäter erinnern, der die Menschheit vor sich selbst gerettet hat.',
    },
  ],
};

/** Rhetorische Mittel je Philosophie. */
const RHETORICAL_DEVICES: Record<string, readonly string[]> = {
  utilitarianMartyr: [
    'Utilitaristische Rechnung',
    'Opfer-Rhetorik',
    'Moralischer Absolutismus',
    'Konsequentialistische Umdeutung',
  ],
  traumatizedMirror: [
    'Trauma-Projektion',
    'Opfer-Täter-Umkehr',
    'Emotionaler Spiegel',
    'Vergeltungslogik',
  ],
  darwinistClimber: [
    'Naturrecht-Argument',
    'Evolutionäre Notwendigkeit',
    'Stärke-Schwäche-Dichotomie',
    'Katalysator-Rhetorik',
  ],
  benevolentDespot: [
    'Fürsorge-Argument',
    'Bevormundungs-Rhetorik',
    'Sicherheitsversprechen',
    'Liebes-Justifizierung',
  ],
};

// ---------------------------------------------------------------------------
// Verführungs-Bausteine
// ---------------------------------------------------------------------------

/** Ton-Anleitung je Level-Bereich. */
const SEDUCTION_TONES: readonly { min: number; label: string; tone: string; readerEffect: string }[] = [
  {
    min: 0,
    label: 'Kaltblütig abstoßend',
    tone:
      'Der Monolog ist trocken, berechnend und ohne jede emotionale Wärme. Der Antagonist handelt wie eine Maschine, die eine Aufgabe erfüllt.',
    readerEffect: 'Der Leser empfindet Abscheu und Distanz. Der Antagonist wirkt unzugänglich und beängstigend.',
  },
  {
    min: 25,
    label: 'Kalkuliert distanziert',
    tone:
      'Der Monolog zeigt erste Risse in der Fassade, bleibt aber überlegt. Der Antagonist rechtfertigt, ohne sich zu entschuldigen.',
    readerEffect: 'Der Leser beginnt, die Logik des Antagonisten zu verstehen, ohne sie zu teilen.',
  },
  {
    min: 50,
    label: 'Ambivalent beunruhigend',
    tone:
      'Der Monolog schwankt zwischen Überzeugung und Zweifel. Der Antagonist zeigt Verletzlichkeit, ohne seine Haltung aufzugeben.',
    readerEffect: 'Der Leser wird unsicher: Die Grenze zwischen Rechtfertigung und Schuld verschwimmt.',
  },
  {
    min: 75,
    label: 'Tragisch bewegend',
    tone:
      'Der Monolog ist von tiefer Trauer und innerer Zerrissenheit geprägt. Der Antagonist leidet unter seiner eigenen Notwendigkeit.',
    readerEffect: 'Der Leser empfindet Mitleid und wird emotionally in die Perspektive des Antagonisten hineingezogen.',
  },
  {
    min: 90,
    label: 'Tragischer herzzerreißender Antiheld',
    tone:
      'Der Monolog ist ein offenes Geständnis. Der Antagonist zeigt volle Verletzlichkeit, Reue und die tiefe Einsamkeit seiner Entscheidung.',
    readerEffect: 'Der Leser steht vor einem unlösbaren moralischen Dilemma: Mitgefühl für den Antagonisten kollidiert mit der Verurteilung seiner Taten.',
  },
];

/** Beispielzeilen je Level-Bereich. */
const SEDUCTION_SAMPLE_LINES: readonly { min: number; line: string }[] = [
  {
    min: 0,
    line: 'Ich tue, was getan werden muss. Deine Empfindlichkeiten sind mir gleichgültig.',
  },
  {
    min: 25,
    line: 'Ich habe nicht gewollt, dass es so kommt. Aber ich habe es zugelassen, weil es nötig war.',
  },
  {
    min: 50,
    line: 'Manchmal frage ich mich, ob ich der bin, den sie brauchen — oder den, den sie verdienen.',
  },
  {
    min: 75,
    line: 'Ich träge diese Last allein, und manchmal wünsche ich, jemand anders hätte sie tragen können.',
  },
  {
    min: 90,
    line: 'Ich habe alles getan, was ich für richtig hielt — und ich würde es wieder tun, obwohl es mich zerstört hat.',
  },
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Philosophie defensiv auflösen; unbekannte ID fällt auf die erste Philosophie zurück. */
function resolvePhilosophy(philosophyId: unknown): AntagonistPhilosophy {
  if (typeof philosophyId === 'string') {
    const found = ANTAGONIST_PHILOSOPHIES.find((p) => p.id === philosophyId);
    if (found) return found;
  }
  return ANTAGONIST_PHILOSOPHIES[0];
}

/** Namen defensiv normalisieren. */
function normalizeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Platzhalter in einer Vorlage ersetzen. */
function fillTemplate(template: string, villain: string, victimCount: number, goal: string): string {
  return template
    .replace(/\{villain\}/g, villain)
    .replace(/\{victimCount\}/g, String(victimCount))
    .replace(/\{goal\}/g, goal);
}

/** Zählt Wörter in einem Text (Leerzeichen-getrennt). */
function countWords(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

// ---------------------------------------------------------------------------
// 2) Monolog-Synthesizer
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen selbstredenden Monolog für einen Antagonisten.
 *
 * Der Monolog besteht aus vier Absätzen (Einstieg, Rechtfertigung,
 * Konfrontation, Schluss), die je Philosophie aus einem Pool stammen.
 * Die kälteste Zeile wird als chillingLine extrahiert.
 *
 * Defensiv: unbekannte Philosophie fällt auf 'utilitarianMartyr' zurück;
 * leere Namen werden durch 'Der Antagonist' ersetzt.
 */
export function synthesizeJustificationMonologue(
  input: MonologueInput,
  seed: number,
): JustificationMonologue {
  const philosophy = resolvePhilosophy(input?.philosophyId);
  const villain = normalizeName(input?.villainName, 'Der Antagonist');
  const victimCount = Number.isFinite(input?.victimCount) ? Math.max(0, Math.floor(input!.victimCount as number)) : 0;
  const goal = typeof input?.goal === 'string' && input.goal.trim().length > 0 ? input.goal.trim() : 'die Zukunft der Menschheit';
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;

  const rng = createSeededRandom(
    hashString(`${philosophy.id}#${villain}#${victimCount}#${goal}#${seedValue}`),
  );

  const pool = MONOLOGUE_POOLS[philosophy.id] ?? MONOLOGUE_POOLS.utilitarianMartyr;
  const seedEntry = pick(pool, rng);

  const opening = fillTemplate(seedEntry.opening, villain, victimCount, goal);
  const justification = fillTemplate(seedEntry.justification, villain, victimCount, goal);
  const confrontation = fillTemplate(seedEntry.confrontation, villain, victimCount, goal);
  const closing = fillTemplate(seedEntry.closing, villain, victimCount, goal);

  const monologue = `${opening}\n\n${justification}\n\n${confrontation}\n\n${closing}`;

  const devices = RHETORICAL_DEVICES[philosophy.id] ?? RHETORICAL_DEVICES.utilitarianMartyr;
  const rhetoricalDevices = [...devices];

  const wordCount = countWords(monologue);

  // Die kälteste Zeile: der letzte Satz des Schlusses.
  const sentences = closing.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const chillingLine = sentences.length > 0 ? sentences[sentences.length - 1] : closing;

  return {
    philosophy: philosophy.name,
    monologue,
    rhetoricalDevices,
    wordCount,
    chillingLine,
  };
}

// ---------------------------------------------------------------------------
// 3) Verführungs-Regler
// ---------------------------------------------------------------------------

/**
 * Kalibriert die emotionale Verführung des Lesers durch den Antagonisten.
 *
 * Level 0 = kaltblütig abstoßend, 100 = tragischer herzzerreißender Antiheld.
 * Die Ton-Anleitung, Beispielzeile und Leser-Effekt werden je Level-Bereich
 * aus einem Pool gewählt.
 *
 * Defensiv: unbekannte Philosophie fällt auf 'utilitarianMartyr' zurück;
 * seductionLevel wird auf 0–100 geklemmt.
 */
export function calibrateSeduction(
  philosophyId: string,
  seductionLevel: number,
  seed: number,
): SeductionCalibration {
  const philosophy = resolvePhilosophy(philosophyId);
  const level = clamp(Math.round(seductionLevel), 0, 100);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;

  const rng = createSeededRandom(
    hashString(`${philosophy.id}#seduction#${level}#${seedValue}`),
  );

  // Passenden Ton-Bereich finden.
  let toneEntry = SEDUCTION_TONES[0];
  for (const entry of SEDUCTION_TONES) {
    if (level >= entry.min) {
      toneEntry = entry;
    }
  }

  // Beispielzeile aus dem passenden Bereich wählen.
  let sampleEntry = SEDUCTION_SAMPLE_LINES[0];
  for (const entry of SEDUCTION_SAMPLE_LINES) {
    if (level >= entry.min) {
      sampleEntry = entry;
    }
  }

  // Leichte Variation der Beispielzeile je Seed.
  const variation = pick(
    ['', ' Vielleicht.', ' Doch die Wahrheit ist komplizierter.', ' Und das tut weh.'],
    rng,
  );
  const sampleLine = sampleEntry.line + variation;

  return {
    level,
    label: toneEntry.label,
    toneGuidance: toneEntry.tone,
    sampleLine,
    readerEffect: toneEntry.readerEffect,
  };
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Beispiel-Antagonist für UI-Demos und Dokumentation. */
export function createSampleAntagonist(): AntagonistPhilosophy {
  return ANTAGONIST_PHILOSOPHIES[0];
}

/** Beispiel-Monolog für UI-Demos und Dokumentation. */
export function createSampleMonologue(): JustificationMonologue {
  return synthesizeJustificationMonologue(
    {
      philosophyId: 'utilitarianMartyr',
      villainName: 'Ozymandias',
      victimCount: 5000000,
      goal: 'den Weltfrieden',
    },
    42,
  );
}
