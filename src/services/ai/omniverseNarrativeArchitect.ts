// OmniverseNarrativeArchitect (WP 100.1)
// 360° Omniverse Story-Architekt.
// Ganzheitliche System-Verknüpfung, Inkonsistenz-Frühwarnsystem, 1-Klick-Synchronisation.
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
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export interface MapNode {
  id: string;
  name: string;
  terrain: "ebene" | "wald" | "gebirge" | "sumpf" | "wueste" | "strasse";
  x: number;
  y: number;
}

export interface TravelEdge {
  from: string;
  to: string;
  distanceKm: number;
}

export interface Character {
  id: string;
  name: string;
  voiceProfile: string;
}

export interface CurrencyEntry {
  id: string;
  realm: string;
  denomination: string;
  status: "current" | "fallen" | "debased";
}

export interface TextPassage {
  id: string;
  chapter: number;
  text: string;
  characterId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  travelTimeHours?: number;
  currencyId?: string;
  pricePaid?: number;
}

export interface WorldModel {
  nodes: MapNode[];
  edges: TravelEdge[];
  characters: Character[];
  currencies: CurrencyEntry[];
  passages: TextPassage[];
}

/** Basisgeschwindigkeit je Gelände in km/h (Reittempo mit Gepäck). */
const TERRAIN_SPEED_KMH: Record<MapNode["terrain"], number> = {
  strasse: 12,
  ebene: 9,
  wald: 5,
  gebirge: 3,
  sumpf: 2.5,
  wueste: 4,
};

export function terrainSpeed(terrain: MapNode["terrain"]): number {
  return TERRAIN_SPEED_KMH[terrain] ?? 9;
}

export function findNode(model: WorldModel, id: string): MapNode | undefined {
  return model.nodes.find((n) => n.id === id);
}

/** Berechnet die erwartete Reisezeit (Stunden) für einen Pfad über die Kanten. */
export function estimateTravelHours(model: WorldModel, from: string, to: string): number | null {
  if (from === to) return 0;
  const fromNode = findNode(model, from);
  const toNode = findNode(model, to);
  if (!fromNode || !toNode) return null;

  const edge = model.edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
  if (!edge) return null;

  const avgSpeed = (terrainSpeed(fromNode.terrain) + terrainSpeed(toNode.terrain)) / 2;
  if (avgSpeed <= 0) return null;
  return Math.round((edge.distanceKm / avgSpeed) * 10) / 10;
}

export type InconsistencyKind =
  | "travelTooFast"
  | "fallenCurrency"
  | "unknownCharacter"
  | "missingNode"
  | "noEdge";

export interface Inconsistency {
  kind: InconsistencyKind;
  passageId: string;
  severity: "info" | "warn" | "error";
  message: string;
}

export function detectInconsistencies(model: WorldModel): Inconsistency[] {
  const issues: Inconsistency[] = [];

  for (const p of model.passages) {
    if (p.characterId && !model.characters.some((c) => c.id === p.characterId)) {
      issues.push({
        kind: "unknownCharacter",
        passageId: p.id,
        severity: "warn",
        message: `Figur "${p.characterId}" ist im Stammbaum nicht verzeichnet.`,
      });
    }

    if (p.fromNodeId || p.toNodeId) {
      if (p.fromNodeId && !findNode(model, p.fromNodeId)) {
        issues.push({ kind: "missingNode", passageId: p.id, severity: "error", message: `Startort "${p.fromNodeId}" fehlt auf der Weltkarte.` });
      }
      if (p.toNodeId && !findNode(model, p.toNodeId)) {
        issues.push({ kind: "missingNode", passageId: p.id, severity: "error", message: `Zielort "${p.toNodeId}" fehlt auf der Weltkarte.` });
      }
      if (p.fromNodeId && p.toNodeId && findNode(model, p.fromNodeId) && findNode(model, p.toNodeId)) {
        const expected = estimateTravelHours(model, p.fromNodeId, p.toNodeId);
        if (expected === null) {
          issues.push({ kind: "noEdge", passageId: p.id, severity: "warn", message: `Keine Route zwischen "${p.fromNodeId}" und "${p.toNodeId}" kartiert.` });
        } else if (typeof p.travelTimeHours === "number" && p.travelTimeHours < expected * 0.5) {
          issues.push({
            kind: "travelTooFast",
            passageId: p.id,
            severity: "error",
            message: `Figur reitet ${p.travelTimeHours}h, die Geländegeschwindigkeit verlangt aber mindestens ${expected}h.`,
          });
        }
      }
    }

    if (p.currencyId) {
      const cur = model.currencies.find((c) => c.id === p.currencyId);
      if (cur && cur.status === "fallen") {
        issues.push({
          kind: "fallenCurrency",
          passageId: p.id,
          severity: "error",
          message: `Figur zahlt mit ${cur.denomination} aus dem gefallenen Reich ${cur.realm}.`,
        });
      }
    }
  }

  return issues;
}

export interface SystemLink {
  system: "map" | "economy" | "genealogy" | "voices";
  passageId: string;
  targetId: string;
  detail: string;
}

/** Verknüpft Textstellen mit den Weltsystemen (Karte, Währung, Stammbaum, Stimmen). */
export function linkSystems(model: WorldModel): SystemLink[] {
  const links: SystemLink[] = [];
  for (const p of model.passages) {
    if (p.characterId) {
      const ch = model.characters.find((c) => c.id === p.characterId);
      if (ch) links.push({ system: "genealogy", passageId: p.id, targetId: ch.id, detail: `Stimme: ${ch.voiceProfile}` });
    }
    if (p.fromNodeId && p.toNodeId) {
      const hours = estimateTravelHours(model, p.fromNodeId, p.toNodeId);
      if (hours !== null) links.push({ system: "map", passageId: p.id, targetId: `${p.fromNodeId}→${p.toNodeId}`, detail: `${hours}h Reisezeit` });
    }
    if (p.currencyId && typeof p.pricePaid === "number") {
      const cur = model.currencies.find((c) => c.id === p.currencyId);
      if (cur) links.push({ system: "economy", passageId: p.id, targetId: cur.id, detail: `${p.pricePaid} ${cur.denomination} (${cur.status})` });
    }
    if (p.characterId) {
      links.push({ system: "voices", passageId: p.id, targetId: p.characterId, detail: "Dialogzuordnung" });
    }
  }
  return links;
}

export interface SyncReport {
  id: string;
  before: number;
  after: number;
  resolved: Inconsistency[];
  remaining: Inconsistency[];
  adjustments: string[];
}

/** 1-Klick-Synchronisation: korrigiert Reisezeiten auf den kartierten Mindestwert. */
export function synchronizePlotStrands(model: WorldModel): { model: WorldModel; report: SyncReport } {
  const before = detectInconsistencies(model);
  const adjustments: string[] = [];
  const passages = model.passages.map((p) => {
    if (p.fromNodeId && p.toNodeId && typeof p.travelTimeHours === "number") {
      const expected = estimateTravelHours(model, p.fromNodeId, p.toNodeId);
      if (expected !== null && p.travelTimeHours < expected * 0.5) {
        adjustments.push(`${p.id}: Reisezeit ${p.travelTimeHours}h → ${expected}h angehoben`);
        return { ...p, travelTimeHours: expected };
      }
    }
    return p;
  });

  const synced: WorldModel = { ...model, passages };
  const remaining = detectInconsistencies(synced);
  const resolved = before.filter((b) => !remaining.some((r) => r.passageId === b.passageId && r.kind === b.kind));

  return {
    model: synced,
    report: {
      id: `SYNC-${hashString(model.passages.map((p) => p.id).join(",")).toString(16).padStart(8, "0").toUpperCase()}`,
      before: before.length,
      after: remaining.length,
      resolved,
      remaining,
      adjustments,
    },
  };
}

export interface OmniverseReport {
  id: string;
  nodeCount: number;
  characterCount: number;
  passageCount: number;
  links: SystemLink[];
  inconsistencies: Inconsistency[];
  healthScore: number;
  synchronized: boolean;
}

export function analyzeOmniverse(model: WorldModel): OmniverseReport {
  const links = linkSystems(model);
  const inconsistencies = detectInconsistencies(model);
  const errors = inconsistencies.filter((i) => i.severity === "error").length;
  const warns = inconsistencies.filter((i) => i.severity === "warn").length;
  const healthScore = Math.max(0, Math.min(100, 100 - errors * 12 - warns * 4));
  return {
    id: `OMNI-${hashString(`${model.nodes.length}:${model.characters.length}:${model.passages.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    nodeCount: model.nodes.length,
    characterCount: model.characters.length,
    passageCount: model.passages.length,
    links,
    inconsistencies,
    healthScore,
    synchronized: errors === 0,
  };
}

export function createSampleWorldModel(): WorldModel {
  const rng = createSeededRandom(hashString("sample-world"));
  const nodes: MapNode[] = [
    { id: "n1", name: "Falkenstein", terrain: "gebirge", x: 10, y: 20 },
    { id: "n2", name: "Düsterwald", terrain: "wald", x: 40, y: 30 },
    { id: "n3", name: "Salzhafen", terrain: "strasse", x: 70, y: 55 },
    { id: "n4", name: "Nebelmarschen", terrain: "sumpf", x: 55, y: 75 },
  ];
  const edges: TravelEdge[] = [
    { from: "n1", to: "n2", distanceKm: 48 },
    { from: "n2", to: "n3", distanceKm: 90 },
    { from: "n2", to: "n4", distanceKm: 36 },
  ];
  const characters: Character[] = [
    { id: "c1", name: "Lyra Falkenstein", voiceProfile: pick(["warm-alt", "scharf-jung", "rau-tief"], rng) },
    { id: "c2", name: "Bram Düsterwald", voiceProfile: pick(["warm-alt", "scharf-jung", "rau-tief"], rng) },
  ];
  const currencies: CurrencyEntry[] = [
    { id: "cur1", realm: "Salzhafen", denomination: "Salzmark", status: "current" },
    { id: "cur2", realm: "Alt-Falkenstein", denomination: "Bergtaler", status: "fallen" },
  ];
  const passages: TextPassage[] = [
    { id: "p1", chapter: 1, text: "Lyra ritt von Falkenstein nach Düsterwald.", characterId: "c1", fromNodeId: "n1", toNodeId: "n2", travelTimeHours: 12 },
    { id: "p2", chapter: 2, text: "Sie zahlte mit alten Bergtalern.", characterId: "c1", currencyId: "cur2", pricePaid: 3 },
    { id: "p3", chapter: 3, text: "Bram eilte nach Salzhafen.", characterId: "c2", fromNodeId: "n2", toNodeId: "n3", travelTimeHours: 4 },
  ];
  return { nodes, edges, characters, currencies, passages };
}
