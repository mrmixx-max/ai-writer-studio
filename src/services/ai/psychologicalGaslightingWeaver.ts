// psychologicalGaslightingWeaver.ts (WP 131.1, Meilenstein 63.0 / v7.5.0)
//
// Gaslighting- & Manipulations-Dialog-Weber.
//
// Dieses Modul erzeugt Dialoge, in denen die gesprochene Oberfläche warm,
// fürsorglich und harmlos klingt, während der Subtext systematisch zerstört.
// Es modelliert vier klassische Taktiken psychologischer Manipulation und
// spannt daraus sowohl einzelne Wortwechsel als auch einen Verlauf über
// mehrere Szenen.
//
// Design-Regeln (analog subtextConflictInjector / polyphonicDialogueGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input + gleicher Seed → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Browser-kompatibel: keine node:-Module.
//
// Hinweis: Dieses Werkzeug dient ausschließlich der literarischen Darstellung
// manipulativer Kommunikationsmuster, nicht deren Anwendung.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine Taktik psychologischer Manipulation. */
export interface ManipulationTactic {
  /** Stabiler Bezeichner (englisch). */
  id: string;
  /** Menschenlesbarer Name. */
  name: string;
  /** Kurzbeschreibung der Funktionsweise. */
  description: string;
  /** Was die Taktik beim Opfer bewirken soll (Infinitivsatz). */
  targetEffect: string;
  /** Erkennbares Warnzeichen für die Umgebung. */
  warningSign: string;
}

/** Eingabe für den Subtext-Dialog-Generator. */
export interface ManipulativeDialogueInput {
  /** ID der Taktik (z. B. 'realityInversion'). */
  tacticId: string;
  /** Name der manipulierenden Figur. */
  manipulatorName: string;
  /** Name der manipulierten Figur. */
  victimName: string;
  /** Optionaler Kontext der Szene. */
  context?: string;
}

/** Ein einzelner Wortwechsel mit Oberfläche und Subtext. */
export interface DialogueExchange {
  /** Sprecher. */
  speaker: string;
  /** Gesprochener Text (Oberfläche, klingt fürsorglich). */
  line: string;
  /** Verborgene Bedeutung (giftiger Subtext). */
  subtext: string;
}

/** Ergebnis des Subtext-Dialog-Generators. */
export interface ManipulativeDialogue {
  /** Name der verwendeten Taktik. */
  tactic: string;
  /** Die Wortwechsel. */
  exchanges: DialogueExchange[];
  /** Zusammenfassung des Subtext-Musters. */
  subtextSummary: string;
  /** Eskalationsstufe (0–10). */
  escalationLevel: number;
}

/** Eingabe für den Manipulations-Verlauf. */
export interface ManipulationArcInput {
  /** ID der Taktik. */
  tacticId: string;
  /** Anzahl der Szenen (Default: 6, geklemmt auf 2–12). */
  sceneCount?: number;
}

/** Eine Szene im Manipulations-Verlauf. */
export interface ArcScene {
  /** Szenennummer (1-basiert). */
  sceneNumber: number;
  /** Selbstvertrauen des Opfers (0–100). */
  victimConfidence: number;
  /** Kontrolle des Manipulators (0–100). */
  manipulatorControl: number;
  /** Beschreibung der Szene. */
  description: string;
}

/** Ergebnis des Manipulations-Verlaufs. */
export interface ManipulationArc {
  /** Die Szenen. */
  scenes: ArcScene[];
  /** Szenennummer des Bruchpunkts. */
  breakingPoint: number;
  /** Erholungs-Empfehlung. */
  recoverySuggestion: string;
}

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
// Taktiken
// ---------------------------------------------------------------------------

/** Die vier Taktiken psychologischer Manipulation. */
export const MANIPULATION_TACTICS: readonly ManipulationTactic[] = [
  {
    id: 'realityInversion',
    name: 'Realitäts-Inversion (Gaslighting)',
    description:
      'Der Manipulator leugnet Ereignisse, verdreht Tatsachen und sät Zweifel an der Wahrnehmung des Opfers, bis dieses seiner eigenen Erinnerung misstraut.',
    targetEffect: 'das Vertrauen des Opfers in die eigene Wahrnehmung zu zerstören',
    warningSign:
      'Häufige Sätze wie „Das habe ich nie gesagt“ oder „Du bildest dir das ein“; das Opfer entschuldigt sich für Dinge, die nie geschahen.',
  },
  {
    id: 'loveBombingWithdrawal',
    name: 'Love-Bombing & Entzug',
    description:
      'Überwältigende Zuwendung wechselt ohne Vorwarnung mit Kälte und Rückzug. Die Nähe wird zur Belohnung, die der Manipulator jederzeit entziehen kann.',
    targetEffect: 'das Opfer durch den Wechsel von Nähe und Kälte emotional abhängig zu machen',
    warningSign:
      'Extreme Nähe kippt abrupt in Funkstille; das Opfer entschuldigt sich für nichtige Anlässe, um die warme Phase zurückzuholen.',
  },
  {
    id: 'darvo',
    name: 'Täter-Opfer-Umkehr (DARVO)',
    description:
      'Der Manipulator bestreitet die Tat, greift an und stilisiert sich selbst zum Opfer — wer ihn zur Rede stellt, wird kurzerhand zum Täter erklärt.',
    targetEffect: 'jede Anklage in Schuld umzukehren und das Opfer zum Täter zu erklären',
    warningSign:
      'Bei jeder Konfrontation wechselt die Rollenverteilung blitzschnell; am Ende entschuldigt sich das Opfer und tröstet den Angreifer.',
  },
  {
    id: 'triangulation',
    name: 'Triangulation',
    description:
      'Der Manipulator zieht eine dritte Person oder Instanz hinzu, um Vergleich, Eifersucht und Konkurrenz zu erzeugen und die Bindung zu destabilisieren.',
    targetEffect: 'das Opfer durch Vergleich und Eifersucht zu verunsichern und zu isolieren',
    warningSign:
      'Ständige Vergleiche („X hätte das verstanden“) und Andeutungen, das Opfer sei leicht zu ersetzen.',
  },
];

// ---------------------------------------------------------------------------
// Dialog-Bausteine je Taktik
// ---------------------------------------------------------------------------

/** Vorlage für einen Wortwechsel: Oberfläche + Subtext. */
interface ExchangeSeed {
  /** Gesprochener Text. */
  surface: string;
  /** Verborgene Bedeutung. */
  subtext: string;
}

/** Baustein-Pools je Taktik-ID. */
const EXCHANGE_POOLS: Record<
  string,
  { manipulator: readonly ExchangeSeed[]; victim: readonly ExchangeSeed[] }
> = {
  realityInversion: {
    manipulator: [
      {
        surface: 'Ich sage das nur, weil ich dich liebe, {victim}: So ist es nie gewesen.',
        subtext: 'Ich schreibe deine Vergangenheit neu, und du wirst mir glauben.',
      },
      {
        surface: 'Mach dir keine Sorgen, Schatz. In letzter Zeit verwechselst du einfach Dinge.',
        subtext: 'Deine Wahrnehmung ist defekt; ohne mich verlierst du die Wirklichkeit.',
      },
      {
        surface: 'Ich würde dich niemals anlügen. Vielleicht bist du nur erschöpft.',
        subtext: 'Dein Zweifel an dir selbst ist mein bestes Werkzeug.',
      },
      {
        surface: 'Ich mache mir Sorgen um dich. Dein Kopf spielt dir manchmal Streiche.',
        subtext: 'Ich bin die einzige Quelle der Wahrheit, die dir noch bleibt.',
      },
      {
        surface: 'Das habe ich nie gesagt — aber ich verzeihe dir, dass du es so gehört hast.',
        subtext: 'Selbst dein Gehör steht gegen dich, also gegen dich selbst.',
      },
    ],
    victim: [
      {
        surface: 'Vielleicht habe ich mich wirklich getäuscht.',
        subtext: 'Ich traue meinem eigenen Gedächtnis nicht mehr.',
      },
      {
        surface: 'Es tut mir leid, ich hätte besser zuhören sollen.',
        subtext: 'Ich entschuldige mich für etwas, das nie geschah.',
      },
      {
        surface: 'Ich weiß nicht mehr, was stimmt.',
        subtext: 'Der Boden unter meiner Wahrnehmung bröckelt.',
      },
    ],
  },
  loveBombingWithdrawal: {
    manipulator: [
      {
        surface: 'Du bedeutest mir alles, {victim}. Deshalb brauche ich gerade etwas Zeit für mich.',
        subtext: 'Nähe ist eine Belohnung, die ich dir jederzeit entziehen kann.',
      },
      {
        surface: 'Ich habe den ganzen Tag an dich gedacht. Warum machst du es mir nur so schwer?',
        subtext: 'Meine Zuwendung ist eine Schuld, die du abtragen musst.',
      },
      {
        surface: 'Ich bin so stolz auf dich — wenn du nur ein wenig mehr auf mich hören würdest.',
        subtext: 'Du bist nie genug, und das ist deine Aufgabe zu lösen.',
      },
      {
        surface: 'Komm her, ich halte dich. Später muss ich dann aber wirklich allein sein.',
        subtext: 'Ich dosiere die Wärme, damit du süchtig bleibst.',
      },
      {
        surface: 'Ich liebe dich so sehr, dass es mir Angst macht. Deshalb halte ich Abstand.',
        subtext: 'Mein Rückzug ist die Strafe, die dich gefügig macht.',
      },
    ],
    victim: [
      {
        surface: 'Ich verstehe, nimm dir die Zeit, die du brauchst.',
        subtext: 'Wenn ich nur lieb genug bin, kommt die Wärme zurück.',
      },
      {
        surface: 'War es etwas, das ich gesagt habe?',
        subtext: 'Ich suche den Fehler immer zuerst bei mir.',
      },
      {
        surface: 'Ich bin so froh, wenn wir wieder wie früher sind.',
        subtext: 'Ich klammere an die gute Phase und übersehe die Kälte.',
      },
    ],
  },
  darvo: {
    manipulator: [
      {
        surface: 'Ich verstehe, dass du wütend bist, {victim}. Aber jetzt bin ich diejenige, die leidet.',
        subtext: 'Dein Schmerz wird zu meiner Waffe gegen dich.',
      },
      {
        surface: 'Wie kannst du mir das antun, wo ich doch so viel für dich aufgegeben habe?',
        subtext: 'Ich erkläre dich zum Täter, damit deine Anklage verstummt.',
      },
      {
        surface: 'Ich wollte nur das Beste für uns. Dass du das nicht siehst, bricht mir das Herz.',
        subtext: 'Deine Wahrheit verletzt mich — also ist sie verboten.',
      },
      {
        surface: 'Bitte, beruhige dich. Du machst mir Angst, wenn du so bist.',
        subtext: 'Ich kehre die Rollen um, und du wirst mich trösten.',
      },
      {
        surface: 'Ich bin nicht wütend auf dich, ich bin nur so enttäuscht.',
        subtext: 'Enttäuschung ist meine sanfte Art, dich zu bestrafen.',
      },
    ],
    victim: [
      {
        surface: 'Es tut mir leid, ich wollte dich nicht verletzen.',
        subtext: 'Ich entschuldige mich dafür, dass ich verletzt wurde.',
      },
      {
        surface: 'Vielleicht habe ich überreagiert.',
        subtext: 'Ich mache mich selbst zum Angeklagten.',
      },
      {
        surface: 'Ich möchte nicht, dass du leidest.',
        subtext: 'Ich tröste den, der mir wehgetan hat.',
      },
    ],
  },
  triangulation: {
    manipulator: [
      {
        surface: 'Ich sage das nicht, um dich zu vergleichen, {victim} — aber X hätte das sofort verstanden.',
        subtext: 'Du bist austauschbar; kämpfe um deinen Platz.',
      },
      {
        surface: 'Alle finden, dass du dich verändert hast. Ich verteidige dich ja.',
        subtext: 'Ich spreche durch andere, damit du niemandem mehr traust.',
      },
      {
        surface: 'Ich verbringe Zeit mit ihr, weil sie mich versteht. Du solltest ihr dankbar sein.',
        subtext: 'Deine Eifersucht ist das Feuer, das ich schüre.',
      },
      {
        surface: 'Du bist etwas ganz Besonderes — das sagen übrigens viele.',
        subtext: 'Viele beobachten dich, und ich bestimme, was sie sehen.',
      },
      {
        surface: 'Ich erzähle dir nur, was er über dich gesagt hat, damit du es weißt.',
        subtext: 'Ich stelle mich zwischen euch, wo kein Platz ist.',
      },
    ],
    victim: [
      {
        surface: 'Was hat sie, das ich nicht habe?',
        subtext: 'Ich fühle mich austauschbar.',
      },
      {
        surface: 'Ich versuche doch nur, dir zu gefallen.',
        subtext: 'Ich kämpfe um einen Platz, den ich nie besitze.',
      },
      {
        surface: 'Ich weiß nicht, wem ich noch glauben kann.',
        subtext: 'Selbst meine Verbündeten werden zu Richtern.',
      },
    ],
  },
};

/** Grund-Eskalation je Taktik (0–10). */
const TACTIC_BASE_ESCALATION: Record<string, number> = {
  realityInversion: 6,
  loveBombingWithdrawal: 5,
  darvo: 7,
  triangulation: 6,
};

// ---------------------------------------------------------------------------
// Verlaufs-Bausteine
// ---------------------------------------------------------------------------

/** Phasen eines Manipulations-Verlaufs. */
const ARC_PHASES: readonly string[] = [
  'Annäherung',
  'Verunsicherung',
  'Bindung',
  'Kontrolle',
  'Isolation',
  'Erschöpfung',
  'Bruchpunkt',
];

/** Beschreibung je Phase. */
const ARC_PHASE_DESCRIPTIONS: readonly string[] = [
  'Überwältigende Aufmerksamkeit und Komplimente legen den Grundstein für Vertrauen.',
  'Erste Zweifel werden gesät; kleine Widersprüche nagen am Selbstbild des Opfers.',
  'Das Opfer sucht die Nähe, die es einmal kannte, und beginnt, sich anzupassen.',
  'Der Manipulator bestimmt zunehmend, was das Opfer denken, fühlen und sagen darf.',
  'Das soziale Umfeld wird verdächtig; Verbündete werden zu Verrätern erklärt.',
  'Das Opfer ist ausgelaugt, schuldbeladen und kaum noch fähig, sich zu wehren.',
  'Die Wahrnehmung kippt; das Opfer durchschaut die Dynamik — oder bricht zusammen.',
];

/** Erholungs-Empfehlung je Taktik. */
const RECOVERY_SUGGESTIONS: Record<string, string> = {
  realityInversion:
    'Vertraute Aufzeichnungen (Tagebuch, Nachrichten, Notizen) als Anker nutzen und die eigene Wahrnehmung durch unabhängige Zeugen bestätigen lassen.',
  loveBombingWithdrawal:
    'Die warmen und kalten Phasen schriftlich festhalten, Nähe nicht länger durch Anpassung erkaufen und ein eigenes, stabiles Umfeld aufbauen.',
  darvo:
    'Bei Konfrontationen sachlich bleiben, Verantwortung klar benennen und sich nicht in die Opferrolle drängen lassen; Rollenwechsel dokumentieren.',
  triangulation:
    'Vergleiche als Manipulationsmittel erkennen, sich nicht in Konkurrenz drängen lassen und die Beziehung direkt statt über Dritte klären.',
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Taktik defensiv auflösen; unbekannte ID fällt auf die erste Taktik zurück. */
function resolveTactic(tacticId: unknown): ManipulationTactic {
  if (typeof tacticId === 'string') {
    const found = MANIPULATION_TACTICS.find((t) => t.id === tacticId);
    if (found) return found;
  }
  return MANIPULATION_TACTICS[0];
}

/** Namen defensiv normalisieren. */
function normalizeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Platzhalter in einer Vorlage ersetzen. */
function fillTemplate(template: string, manipulator: string, victim: string, context: string): string {
  return template
    .replace(/\{manipulator\}/g, manipulator)
    .replace(/\{victim\}/g, victim)
    .replace(/\{context\}/g, context);
}

// ---------------------------------------------------------------------------
// 1) Subtext-Dialog-Generator
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen manipulativen Dialog.
 *
 * Die Oberfläche klingt warm und fürsorglich; der Subtext jeder Zeile ist
 * giftig. Die Wortwechsel wechseln sich zwischen Manipulator und Opfer ab.
 *
 * Defensiv: unbekannte Taktik fällt auf 'realityInversion' zurück; leere Namen
 * werden durch neutrale Bezeichnungen ersetzt.
 */
export function weaveManipulativeDialogue(
  input: ManipulativeDialogueInput,
  seed: number,
): ManipulativeDialogue {
  const tactic = resolveTactic(input?.tacticId);
  const manipulator = normalizeName(input?.manipulatorName, 'Manipulator');
  const victim = normalizeName(input?.victimName, 'Opfer');
  const context = typeof input?.context === 'string' ? input.context.trim() : '';
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;

  const rng = createSeededRandom(
    hashString(`${tactic.id}#${manipulator}#${victim}#${context}#${seedValue}`),
  );

  const pool = EXCHANGE_POOLS[tactic.id] ?? EXCHANGE_POOLS.realityInversion;
  const count = Math.max(6, 6 + Math.floor(rng() * 4));

  const exchanges: DialogueExchange[] = [];
  for (let i = 0; i < count; i++) {
    const isManipulator = i % 2 === 0;
    const template = isManipulator ? pick(pool.manipulator, rng) : pick(pool.victim, rng);
    exchanges.push({
      speaker: isManipulator ? manipulator : victim,
      line: fillTemplate(template.surface, manipulator, victim, context),
      subtext: fillTemplate(template.subtext, manipulator, victim, context),
    });
  }

  const base = TACTIC_BASE_ESCALATION[tactic.id] ?? 5;
  const escalationLevel = clamp(Math.round(base + count * 0.3 + rng() * 1.5), 0, 10);

  const contextNote = context.length > 0 ? ` im Kontext „${context}“` : '';
  const subtextSummary =
    `${tactic.name} — über ${exchanges.length} Wortwechsel${contextNote} klingen die Sätze von ` +
    `${manipulator} warm und besorgt, doch der Subtext arbeitet unablässig daran, ${tactic.targetEffect}.`;

  return {
    tactic: tactic.name,
    exchanges,
    subtextSummary,
    escalationLevel,
  };
}

// ---------------------------------------------------------------------------
// 2) Manipulations-Verlauf über Szenen
// ---------------------------------------------------------------------------

/**
 * Erzeugt den Verlauf einer manipulativen Beziehung über mehrere Szenen.
 *
 * Während das Selbstvertrauen des Opfers sinkt, wächst die Kontrolle des
 * Manipulators. Der Bruchpunkt markiert die erste Szene, in der das
 * Selbstvertrauen kritisch einbricht (≤ 30); andernfalls die Szene mit dem
 * geringsten Selbstvertrauen.
 *
 * Defensiv: unbekannte Taktik fällt zurück; sceneCount wird auf 2–12 geklemmt.
 */
export function buildManipulationArc(input: ManipulationArcInput, seed: number): ManipulationArc {
  const tactic = resolveTactic(input?.tacticId);
  const requested = Number.isFinite(input?.sceneCount) ? Math.floor(input!.sceneCount as number) : 6;
  const sceneCount = clamp(requested, 2, 12);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;

  const rng = createSeededRandom(hashString(`${tactic.id}#arc#${sceneCount}#${seedValue}`));

  let confidence = 88 + Math.floor(rng() * 8);
  let control = 18 + Math.floor(rng() * 12);

  const scenes: ArcScene[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const progress = sceneCount > 1 ? i / (sceneCount - 1) : 0;

    if (i > 0) {
      const confDrop = 5 + Math.floor(rng() * 8) + Math.floor(progress * 8);
      const ctrlGain = 6 + Math.floor(rng() * 8) + Math.floor(progress * 8);
      confidence = clamp(confidence - confDrop, 2, 100);
      control = clamp(control + ctrlGain, 0, 98);
    }

    const phaseIndex = clamp(Math.floor(progress * ARC_PHASES.length), 0, ARC_PHASES.length - 1);
    const phase = ARC_PHASES[phaseIndex];
    const phaseDescription = ARC_PHASE_DESCRIPTIONS[phaseIndex];
    const description = `${phase}: ${phaseDescription}`;

    scenes.push({
      sceneNumber: i + 1,
      victimConfidence: confidence,
      manipulatorControl: control,
      description,
    });
  }

  const critical = scenes.find((s) => s.victimConfidence <= 30);
  const lowest = scenes.reduce((min, s) => (s.victimConfidence < min.victimConfidence ? s : min), scenes[0]);
  const breakingPoint = (critical ?? lowest).sceneNumber;

  const recoverySuggestion =
    RECOVERY_SUGGESTIONS[tactic.id] ??
    'Abstand gewinnen, die Dynamik dokumentieren und Unterstützung im eigenen Umfeld suchen.';

  return {
    scenes,
    breakingPoint,
    recoverySuggestion,
  };
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Beispiel-Dialog für UI-Demos und Dokumentation. */
export function createSampleDialogue(): ManipulativeDialogue {
  return weaveManipulativeDialogue(
    {
      tacticId: 'realityInversion',
      manipulatorName: 'Marlene',
      victimName: 'Jonas',
      context: 'ein gemeinsames Abendessen',
    },
    42,
  );
}

/** Beispiel-Verlauf für UI-Demos und Dokumentation. */
export function createSampleArc(): ManipulationArc {
  return buildManipulationArc({ tacticId: 'loveBombingWithdrawal', sceneCount: 6 }, 42);
}
