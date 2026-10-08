// QuantumNarrativeConvergence (WP 120.1, Meilenstein 58.0, v7.0.0)
//
// Multi-POV-Konvergenz- und Showdown-Orchestrator für epische Erzählungen.
// Führt bis zu acht parallele Handlungsstränge zu einem synchronen
// Showdown-Raster zusammen, erzeugt flüssige Perspektiv-Übergaben und
// prüft die Kausalitäts-Kaskade über die gesamte Zeitleiste.
//
// Drei deterministische Werkzeuge:
//
//   1. createSyncGrid           — 8-Stränge-Synchronraster + Konflikte
//   2. generateHandoffSequence  — flüssige Perspektiv-Übergabe (Schnittkette)
//   3. checkCausality           — Kausalitäts-Kaskade (Anomalien, Widersprüche)
//
// Design-Regeln (analog omniverseNarrativeArchitect / plotTwistSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input + gleicher Seed → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed (unsigned 32-bit). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
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

/** Deterministische Auswahl aus einem Array. Wirft bei leerem Array. */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Anzahl paralleler Stränge im Synchronraster. */
export const SYNC_GRID_SIZE = 8;

/** Zustand einer Figur auf dem Synchronraster. */
export interface CharacterState {
  /** Eindeutige ID. */
  id: string;
  /** Anzeigename. */
  name: string;
  /** Rolle im Showdown (z. B. "Protagonist", "Antagonist"). */
  role: string;
  /** Position im Konvergenzraum. */
  position: { x: number; y: number };
  /** Handlungsziel zur Showdown-Zeit. */
  goal: string;
  /** Spannung 0–1. */
  tension: number;
}

/** Ergebnis der Raster-Synchronisation. */
export interface SyncGridResult {
  /** Die Stränge in räumlicher Reihenfolge (deterministisch sortiert). */
  grid: CharacterState[];
  /** Harte Konflikte (blockierend). */
  conflicts: string[];
  /** Weiche Warnungen (hinweisend). */
  warnings: string[];
}

/** Ein einzelner Perspektiv-Übergang. */
export interface HandoffTransition {
  /** ID der abgebenden Figur. */
  from: string;
  /** ID der übernehmenden Figur. */
  to: string;
  /** Die Übergabe-Formulierung (Schnitt-Anweisung). */
  cue: string;
}

/** Ergebnis der Perspektiv-Übergabe. */
export interface HandoffSequence {
  /** Die Beat-Segmente in Reihenfolge (je Strang ein Schnitt). */
  sequence: string[];
  /** Die paarweisen Übergänge zwischen aufeinanderfolgenden Strängen. */
  transitions: HandoffTransition[];
}

/** Ein Zeitleisten-Ereignis für die Kausalitätsprüfung. */
export interface TimelineEvent {
  /** Figur, die handelt. */
  characterId: string;
  /** Die Handlung. */
  action: string;
  /** Zeitstempel (aufsteigende Einheit). */
  timestamp: number;
}

/** Ergebnis der Kausalitäts-Kaskade. */
export interface CausalityResult {
  /** Harte Verstöße (blockierend). */
  violations: string[];
  /** Weiche Warnungen (hinweisend). */
  warnings: string[];
  /** Zeit-Anomalien (unmögliche Ordnungen). */
  anomalies: string[];
}

// ---------------------------------------------------------------------------
// 1) 8-Stränge-Synchronraster
// ---------------------------------------------------------------------------

/** Sortiert Stränge deterministisch nach y, dann x, dann id. */
function sortByStrand(characters: CharacterState[]): CharacterState[] {
  return [...characters].sort((a, b) => {
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    if (ay !== by) return ay - by;
    const ax = a.position?.x ?? 0;
    const bx = b.position?.x ?? 0;
    if (ax !== bx) return ax - bx;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Ordnet die Stränge in das 8-Slot-Synchronraster ein und meldet Konflikte.
 *
 * Konflikte: doppelte IDs, kollidierende Positionen (zwei Figuren am selben
 * Punkt zur Showdown-Zeit). Warnungen: leere Ziele/Rollen, Spannung außerhalb
 * von 0–1, Raster unter- oder überbelegt.
 *
 * Defensiv: ungültige Eingaben werden zu einem leeren Raster.
 */
export function createSyncGrid(characters: CharacterState[]): SyncGridResult {
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const safe = Array.isArray(characters) ? characters.filter((c) => c && typeof c.id === "string") : [];

  if (safe.length > SYNC_GRID_SIZE) {
    warnings.push(
      `${safe.length} Stränge überschreiten das ${SYNC_GRID_SIZE}-Slot-Raster — Stränge bündeln oder Raster erweitern.`,
    );
  } else if (safe.length < SYNC_GRID_SIZE) {
    warnings.push(
      `Nur ${safe.length} von ${SYNC_GRID_SIZE} Strängen belegt — Showdown wirkt dünn besetzt.`,
    );
  }

  // Doppelte IDs.
  const seenIds = new Set<string>();
  for (const c of safe) {
    if (seenIds.has(c.id)) conflicts.push(`Doppelte Strang-ID "${c.id}" im Raster.`);
    seenIds.add(c.id);
  }

  // Positions-Kollisionen (paarweise).
  for (let i = 0; i < safe.length; i++) {
    for (let j = i + 1; j < safe.length; j++) {
      const a = safe[i];
      const b = safe[j];
      if ((a.position?.x ?? 0) === (b.position?.x ?? 0) && (a.position?.y ?? 0) === (b.position?.y ?? 0)) {
        conflicts.push(`Position-Kollision: "${a.name}" und "${b.name}" stehen am selben Punkt (${a.position?.x}, ${a.position?.y}).`);
      }
    }
  }

  // Feldprüfungen.
  for (const c of safe) {
    if (typeof c.tension !== "number" || c.tension < 0 || c.tension > 1) {
      warnings.push(`Spannung von "${c.name}" liegt außerhalb von 0–1 (${c.tension}).`);
    }
    if (!c.goal || c.goal.trim().length === 0) {
      warnings.push(`Strang "${c.name}" hat kein Ziel — Konvergenz unklar.`);
    }
    if (!c.role || c.role.trim().length === 0) {
      warnings.push(`Strang "${c.name}" hat keine Rolle.`);
    }
  }

  return { grid: sortByStrand(safe), conflicts, warnings };
}

// ---------------------------------------------------------------------------
// 2) Flüssige Perspektiv-Übergabe
// ---------------------------------------------------------------------------

/** Gekoppelte Aktions-/Reaktions-Paare für kausale Schnittketten. */
const HANDOFF_PAIRS: { action: string; reaction: string }[] = [
  { action: "schießt den Pfeil ab", reaction: "den Einschlag sieht" },
  { action: "entzündet das Signal", reaction: "den Rauch am Horizont erkennt" },
  { action: "bricht die Tür auf", reaction: "die Splitter durch den Raum fliegen hört" },
  { action: "stößt den Schrei aus", reaction: "den Schrei hört" },
  { action: "lässt die Klinge fallen", reaction: "das Klirren auf dem Stein spürt" },
  { action: "flüstert den Namen", reaction: "den Namen über den Hof getragen hört" },
  { action: "reißt das Banner hoch", reaction: "das Tuch im Wind peitschen sieht" },
  { action: "entfacht die Flamme", reaction: "die Hitze im Gesicht spürt" },
];

/**
 * Erzeugt eine flüssige Perspektiv-Übergabe über alle Stränge.
 *
 * Jeder Schnitt ist kausal verankert: die Handlung des abgebenden Strangs
 * liefert das Signal, das der übernehmende Strang wahrnimmt, z. B.
 * „Figur A schießt den Pfeil ab ➔ Schnitt zu Figur B, die den Einschlag sieht".
 *
 * Deterministisch: gleicher Seed + gleiche Stränge → gleiche Kette.
 * Defensiv: weniger als zwei Stränge liefern eine leere Kette.
 */
export function generateHandoffSequence(characters: CharacterState[], seed: number): HandoffSequence {
  const sequence: string[] = [];
  const transitions: HandoffTransition[] = [];

  const safe = Array.isArray(characters) ? characters.filter((c) => c && typeof c.id === "string") : [];
  if (safe.length < 2) return { sequence, transitions };

  const signature = safe.map((c) => c.id).join(",");
  const rng = createSeededRandom(hashString(`${seed >>> 0}#${signature}`));

  // Erster Beat: der Auslöser der Kette.
  const firstPair = pick(HANDOFF_PAIRS, rng);
  sequence.push(`${safe[0].name} ${firstPair.action}`);

  // Folge-Beats: jeder Schnitt reagiert auf die Handlung des Vorgängers.
  let previousPair = firstPair;
  for (let i = 1; i < safe.length; i++) {
    const current = safe[i];
    const cue = `${safe[i - 1].name} ${previousPair.action} ➔ Schnitt zu ${current.name}, die ${previousPair.reaction}`;
    transitions.push({ from: safe[i - 1].id, to: current.id, cue });
    sequence.push(`Schnitt zu ${current.name}, die ${previousPair.reaction}`);

    // Nächste Handlung dieses Strangs (für den folgenden Schnitt).
    previousPair = pick(HANDOFF_PAIRS, rng);
  }

  return { sequence, transitions };
}

// ---------------------------------------------------------------------------
// 3) Kausalitäts-Kaskade
// ---------------------------------------------------------------------------

/**
 * Prüft die Kausalitäts-Kaskade über die Zeitleiste.
 *
 * Verstöße: unbekannte Figur, widersprüchliche Handlungen derselben Figur
 * zum selben Zeitstempel. Anomalien: Zeitstempel rückwärts (Zeitreise),
 * negative oder ungültige Zeitstempel. Warnungen: leere Handlungen, Figuren
 * ohne Ereignis.
 *
 * Defensiv: ungültige Eingaben liefern leere Ergebnisse.
 */
export function checkCausality(
  characters: CharacterState[],
  timeline: TimelineEvent[],
): CausalityResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const anomalies: string[] = [];

  const safeChars = Array.isArray(characters) ? characters.filter((c) => c && typeof c.id === "string") : [];
  const safeTimeline = Array.isArray(timeline) ? timeline.filter((e) => e && typeof e.characterId === "string") : [];

  const known = new Map<string, CharacterState>();
  for (const c of safeChars) known.set(c.id, c);

  if (safeTimeline.length === 0) {
    warnings.push("Keine Zeitleisten-Ereignisse übergeben — Kausalität ungeprüft.");
  }

  // Ereignisse je Figur sammeln.
  const byCharacter = new Map<string, TimelineEvent[]>();

  for (const e of safeTimeline) {
    const name = known.get(e.characterId)?.name ?? e.characterId;

    if (!known.has(e.characterId)) {
      violations.push(`Unbekannte Figur "${e.characterId}" handelt in der Zeitleiste.`);
    }
    if (typeof e.action !== "string" || e.action.trim().length === 0) {
      warnings.push(`Figur "${name}" hat ein leeres Ereignis ohne Handlung.`);
    }
    if (typeof e.timestamp !== "number" || !Number.isFinite(e.timestamp)) {
      anomalies.push(`Ungültiger Zeitstempel bei "${name}" (${String(e.timestamp)}).`);
      continue;
    }
    if (e.timestamp < 0) {
      anomalies.push(`Negativer Zeitstempel bei "${name}" (${e.timestamp}) — liegt vor dem Anfang der Geschichte.`);
    }

    const list = byCharacter.get(e.characterId);
    if (list) list.push(e);
    else byCharacter.set(e.characterId, [e]);
  }

  // Pro Figur: Rückwärts-Sprünge und Widersprüche prüfen.
  for (const [id, events] of byCharacter) {
    const name = known.get(id)?.name ?? id;

    // Widerspruch: gleiche Figur, gleicher Zeitstempel, unterschiedliche Handlung.
    const byTime = new Map<number, Set<string>>();
    for (const e of events) {
      if (typeof e.timestamp !== "number" || !Number.isFinite(e.timestamp)) continue;
      const set = byTime.get(e.timestamp);
      if (set) set.add(e.action);
      else byTime.set(e.timestamp, new Set([e.action]));
    }
    for (const [ts, actions] of byTime) {
      if (actions.size > 1) {
        violations.push(`Widersprüchliche Handlungen von "${name}" zum Zeitstempel ${ts}: ${[...actions].join(" / ")}.`);
      }
    }

    // Anomalie: Rückwärts-Sprung in der Reihenfolge der übergebenen Ereignisse.
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1].timestamp;
      const cur = events[i].timestamp;
      if (typeof prev === "number" && typeof cur === "number" && cur < prev) {
        anomalies.push(`Zeit-Anomalie: "${name}" handelt bei ${cur} nach ${prev} — Zeitlinie rückwärts.`);
      }
    }
  }

  // Warnung: Figur im Raster, aber ohne Ereignis.
  for (const c of safeChars) {
    if (!byCharacter.has(c.id)) {
      warnings.push(`Strang "${c.name}" hat kein Zeitleisten-Ereignis.`);
    }
  }

  return { violations, warnings, anomalies };
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Erzeugt ein deterministisches Beispiel-Synchronraster mit acht Strängen. */
export function createSampleSyncGrid(): CharacterState[] {
  const rng = createSeededRandom(hashString("sample-sync-grid"));
  const roles = ["Protagonist", "Antagonist", "Verbündeter", "Verräter", "Wächter", "Bote", "Orakel", "Kriegsherr"];
  const goals = [
    "das Tor halten",
    "den Thron beanspruchen",
    "die Flucht decken",
    "das Siegel brechen",
    "den König schützen",
    "die Nachricht überbringen",
    "das Ende vorhersagen",
    "die Stadt einnehmen",
  ];
  const names = [
    "Lyra Falkenstein",
    "Bram Düsterwald",
    "Sera Nebelmarschen",
    "Kael Salzhafen",
    "Idris vom Berg",
    "Nora Windläufer",
    "Vater Orin",
    "Herrin Vashti",
  ];

  const characters: CharacterState[] = [];
  for (let i = 0; i < SYNC_GRID_SIZE; i++) {
    characters.push({
      id: `s${i + 1}`,
      name: names[i],
      role: roles[i],
      position: { x: Math.round(rng() * 100), y: Math.round(rng() * 100) },
      goal: goals[i],
      tension: Math.round(rng() * 100) / 100,
    });
  }
  return characters;
}

/** Erzeugt eine deterministische Beispiel-Perspektiv-Übergabe. */
export function createSampleHandoff(): HandoffSequence {
  const characters = createSampleSyncGrid();
  return generateHandoffSequence(characters, hashString("sample-handoff"));
}
