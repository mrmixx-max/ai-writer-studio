// epistolaryUnreliableSynthesizer.ts (WP 96.1)
// Unzuverlässiger Briefroman- & Tagebuch-Synthesizer

export interface EpistolaryUnreliableProfile {
  id: string;
  documentType: "fieldJournal" | "diplomaticLetter" | "interrogationProtocol" | "finalConfession";
  authorName: string;
  recipientName: string;
  entries: EpistolaryEntry[];
  epistemichIronyMarkers: EpistemicIronyMarker[];
  seed: number;
}

export interface EpistolaryEntry {
  date: string;
  text: string;
  reliabilityScore: number; // 0-1, how trustworthy the entry appears
  hiddenTruthHints: string[]; // what the reader can infer between the lines
}

export interface EpistemicIronyMarker {
  entryIndex: number;
  claimedStatement: string;
  contradictingDetail: string;
  ironyType: "wishfulThinking" | "selfDeception" | "manipulation" | "unreliableMemory";
  subtlety: number; // 0-1, how obvious the contradiction is
}

const DOCUMENT_ARCHETYPES = {
  fieldJournal: {
    salutations: ["Eintrag", "Tagebuch", "Logbuch", "Aufzeichnung"],
    closings: ["Ende der Aufzeichnung", "Fortsetzung folgt", "Signal schwächer", "Batterie leer"],
    toneMarkers: ["paranoid", "deteriorating", "obsessive", "hallucinatory"],
  },
  diplomaticLetter: {
    salutations: ["Hochverehrter", "Sehr geehrter", "Mein lieber", "An den Herrn"],
    closings: ["In vorzüglicher Hochachtung", "Ihr ergebener Diener", "Mit diplomatischem Gruß", "Auf weitere Zusammenarbeit"],
    toneMarkers: ["calculated", "veiled_threats", "flattering", "condescending"],
  },
  interrogationProtocol: {
    salutations: ["Protokoll", "Vernehmung", "Aussage", "Befragung"],
    closings: ["Unterschrift folgt", "Ende der Vernehmung", "Zur Akte genommen", "Weiteres Vorgehen unklar"],
    toneMarkers: ["evasive", "selective", "defensive", "rehearsed"],
  },
  finalConfession: {
    salutations: ["Letzter Brief", "Abschied", "Mein Vermächtnis", "Wenn du das liest"],
    closings: ["Verzeih mir", "In Liebe", "Ohne Reue", "Für immer Dein"],
    toneMarkers: ["desperate", "justifying", "raw", "resigned"],
  },
};

const IRONY_TEMPLATES: Record<string, Array<{ claim: string; contradiction: string }>> = {
  wishfulThinking: [
    { claim: "Alles wird gut", contradiction: "Die Risse in der Wand werden breiter" },
    { claim: "Er liebt mich noch", contradiction: "Sein Weddingring liegt seit Wochen im Schrank" },
    { claim: "Ich habe die Kontrolle", contradiction: "Meine Hände zittern beim Schreiben" },
  ],
  selfDeception: [
    { claim: "Ich tue das für uns beide", contradiction: "Du hast nie darum gebeten" },
    { claim: "Es war Notwehr", contradiction: "Der Dolch lag bereits in meiner Hand" },
    { claim: "Ich bin ein guter Mensch", contradiction: "Die Leichen im Keller sagen etwas anderes" },
  ],
  manipulation: [
    { claim: "Vertrau mir blind", contradiction: "Meine Finger kreuzen sich hinter dem Rücken" },
    { claim: "Dein Wohl liegt mir am Herzen", contradiction: "Die Police läuft auf meinen Namen" },
    { claim: "Ich würde dich nie verletzen", contradiction: "Die Narben an deinen Handgelenken passen zu meinen Handschellen" },
  ],
  unreliableMemory: [
    { claim: "Es war ein sonniger Tag", contradiction: "Die Wetteraufzeichnungen zeigen Sturmflut" },
    { claim: "Ich war nicht dort", contradiction: "Dein Blut klebt an meinem Manschettenknopf" },
    { claim: "Wir haben nie darüber gesprochen", contradiction: "Deine Handschrift in meinem Tagebuch beweist das Gegenteil" },
  ],
};

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) {
    throw new Error("Cannot pick random from empty array");
  }
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateFieldJournalEntry(rng: () => number, entryNum: number, hiddenTruth: string): EpistolaryEntry {
  const paranoiaLevel = Math.min(0.3 + entryNum * 0.15 + rng() * 0.2, 0.95);
  const fragments = [
    "Die Stimmen werden lauter",
    "Sie beobachten mich durch die Lüftung",
    "Das Wasser schmeckt nach Kupfer",
    "Meine Erinnerungen lösen sich auf",
    "Der Schatten an der Tür hat keinen Besitzer",
    "Ich habe die Tage nicht mehr gezählt",
    "Mein Spiegelbild blinzelt nicht mit",
  ];
  const selected = shuffleArray(fragments, rng).slice(0, 2 + Math.floor(rng() * 3));
  const text = `${DOCUMENT_ARCHETYPES.fieldJournal.salutations[entryNum % 4]} ${entryNum + 1}: ${selected.join(". ")}. ${DOCUMENT_ARCHETYPES.fieldJournal.closings[entryNum % 4]}.`;
  return {
    date: `Tag ${entryNum + 1}`,
    text,
    reliabilityScore: 1 - paranoiaLevel,
    hiddenTruthHints: [hiddenTruth, `Paranoia-Level: ${Math.round(paranoiaLevel * 100)}%`],
  };
}

function generateDiplomaticLetterEntry(rng: () => number, entryNum: number, hiddenTruth: string): EpistolaryEntry {
  const manipulationLevel = 0.4 + rng() * 0.4;
  const pleasantries = [
    "Ich hoffe, diese Zeilen finden Sie bei bester Gesundheit",
    "Ihr letzter Brief war ein Lichtblick in trüben Zeiten",
    "Die Verhandlungen verlaufen nach Plan",
    "Ihre Großzügigkeit ehrt mich zutiefst",
    "Möge unser Bündnis ewig währen",
  ];
  const veiledThreats = [
    "Sollten sich die Umstände ändern, wäre ich zu bedauern gezwungen",
    "Ich vertraue auf Ihre Weisheit, die richtigen Schlüsse zu ziehen",
    "Manche Geheimnisse sind schwerer als Gold",
    "Die alternative Option wäre... unangenehm für alle Beteiligten",
  ];
  const salutations = DOCUMENT_ARCHETYPES.diplomaticLetter.salutations;
  const closings = DOCUMENT_ARCHETYPES.diplomaticLetter.closings;
  const selectedPleasantries = shuffleArray(pleasantries, rng).slice(0, 2);
  const selectedThreats = shuffleArray(veiledThreats, rng).slice(0, 1);
  const salutation = salutations[Math.floor(rng() * salutations.length)];
  const closing = closings[Math.floor(rng() * closings.length)];
  const text = `${salutation} ${["Kollege", "Partner", "Freund", "Gegner"][entryNum % 4]},\n\n${selectedPleasantries.join(" ")} ${selectedThreats.join(" ")}.\n\n${closing}`;
  return {
    date: `Schreiben ${entryNum + 1}`,
    text,
    reliabilityScore: 1 - manipulationLevel,
    hiddenTruthHints: [hiddenTruth, `Manipulations-Index: ${Math.round(manipulationLevel * 100)}%`],
  };
}

function generateInterrogationEntry(rng: () => number, entryNum: number, hiddenTruth: string): EpistolaryEntry {
  const evasionLevel = 0.3 + rng() * 0.5;
  const evasions = [
    "Ich erinnere mich nicht an diesen genauen Zeitpunkt",
    "Meine Erinnerung ist lückenhaft aufgrund der Umstände",
    "Das liegt außerhalb meines Verantwortungsbereichs",
    "Ich wurde angewiesen, diese Frage nicht zu beantworten",
    "Könnten Sie die Frage präzisieren? Der Begriff ist mehrdeutig",
    "Zu diesem Zeitpunkt war ich... anderswo beschäftigt",
  ];
  const selected = shuffleArray(evasions, rng).slice(0, 2 + Math.floor(rng() * 2));
    const text = `${DOCUMENT_ARCHETYPES.interrogationProtocol.salutations[entryNum % 4]} Nr. ${entryNum + 1}\n\nFragesteller: "Wo waren Sie in der Nacht vom 12. auf den 13.?"\nAussage: ${selected.join(" ")}.\n\n${pickRandom(DOCUMENT_ARCHETYPES.interrogationProtocol.closings, rng)}`;
  return {
    date: `Vernehmung ${entryNum + 1}`,
    text,
    reliabilityScore: 1 - evasionLevel,
    hiddenTruthHints: [hiddenTruth, `Ausweich-Quote: ${Math.round(evasionLevel * 100)}%`],
  };
}

function generateConfessionEntry(rng: () => number, entryNum: number, hiddenTruth: string): EpistolaryEntry {
  const rawness = 0.5 + rng() * 0.4;
  const confessions = [
    "Ich habe gelogen, jedes Mal, wenn ich sagte, es geht mir gut",
    "Du warst das Einzige, was echt war in diesem Theater",
    "Meine Taten haben mich zu dem gemacht, was ich jetzt bin: nichts",
    "Verzeih mir nicht. Ich verzeihe mir selbst nicht",
    "Die Wahrheit ist: Ich war feige, als es darauf ankam",
    "Ich nehme alles mit ins Grab, außer dieser einen Schuld",
  ];
  const selected = shuffleArray(confessions, rng).slice(0, 1 + Math.floor(rng() * 2));
  const text = `${pickRandom(DOCUMENT_ARCHETYPES.finalConfession.salutations, rng)},\n\n${selected.join(" ")}\n\n${pickRandom(DOCUMENT_ARCHETYPES.finalConfession.closings, rng)}`;
  return {
    date: `Abschiedsbrief ${entryNum + 1}`,
    text,
    reliabilityScore: rawness,
    hiddenTruthHints: [hiddenTruth, `Rohheits-Grad: ${Math.round(rawness * 100)}%`],
  };
}

function generateIronyMarkers(entries: EpistolaryEntry[], rng: () => number): EpistemicIronyMarker[] {
  const markers: EpistemicIronyMarker[] = [];
  const ironyTypes = ["wishfulThinking", "selfDeception", "manipulation", "unreliableMemory"] as const;
  const numMarkers = 2 + Math.floor(rng() * 3);

  for (let i = 0; i < numMarkers && i < entries.length; i++) {
    const ironyType = pickRandom(ironyTypes, rng);
    const templates = IRONY_TEMPLATES[ironyType];
    if (!templates || templates.length === 0) continue;
    const template = pickRandom(templates, rng);
    if (!template) continue;
    markers.push({
      entryIndex: i,
      claimedStatement: template.claim,
      contradictingDetail: template.contradiction,
      ironyType,
      subtlety: 0.2 + rng() * 0.6,
    });
  }
  return markers;
}

export function createEpistolaryUnreliableProfile(
  documentType: "fieldJournal" | "diplomaticLetter" | "interrogationProtocol" | "finalConfession" = "fieldJournal",
  authorName: string = "Unbekannt",
  recipientName: string = "An wen es angeht",
  hiddenTruth: string = "Die Wahrheit liegt zwischen den Zeilen verborgen",
  seed: number = 42
): EpistolaryUnreliableProfile {
  const rng = createSeededRandom(hashString(documentType + authorName + recipientName + hiddenTruth + seed));
  const entries: EpistolaryEntry[] = [];
  const numEntries = 3 + Math.floor(rng() * 4);

  for (let i = 0; i < numEntries; i++) {
    switch (documentType) {
      case "fieldJournal":
        entries.push(generateFieldJournalEntry(rng, i, hiddenTruth));
        break;
      case "diplomaticLetter":
        entries.push(generateDiplomaticLetterEntry(rng, i, hiddenTruth));
        break;
      case "interrogationProtocol":
        entries.push(generateInterrogationEntry(rng, i, hiddenTruth));
        break;
      case "finalConfession":
        entries.push(generateConfessionEntry(rng, i, hiddenTruth));
        break;
    }
  }

  const epistemichIronyMarkers = generateIronyMarkers(entries, rng);

  return {
    id: `EPIST-${hashString(documentType + authorName + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    documentType,
    authorName,
    recipientName,
    entries,
    epistemichIronyMarkers,
    seed,
  };
}

export function formatEpistolaryUnreliableProfile(profile: EpistolaryUnreliableProfile): string {
  const lines = [
    `═══ UNZUVERLÄSSIGES DOKUMENT ═══`,
    `ID: ${profile.id}`,
    `Typ: ${profile.documentType}`,
    `Autor: ${profile.authorName}`,
    `Empfänger: ${profile.recipientName}`,
    `Seed: ${profile.seed}`,
    `═══ EINTRÄGE ═══`,
  ];

  for (const entry of profile.entries) {
    lines.push(`\n--- ${entry.date} (Zuverlässigkeit: ${Math.round(entry.reliabilityScore * 100)}%) ---`);
    lines.push(entry.text);
    lines.push(`[Verborgene Hinweise: ${entry.hiddenTruthHints.join("; ")}]`);
  }

  lines.push(`\n═══ EPISTEMISCHE IRONIE-MARKER ═══`);
  for (const marker of profile.epistemichIronyMarkers) {
    lines.push(`Eintrag ${marker.entryIndex + 1} [${marker.ironyType}] (Subtilität: ${Math.round(marker.subtlety * 100)}%):`);
    lines.push(`  Behauptung: "${marker.claimedStatement}"`);
    lines.push(`  Widerspruch: "${marker.contradictingDetail}"`);
  }

  return lines.join("\n");
}

export function createSampleProfile(): EpistolaryUnreliableProfile {
  return createEpistolaryUnreliableProfile(
    "fieldJournal",
    "Dr. Viktor Halsh",
    "Zukünftiges Ich",
    "Das Experiment ist außer Kontrolle geraten. Subjekt 7 ist entkommen.",
    12345
  );
}

export function createSampleIronyMarkers(): EpistemicIronyMarker[] {
  return [
    {
      entryIndex: 0,
      claimedStatement: "Ich habe alles unter Kontrolle",
      contradictingDetail: "Die Notfallcodes sind verbrannt",
      ironyType: "selfDeception",
      subtlety: 0.7,
    },
    {
      entryIndex: 2,
      claimedStatement: "Er vertraut mir blind",
      contradictingDetail: "Sein Testament schließt mich aus",
      ironyType: "manipulation",
      subtlety: 0.4,
    },
  ];
}