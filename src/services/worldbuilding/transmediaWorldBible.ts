// TransmediaWorldBible (WP 74.2)
//
// Verwaltet eine transmediale Franchise-Bibel mit Kanon-Hierarchie,
// Kosmologie-Ebenen und Kanon-Kollisions-Wächter.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

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

/** Kanon-Stufe. */
export type CanonTier = "core" | "prequel" | "legend";

/** Ein Kanon-Eintrag. */
export interface CanonEntry {
  id: string;
  title: string;
  tier: CanonTier;
  description: string;
  contradictions: string[];
}

/** Eine Kosmologie-Ebene. */
export interface CosmologyLevel {
  id: string;
  name: string;
  description: string;
  inviolableLaws: string[];
}

/** Ein Kollisions-Bericht. */
export interface CollisionReport {
  entryId: string;
  conflicts: string[];
  severity: "none" | "minor" | "major" | "critical";
}

/** Die transmediale Welt-Bibel. */
export interface WorldBible {
  title: string;
  entries: CanonEntry[];
  cosmologyLevels: CosmologyLevel[];
  collisions: CollisionReport[];
}

/** Kanon-Tier-Labels. */
export const TIER_LABELS: Record<CanonTier, string> = {
  core: "Kern-Kanon",
  prequel: "Prequel-Kanon",
  legend: "Legenden/Volksglaube",
};

/** Erstellt eine leere Welt-Bibel. */
export function createEmptyBible(title: string): WorldBible {
  return { title, entries: [], cosmologyLevels: [], collisions: [] };
}

/** Fügt einen Kanon-Eintrag hinzu. */
export function addCanonEntry(bible: WorldBible, entry: CanonEntry): WorldBible {
  return { ...bible, entries: [...bible.entries, entry] };
}

/** Fügt eine Kosmologie-Ebene hinzu. */
export function addCosmologyLevel(bible: WorldBible, level: CosmologyLevel): WorldBible {
  return { ...bible, cosmologyLevels: [...bible.cosmologyLevels, level] };
}

/** Prüft Kollisionen zwischen einem neuen Eintrag und dem bestehenden Kanon. */
export function checkCollisions(bible: WorldBible, newEntry: CanonEntry): CollisionReport {
  const conflicts: string[] = [];

  for (const existing of bible.entries) {
    for (const contra of newEntry.contradictions) {
      if (existing.contradictions.includes(contra)) {
        conflicts.push(`${existing.title} widerspricht: ${contra}`);
      }
    }
  }

  let severity: CollisionReport["severity"] = "none";
  if (conflicts.length >= 3) severity = "critical";
  else if (conflicts.length >= 2) severity = "major";
  else if (conflicts.length >= 1) severity = "minor";

  return { entryId: newEntry.id, conflicts, severity };
}

/** Prüft alle Kollisionen in der Bibel. */
export function auditAllCollisions(bible: WorldBible): CollisionReport[] {
  const reports: CollisionReport[] = [];
  for (const entry of bible.entries) {
    const others = bible.entries.filter((e) => e.id !== entry.id);
    const tempBible = { ...bible, entries: others };
    const report = checkCollisions(tempBible, entry);
    if (report.conflicts.length > 0) {
      reports.push(report);
    }
  }
  return reports;
}

/** Findet alle Einträge einer Kanon-Stufe. */
export function getEntriesByTier(bible: WorldBible, tier: CanonTier): CanonEntry[] {
  return bible.entries.filter((e) => e.tier === tier);
}

/** Findet alle Einträge, die ein bestimmtes Thema behandeln. */
export function searchEntries(bible: WorldBible, query: string): CanonEntry[] {
  const q = query.toLowerCase();
  return bible.entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q),
  );
}

/** Generiert eine Beispiel-Welt-Bibel. */
export function createSampleBible(): WorldBible {
  let bible = createEmptyBible("Die Chroniken der Aetherie");

  bible = addCanonEntry(bible, {
    id: "core-1",
    title: "Die Schöpfung der Aetherie",
    tier: "core",
    description: "Die Welt wurde aus dem Ur-Licht erschaffen.",
    contradictions: ["Die Welt ist ewig", "Die Welt wurde aus Chaos erschaffen"],
  });

  bible = addCanonEntry(bible, {
    id: "core-2",
    title: "Die fünf Elemente",
    tier: "core",
    description: "Feuer, Wasser, Erde, Luft und Aether bilden die Welt.",
    contradictions: ["Es gibt nur vier Elemente", "Aether ist ein Mythos"],
  });

  bible = addCanonEntry(bible, {
    id: "prequel-1",
    title: "Der Fall der Sternenstadt",
    tier: "prequel",
    description: "Die Sternenstadt fiel durch Verrat von innen.",
    contradictions: ["Die Sternenstadt fiel durch Naturkatastrophe"],
  });

  bible = addCanonEntry(bible, {
    id: "legend-1",
    title: "Der Wächter des Ur-Lichts",
    tier: "legend",
    description: "Ein mythischer Wächter beschützt das Ur-Licht seit Anbeginn.",
    contradictions: ["Der Wächter ist eine Erfindung"],
  });

  bible = addCosmologyLevel(bible, {
    id: "phys-1",
    name: "Physische Ebene",
    description: "Die Welt der Materie und der fünf Elemente.",
    inviolableLaws: ["Energieerhaltung", "Kausalität", "Endliche Lichtgeschwindigkeit"],
  });

  bible = addCosmologyLevel(bible, {
    id: "aether-1",
    name: "Aether-Ebene",
    description: "Die Ebene des reinen Aethers, jenseits der Materie.",
    inviolableLaws: ["Aether ist unzerstörbar", "Aether kann nicht erschaffen werden", "Aether ist die Quelle aller Magie"],
  });

  return bible;
}

/** Formatiert die Welt-Bibel als Text. */
export function formatWorldBible(bible: WorldBible): string {
  const lines: string[] = [];
  lines.push(`=== TRANSMEDIALE WELT-BIBEL: ${bible.title} ===`);
  lines.push("");

  lines.push("KANON:");
  for (const tier of ["core", "prequel", "legend"] as CanonTier[]) {
    const entries = getEntriesByTier(bible, tier);
    if (entries.length > 0) {
      lines.push(`  [${TIER_LABELS[tier]}]`);
      for (const e of entries) {
        lines.push(`    ${e.title}: ${e.description}`);
      }
    }
  }
  lines.push("");

  lines.push("KOSMOLOGIE:");
  for (const level of bible.cosmologyLevels) {
    lines.push(`  ${level.name}: ${level.description}`);
    for (const law of level.inviolableLaws) {
      lines.push(`    - ${law}`);
    }
  }
  lines.push("");

  const collisions = auditAllCollisions(bible);
  if (collisions.length > 0) {
    lines.push("KOLLISIONEN:");
    for (const c of collisions) {
      lines.push(`  ${c.entryId} [${c.severity}]: ${c.conflicts.join("; ")}`);
    }
  } else {
    lines.push("KOLLISIONEN: Keine");
  }

  return lines.join("\n");
}

/** Exportiert die Bibel als Markdown. */
export function exportAsMarkdown(bible: WorldBible): string {
  const lines: string[] = [];
  lines.push(`# ${bible.title}`);
  lines.push("");
  lines.push("## Kanon");
  for (const tier of ["core", "prequel", "legend"] as CanonTier[]) {
    const entries = getEntriesByTier(bible, tier);
    if (entries.length > 0) {
      lines.push(`### ${TIER_LABELS[tier]}`);
      for (const e of entries) {
        lines.push(`- **${e.title}**: ${e.description}`);
      }
      lines.push("");
    }
  }
  lines.push("## Kosmologie");
  for (const level of bible.cosmologyLevels) {
    lines.push(`### ${level.name}`);
    lines.push(level.description);
    for (const law of level.inviolableLaws) {
      lines.push(`- ${law}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
