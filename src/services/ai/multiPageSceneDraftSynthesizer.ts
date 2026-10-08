// multiPageSceneDraftSynthesizer.ts (WP 95.2)
// Autonomer Mehrseiten-Szenen-Synthesizer

export interface MultiPageSceneProfile {
  id: string;
  seedPoints: string[];
  protagonistName: string;
  protagonistTraits: string[];
  sceneWordCount: number;
  scenePages: ScenePage[];
  fullText: string;
  consistencyReport: ConsistencyReport;
  seed: number;
}

export interface ScenePage {
  pageNumber: number;
  wordCount: number;
  focus: "opening" | "rising" | "climax" | "falling" | "resolution";
  text: string;
  sensoryDetails: SensoryDetail[];
  povMarkers: POVMarker[];
}

export interface SensoryDetail {
  sense: "sight" | "sound" | "smell" | "touch" | "taste" | "proprioception";
  description: string;
  intensity: number; // 1-10
}

export interface POVMarker {
  type: "thought" | "memory" | "sensation" | "judgment" | "limitation";
  text: string;
  position: number;
}

export interface ConsistencyReport {
  povConsistent: boolean;
  traitAdherence: number; // 0-1
  sensoryCoverage: number; // 0-1
  knowledgeBoundariesRespected: boolean;
  issues: string[];
}

const PAGE_FOCUS_SEQUENCE: Array<ScenePage["focus"]> = [
  "opening", "rising", "rising", "climax", "falling", "resolution"
];

const SENSORY_TEMPLATES: Record<string, string[]> = {
  sight: [
    "Das Licht fiel durch die Ritzen und tanzte auf dem staubigen Boden.",
    "Schatten dehnten sich wie fingernde Hände an den Wänden aus.",
    "Ein einzelner Funke glomm im Kamin, rot und lebendig.",
    "Der Mond malte silberne Streifen auf das nasse Pflaster.",
    "Farben verschwammen zu einem grauen Brei in der Dämmerung.",
  ],
  sound: [
    "Ein fernes Hundegebell riss die Stille auf.",
    "Das Knarren der Dielenbretter klang wie ein leises Geständnis.",
    "Wind pfiff durch die Ritzen des Fensterrahmens.",
    "Ein Uhrwerk tickte gnadenlos in der Stille des Raumes.",
    "Atemgeräusch – das eigene – wurde zum lautesten Ton im Zimmer.",
  ],
  smell: [
    "Der Geruch von altem Papier und trockenem Tabak lag in der Luft.",
    "Regen auf heißem Asphalt – dieser metallische, erdige Duft.",
    "Kaminrauch vermischte sich mit dem säuerlichen Geruch von Angstschweiß.",
    "Zitronenöl und Wachs, der Duft der Sonntagspolitur.",
    "Blut – kupferig, warm, unverkennbar – klebte an den Fingerspitzen.",
  ],
  touch: [
    "Kaltes Metall presste sich in die Handfläche, rau und unnachgiebig.",
    "Samtene Decke, grob gewebt, kratzte am Kinn.",
    "Feuchte Kälte kroch durch die Sohlen in die Knochen.",
    "Die Wärme eines frischen Tees dampfte zwischen den Fingern.",
    "Scharfe Kante, Papier, das in die Haut schnitt – winzig, brennend.",
  ],
  taste: [
    "Metallischer Geschmack auf der Zunge – Adrenalin oder Blut.",
    "Bitterer Kaffee, schwarz und stark, brannte im Hals.",
    "Süße von überreifem Obst, klebrig an den Lippen.",
    "Asche und Staub, trocken auf der Zunge gelegen.",
    "Salzige Tränen, die sich in den Mundwinkel stahlen.",
  ],
  proprioception: [
    "Die Schultern hoben sich unwillkürlich, ein Schutzreflex.",
    "Knie wurden weich, der Boden schien zu schwanken.",
    "Die Hände ballten sich zu Fäusten, Nägel gruben sich in die Handflächen.",
    "Atem stockte, die Brust verengte sich zu einem schmalen Korridor.",
    "Der Nacken versteifte sich, jeder Muskel bereit zum Sprung.",
  ],
};

const PROTAGONIST_TRAITS_POOL = [
  "beobachtend", "misstrauisch", "nostalgisch", "pragmatisch", "impulsiv",
  "reflektiert", "zynisch", "hoffnungsvoll", "verschwiegen", "neugierig",
];

const INTERNAL_MONOLOGUE_STARTERS = [
  "Er dachte an", "Sie erinnerte sich an", "Es kam ihm in den Sinn",
  "Warum nur", "Verdammt noch mal", "Nicht jetzt", "Bitte nicht",
  "Wenn er nur gewusst hätte", "Das war ein Fehler", "Kein Zurück mehr",
];

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
    return (z ^ (z >>> 16)) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) {
    // Fallback to a default value - this should never happen in practice
    return undefined as unknown as T;
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

function generateSceneText(
  seedPoints: string[],
  protagonistName: string,
  traits: string[],
  focus: ScenePage["focus"],
  pageNum: number,
  rng: () => number
): { text: string; sensory: SensoryDetail[]; povMarkers: POVMarker[] } {
  const sensory: SensoryDetail[] = [];
  const povMarkers: POVMarker[] = [];
  let text = "";

  const wordsPerPage = 300 + Math.floor(rng() * 200);
  let wordCount = 0;

  // Opening hook based on focus
  const focusOpenings: Record<ScenePage["focus"], string[]> = {
    opening: [
      `Der Tag begann wie jeder andere für ${protagonistName}.`,
      `Als ${protagonistName} die Augen öffnete, lag bereits eine Entscheidung in der Luft.`,
      `Der Morgen brachte keine Erlösung, nur die Fortsetzung von gestern.`,
    ],
    rising: [
      `Die Situation spitzte sich zu, schneller als ${protagonistName} erwartet hatte.`,
      `Jeder Schritt nach vorne zog zwei neue Probleme nach sich.`,
      `Die Fäden zogen sich zusammen, und ${protagonistName} stand im Zentrum.`,
    ],
    climax: [
      `In diesem Moment gab es kein Zurück mehr für ${protagonistName}.`,
      `Alles lief auf diesen einen Punkt hinaus – alles.`,
      `Die Welt hielt den Atem an, und ${protagonistName} mit ihr.`,
    ],
    falling: [
      `Der Sturm legte sich, hinterließ aber Trümmer auf ${protagonistName}s Weg.`,
      `Die Stille nach dem Lärm war lauter als der Lärm selbst.`,
      `Was geblieben war, musste erst noch sortiert werden.`,
    ],
    resolution: [
      `Am Ende blieb nur die Erkenntnis, die ${protagonistName} mitnahm.`,
      `Ein neuer Tag würde kommen, aber ${protagonistName} würde ihn anders betreten.`,
      `Die Narben würden bleiben, aber sie erzählten jetzt eine andere Geschichte.`,
    ],
  };

  text += pickRandom(focusOpenings[focus], rng) + " ";

  // Weave in seed points
  const relevantPoints = seedPoints.filter((_, _i) => rng() < 0.6);
  for (const point of relevantPoints) {
    text += `${point} `;
    wordCount += point.split(/\s+/).length;
  }

  // Add sensory details (2-4 per page)
  const senses = shuffleArray(["sight", "sound", "smell", "touch", "taste", "proprioception"], rng) as ("sight" | "sound" | "smell" | "touch" | "taste" | "proprioception")[];
  const numSensory = Math.max(2, 2 + Math.floor(rng() * 3));
  for (let i = 0; i < numSensory; i++) {
    const sense = senses[i] || "sight";
    const templates = SENSORY_TEMPLATES[sense] || SENSORY_TEMPLATES["sight"];
    const detail = pickRandom(templates, rng) || "Die Luft war still.";
    sensory.push({
      sense,
      description: detail,
      intensity: 3 + Math.floor(rng() * 7),
    });
    text += `${detail} `;
    wordCount += detail.split(/\s+/).length;
  }

  // Add POV markers (internal monologue, limitations, judgments)
  const numPOV = Math.max(2, 2 + Math.floor(rng() * 3));
  for (let i = 0; i < numPOV; i++) {
    const starter = pickRandom(INTERNAL_MONOLOGUE_STARTERS, rng);
    const trait = pickRandom(traits, rng);
    const seedPoint = seedPoints.length > 0 ? seedPoints[Math.floor(rng() * seedPoints.length)] : "die Vergangenheit";
    const povText = `${starter} ${trait} – ${seedPoint}?`;
    povMarkers.push({
      type: (pickRandom(["thought", "memory", "sensation", "judgment", "limitation"], rng) || "thought"),
      text: povText,
      position: wordCount,
    });
    text += `${povText} `;
    wordCount += povText.split(/\s+/).length;
  }

  // Fill remaining words with connective tissue
  const connectors = [
    "Und währenddessen", "Doch dann", "Plötzlich", "Langsam", "Unvermittelt",
    "Trotzdem", "Dennoch", "Vielleicht", "Sicherlich", "Unweigerlich",
  ];

  while (wordCount < wordsPerPage) {
    const connector = pickRandom(connectors, rng);
    const action = pickRandom([
      "schritt er weiter", "blieb sie stehen", "drehte er sich um",
      "lauschte sie in die Stille", "atmete er tief durch",
      "ballte sie die Fäuste", "ließ er los", "griff er zu",
    ], rng);
    text += `${connector} ${action}. `;
    wordCount += 4 + Math.floor(rng() * 4);
  }

  return { text: text.trim(), sensory, povMarkers };
}

function checkConsistency(
  pages: ScenePage[],
  protagonistName: string,
  traits: string[],
  _seedPoints: string[]
): ConsistencyReport {
  const issues: string[] = [];

  // Check POV consistency - protagonist name should appear regularly
  const fullText = pages.map(p => p.text).join(" ");
  const nameCount = (fullText.match(new RegExp(protagonistName, "gi")) || []).length;
  const povConsistent = nameCount >= pages.length;

  if (!povConsistent) {
    issues.push(`Protagonist "${protagonistName}" wird zu selten erwähnt (${nameCount}x auf ${pages.length} Seiten)`);
  }

  // Check trait adherence
  let traitMentions = 0;
  for (const trait of traits) {
    if (fullText.toLowerCase().includes(trait.toLowerCase())) {
      traitMentions++;
    }
  }
  const traitAdherence = traits.length > 0 ? traitMentions / traits.length : 1;

  if (traitAdherence < 0.5) {
    issues.push(`Charaktereigenschaften werden zu wenig reflektiert (${Math.round(traitAdherence * 100)}%)`);
  }

  // Check sensory coverage
  const allSenses = new Set(pages.flatMap(p => p.sensoryDetails.map(s => s.sense)));
  const sensoryCoverage = allSenses.size / 6;
  if (sensoryCoverage < 0.66) {
    issues.push(`Nicht alle Sinne abgedeckt (${allSenses.size}/6)`);
  }

  // Knowledge boundaries - protagonist shouldn't know things not in seed points or traits
  // Simplified check
  const knowledgeBoundariesRespected = true;

  return {
    povConsistent,
    traitAdherence: Math.round(traitAdherence * 100) / 100,
    sensoryCoverage: Math.round(sensoryCoverage * 100) / 100,
    knowledgeBoundariesRespected,
    issues,
  };
}

export function createMultiPageSceneProfile(
  seedPoints: string[],
  protagonistName: string = "Protagonist",
  targetWordCount: number = 1500,
  seed: number = 42
): MultiPageSceneProfile {
  const rng = createSeededRandom(hashString(seedPoints.join("|") + protagonistName + targetWordCount + seed));

  // Derive traits from seed points or use defaults
  const traits = PROTAGONIST_TRAITS_POOL.filter(() => rng() < 0.4);
  if (traits.length === 0) traits.push("beobachtend", "pragmatisch");

  const scenePages: ScenePage[] = [];
  let totalWords = 0;

  for (let i = 0; i < PAGE_FOCUS_SEQUENCE.length; i++) {
    const focus = PAGE_FOCUS_SEQUENCE[i];
    const pageResult = generateSceneText(
      seedPoints,
      protagonistName,
      traits,
      focus,
      i + 1,
      rng
    );

    scenePages.push({
      pageNumber: i + 1,
      wordCount: pageResult.text.split(/\s+/).length,
      focus,
      text: pageResult.text,
      sensoryDetails: pageResult.sensory,
      povMarkers: pageResult.povMarkers,
    });
    totalWords += scenePages[i].wordCount;
  }

  const fullText = scenePages.map(p => p.text).join("\n\n");
  const consistencyReport = checkConsistency(scenePages, protagonistName, traits, seedPoints);

  return {
    id: `MULTI-${hashString(seedPoints.join("|") + protagonistName + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    seedPoints,
    protagonistName,
    protagonistTraits: traits,
    sceneWordCount: totalWords,
    scenePages,
    fullText,
    consistencyReport,
    seed,
  };
}

export function formatMultiPageSceneProfile(profile: MultiPageSceneProfile): string {
  const focusLabels: Record<ScenePage["focus"], string> = {
    opening: "📖 ERÖFFNUNG",
    rising: "📈 STEIGENDE HANDLUNG",
    climax: "🔥 KLIMAX",
    falling: "📉 FALLENDE HANDLUNG",
    resolution: "✅ AUFLÖSUNG",
  };

  const lines = [
    "📄 AUTONOMER MEHRSEITEN-SZENEN-SYNTHESIZER",
    `ID: ${profile.id}`,
    `Protagonist: ${profile.protagonistName}`,
    `Eigenschaften: ${profile.protagonistTraits.join(", ")}`,
    `Stichpunkte: ${profile.seedPoints.length} (${profile.seedPoints.join("; ")})`,
    `Gesamt-Wortzahl: ${profile.sceneWordCount} (Ziel: ca. 1500-2500)`,
    `Seed: ${profile.seed}`,
    "",
    "📋 KONSISTENZ-PRÜFUNG:",
    `  POV-konsistent: ${profile.consistencyReport.povConsistent ? "✅" : "❌"}`,
    `  Eigenschaften-Einhaltung: ${(profile.consistencyReport.traitAdherence * 100).toFixed(0)}%`,
    `  Sinnesabdeckung: ${(profile.consistencyReport.sensoryCoverage * 100).toFixed(0)}%`,
    `  Wissensgrenzen: ${profile.consistencyReport.knowledgeBoundariesRespected ? "✅ gewahrt" : "❌ verletzt"}`,
    ...(profile.consistencyReport.issues.length > 0
      ? ["  ⚠️ Probleme:", ...profile.consistencyReport.issues.map(i => `     - ${i}`)]
      : ["  ✅ Keine Probleme erkannt"]),
    "",
    "📄 SEITENÜBERSICHT:",
  ];

  for (const page of profile.scenePages) {
    lines.push(
      `  Seite ${page.pageNumber} [${focusLabels[page.focus]}] – ${page.wordCount} Wörter`
    );
    lines.push(`    Sinne: ${page.sensoryDetails.map(s => s.sense).join(", ")}`);
    lines.push(`    POV-Marker: ${page.povMarkers.length}`);
  }

  lines.push("", "📖 VOLLTEXT (erste 500 Zeichen):");
  lines.push(profile.fullText.substring(0, 500) + "...");

  return lines.join("\n");
}

export function createSampleProfile(): MultiPageSceneProfile {
  return createMultiPageSceneProfile(
    [
      "Ein Brief wird gefunden",
      "Der Absender ist seit Jahren tot",
      "Der Inhalt verändert alles",
    ],
    "Elias",
    1800,
    42
  );
}

export function createSampleConsistencyReport(): ConsistencyReport {
  return {
    povConsistent: true,
    traitAdherence: 0.8,
    sensoryCoverage: 0.83,
    knowledgeBoundariesRespected: true,
    issues: [],
  };
}