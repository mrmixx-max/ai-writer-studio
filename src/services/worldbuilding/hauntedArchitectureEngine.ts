// HauntedArchitectureEngine (WP 116.1, Meilenstein 56.0 / v6.8.0)
// Spukhaus-Architektur & Haus-als-Organismus für Gothic-Horror-Fiktion.
// Gotische Raumzonen, unheimliche Geometrie-Verschiebung, atmosphärische Verfalls-Prosa.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browser-kompatibel.

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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// WP 116.1 — 4 Gotische Raumzonen
// ---------------------------------------------------------------------------

export type HauntedZoneId = "crypt" | "ancestralGallery" | "attic" | "servantPassage";

export interface HauntedRoomZone {
  id: HauntedZoneId;
  name: string;
  description: string;
  /** Atmosphärische Grundstimmung der Zone. */
  atmosphere: string;
  /** Gefahrenstufe von 1 (harmlos) bis 10 (tödlich). */
  dangerLevel: number;
  /** Charakteristische Merkmale der Zone. */
  features: string[];
}

/** Die vier gotischen Raumzonen des Spukhauses. */
export const HAUNTED_ROOM_ZONES: readonly HauntedRoomZone[] = [
  {
    id: "crypt",
    name: "Modrige Krypta",
    description:
      "Unter dem Haus, tief im Erdreich, liegt die Krypta: ein Gewölbe aus feuchtem Bruchstein, in dem die Namen der Toten in den Stein gemeißelt wurden und der Moder den Atem schwer macht.",
    atmosphere:
      "Erstickende Enge und kalte, erdige Stille, in der jeder Schritt tausendfach widerhallt und jede Kerze im Zug der Gruft erlischt.",
    dangerLevel: 9,
    features: [
      "Reihen halb versunkener Steinsärge mit abgeplatzten Deckeln",
      "Namen, die jemand nachträglich aus dem Mauerwerk gekratzt hat",
      "Eine schmale Treppe nach oben, deren Stufen feucht glänzen",
      "Wasser, das von der Decke rinnt und in die offenen Gräber tropft",
      "Ein Altar aus schwarzem Marmor, der noch immer nach Weihrauch riecht",
    ],
  },
  {
    id: "ancestralGallery",
    name: "Zugige Ahnen-Galerie",
    description:
      "Ein langer Korridor im ersten Stock, gesäumt von den Ölporträts der Familie, deren gemalte Augen einem folgen und deren Münder sich bei Nacht zu bewegen scheinen.",
    atmosphere:
      "Eisige Zugluft, die aus keiner Öffnung kommt, und das Gefühl, dass die gemalten Vorfahren jedes Wort mit anhören.",
    dangerLevel: 6,
    features: [
      "Lebensgroße Ölporträts mit vergoldeten, blinden Rahmen",
      "Ein Läufer, dessen Muster sich unter den Füßen verändert",
      "Kerzenhalter, die von selbst niederbrennen, ohne Wärme abzugeben",
      "Ein Spiegel am Ende des Ganges, der den Flur länger zeigt, als er ist",
      "Türen zu Zimmern, die auf keinem Grundriss verzeichnet sind",
    ],
  },
  {
    id: "attic",
    name: "Verschlossener Dachboden der Familiengeheimnisse",
    description:
      "Unter dem Gebälk, hinter einer Tür, die seit Jahrzehnten niemand öffnen sollte, sammeln sich die verborgenen Dinge der Familie: verstaubte Koffer, verhüllte Möbel und Dinge, die niemand hiergelassen hat.",
    atmosphere:
      "Drückende, trockene Schwüle unter dem Dach, in der Staub in der Luft steht und das geringste Geräusch wie ein Schrei klingt.",
    dangerLevel: 8,
    features: [
      "Verhüllte Möbel, unter deren Tüchern sich Umrisse abzeichnen",
      "Ein Koffer voller Briefe, die nie abgeschickt wurden",
      "Ein Kinderbett, dessen Decke noch warm ist",
      "Balken, in die Namen und Daten eingeritzt sind",
      "Ein Fenster, das von innen vernagelt wurde",
    ],
  },
  {
    id: "servantPassage",
    name: "Labyrinthische Dienstboten-Gänge",
    description:
      "Schmale, hinter der Wand verlaufende Gänge, die einst dem Personal dienten und heute wie Adern das Haus durchziehen — enge Schächte, in denen man sich hoffnungslos verirren kann.",
    atmosphere:
      "Klaustrophobische Dunkelheit und das ständige Gefühl, beobachtet zu werden, während man sich durch Gänge tastet, die kein Ende nehmen wollen.",
    dangerLevel: 7,
    features: [
      "Klappen, die sich von beiden Seiten öffnen lassen",
      "Gänge, die enger werden, je weiter man vordringt",
      "Abgenutzte Klingelzüge, die noch immer schrillen können",
      "Schmale Sichtschlitze in die bewohnten Zimmer",
      "Eine Sackgasse, die am Vortag noch weiterführte",
    ],
  },
];

export function getHauntedZone(id: HauntedZoneId): HauntedRoomZone | undefined {
  return HAUNTED_ROOM_ZONES.find((z) => z.id === id);
}

// ---------------------------------------------------------------------------
// WP 116.1 — Unheimliche Geometrie-Verschiebung
// ---------------------------------------------------------------------------

export type AnomalySeverity = "low" | "medium" | "high" | "extreme";

export interface ArchitecturalAnomalyResult {
  anomalies: string[];
  severity: AnomalySeverity;
  description: string;
}

/** Katalog unheimlicher geometrischer Anomalien. */
const ANOMALY_TEMPLATES: string[] = [
  "Der Raum ist von innen volle 50 cm schmaler als von außen gemessen — die Wände haben sich gegen die Bewohner zusammengezogen.",
  "Eine Tür fällt von selbst zu, sobald man den Rücken kehrt, und ihr Schloss findet keinen Riegel mehr.",
  "Die Treppen verschieben sich zwischen zwei Besuchen, sodass die Stufen nicht mehr zu den Etagen passen wollen.",
  "Die Wände atmen — sie wölben sich langsam nach innen und wieder zurück, als hätte das Haus eine Lunge.",
  "Der Flur ist länger als das Gebäude, in dem er liegt; jeder Schritt fügt eine weitere Tür hinzu.",
  "Ein Fenster zeigt einen Hof, der seit Jahrzehnten nicht mehr existiert.",
  "Zwei Gänge kreuzen sich, obwohl der Grundriss dort keine Kreuzung kennt.",
  "Die Decke senkt sich unmerklich, bis man sich am Ende gebückt hindurchzwängen muss.",
  "Eine Zimmertür führt in dasselbe Zimmer, aus dem man gerade gekommen ist.",
  "Winkel, die zusammen ein rechter Winkel sein müssten, addieren sich zu etwas Größerem.",
  "Der Boden neigt sich gegen die Schwerkraft, sodass man bergauf zu wandern glaubt.",
  "Eine Wand steht dort, wo gestern noch eine Tür war, und trägt dieselbe Tapete.",
];

/** Ordnet einem numerischen Wert eine Anomalie-Stufe zu. */
function severityFromScore(score: number): AnomalySeverity {
  if (score >= 90) return "extreme";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function detectArchitecturalAnomalies(zoneId: string, seed: number): ArchitecturalAnomalyResult {
  const zone = getHauntedZone(zoneId as HauntedZoneId);
  const rng = createSeededRandom(hashString(`anomaly:${zoneId}:${seed}`));

  // Anzahl der Anomalien hängt von der Gefahrenstufe der Zone ab (mind. 2, max. 5).
  const danger = zone ? zone.dangerLevel : 5;
  const count = Math.max(2, Math.min(5, Math.round(danger / 2)));

  const anomalies: string[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (anomalies.length < count && guard < 200) {
    guard++;
    const idx = Math.floor(rng() * ANOMALY_TEMPLATES.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    anomalies.push(ANOMALY_TEMPLATES[idx]);
  }

  // Schweregrad: aus der Zonengefahr plus deterministischem Rauschen.
  const noise = Math.floor(rng() * 20);
  const score = Math.min(100, danger * 9 + noise);
  const severity = severityFromScore(score);

  const zoneName = zone ? zone.name : zoneId;
  const description = `In der ${zoneName} wurden ${anomalies.length} architektonische Anomalien registriert; die Schwere liegt bei "${severity}". Das Haus gehorcht nicht mehr dem Grundriss, den seine Erbauer ihm gaben.`;

  return { anomalies, severity, description };
}

// ---------------------------------------------------------------------------
// WP 116.1 — Atmosphärische Verfalls-Prosa
// ---------------------------------------------------------------------------

interface DecayFragment {
  /** Passt der Baustein thematisch zu dieser Zone? */
  zones: HauntedZoneId[] | "all";
  text: string;
}

/** Dichte Verfalls-Bausteine für gothic horror. */
const DECAY_FRAGMENTS: DecayFragment[] = [
  {
    zones: "all",
    text: "Abblätternde Damast-Tapeten hängen in Fetzen von den Wänden, und darunter kommt eine dunklere, feuchte Schicht zum Vorschein, die wie eine alte Wunde aussieht.",
  },
  {
    zones: "all",
    text: "Faule Dielen knarren unter jedem Schritt, und manche geben mit einem nassen Seufzen nach, als lägen sie über etwas, das nicht leer ist.",
  },
  {
    zones: "all",
    text: "Kalte Zugluft zieht aus den Kaminzügen, obwohl seit Jahren kein Feuer in ihnen gebrannt hat, und trägt den Geruch von Asche und Regen mit sich.",
  },
  {
    zones: "all",
    text: "Schatten bewegen sich am Rand des Blickfelds, immer nur dann, wenn man gerade nicht hinsieht.",
  },
  {
    zones: ["crypt"],
    text: "Von der Gewölbedecke rinnt Wasser in feinen Fäden herab und sammelt sich in den Vertiefungen der Steinplatten zu schwarzen Pfützen.",
  },
  {
    zones: ["crypt"],
    text: "Moos überzieht die eingemeißelten Namen, bis sie wie Fingerabdrücke aussehen, und der Moder legt sich schwer auf die Lungen.",
  },
  {
    zones: ["ancestralGallery"],
    text: "Der Teppichläufer ist an den Rändern ausgefranst, und das Muster scheint sich unter dem staubigen Licht in andere Formen zu winden.",
  },
  {
    zones: ["ancestralGallery"],
    text: "Staub liegt so dick auf den vergoldeten Rahmen der Porträts, dass die gemalten Gesichter dahinter zu atmen scheinen.",
  },
  {
    zones: ["attic"],
    text: "Ein erstickender Geruch nach Mottenkugeln und trockenem Holz hängt in der Luft, durchsetzt mit dem süßlichen Hauch von etwas Verwestem.",
  },
  {
    zones: ["attic"],
    text: "Spinnweben hängen in dichten Vorhängen von den Dachbalken, und in ihrem Gewebe zucken kleine Schatten, die keine Spinnen sind.",
  },
  {
    zones: ["servantPassage"],
    text: "Die engen Wände sind mit bröckelndem Kalk verputzt, und das Licht der Laterne erreicht kaum die nächste Biegung.",
  },
  {
    zones: ["servantPassage"],
    text: "Ein modriger Luftzug fährt durch die Gänge, als atme das Haus durch sie hindurch und zöge die Luft aus der Lunge des Eindringlings.",
  },
];

export function generateDecayProse(zoneId: string, seed: number): string {
  const zone = getHauntedZone(zoneId as HauntedZoneId);
  const rng = createSeededRandom(hashString(`decay:${zoneId}:${seed}`));

  const zoneIdTyped = zone ? zone.id : (zoneId as HauntedZoneId);
  const applicable = DECAY_FRAGMENTS.filter(
    (f) => f.zones === "all" || f.zones.includes(zoneIdTyped)
  );

  // 4 bis 6 Bausteine zu einem dichten Absatz verweben, ohne Wiederholung.
  const count = 4 + Math.floor(rng() * 3);
  const total = Math.min(count, applicable.length);

  const used: string[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (used.length < total && guard < 200) {
    guard++;
    const idx = Math.floor(rng() * applicable.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    used.push(applicable[idx].text);
  }

  const zoneName = zone ? zone.name : zoneId;
  const intro = `In der ${zoneName} hat der Verfall das Haus von innen ergriffen.`;
  return `${intro} ${used.join(" ")}`;
}

// ---------------------------------------------------------------------------
// Fabrik-Funktionen (Beispiele)
// ---------------------------------------------------------------------------

export function createSampleHauntedZone(): HauntedRoomZone {
  return HAUNTED_ROOM_ZONES[0];
}

export function createSampleAnomalies(): ArchitecturalAnomalyResult {
  return detectArchitecturalAnomalies("crypt", 42);
}
