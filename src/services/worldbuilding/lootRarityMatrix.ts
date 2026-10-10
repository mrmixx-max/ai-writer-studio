// LootRarityMatrix (WP 135.1)
// Loot-Raritäts- & Artefakt-Ausrüstungs-Matrix für Progression Fantasy & LitRPG.
// 6 Raritätsstufen, Set-Boni, RPG-Item-Tooltips.
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

// ---------------------------------------------------------------------------
// 1. Raritätsstufen
// ---------------------------------------------------------------------------

export type RarityId = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface Rarity {
  id: RarityId;
  name: string;
  color: string;
  glowColor: string;
  dropChance: number; // 0-1
  statMultiplier: number;
  description: string;
}

export const RARITIES: Rarity[] = [
  { id: "common", name: "Gewöhnlich", color: "#9e9e9e", glowColor: "rgba(158,158,158,0.3)", dropChance: 0.50, statMultiplier: 1.0, description: "Standard-Beute, keine besonderen Eigenschaften." },
  { id: "uncommon", name: "Ungewöhnlich", color: "#4caf50", glowColor: "rgba(76,175,80,0.3)", dropChance: 0.25, statMultiplier: 1.2, description: "Leicht verbessert, kleine Boni." },
  { id: "rare", name: "Selten", color: "#2196f3", glowColor: "rgba(33,150,243,0.3)", dropChance: 0.12, statMultiplier: 1.5, description: "Deutlich stärker, spezielle Fähigkeiten." },
  { id: "epic", name: "Episch", color: "#9c27b0", glowColor: "rgba(156,39,176,0.3)", dropChance: 0.07, statMultiplier: 2.0, description: "Mächtige Artefakte, einzigartige Effekte." },
  { id: "legendary", name: "Legendär", color: "#ff9800", glowColor: "rgba(255,152,0,0.4)", dropChance: 0.04, statMultiplier: 3.0, description: "Legendäre Waffen, verändern den Kampf." },
  { id: "mythic", name: "Mythisch", color: "#00bcd4", glowColor: "rgba(0,188,212,0.5)", dropChance: 0.02, statMultiplier: 5.0, description: "Göttliche Artefakte, extrem selten." },
];

// ---------------------------------------------------------------------------
// 2. Item-Typen & Slots
// ---------------------------------------------------------------------------

export type ItemSlot = "weapon" | "armor" | "accessory" | "consumable";

export interface Item {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: RarityId;
  baseStats: Record<string, number>;
  setName?: string;
  flavorText: string;
  durability?: number; // 0-100, undefined = unzerstörbar
  level: number;
}

export const ITEM_TEMPLATES: Item[] = [
  { id: "iron_sword", name: "Eisenschwert", slot: "weapon", rarity: "common", baseStats: { damage: 10, speed: 1.0 }, flavorText: "Ein einfaches Schwert aus Eisen.", durability: 80, level: 1 },
  { id: "steel_sword", name: "Stahlschwert", slot: "weapon", rarity: "uncommon", baseStats: { damage: 15, speed: 1.1 }, flavorText: "Schärfer und länger.", durability: 90, level: 5 },
  { id: "flame_blade", name: "Flammenklinge", slot: "weapon", rarity: "rare", baseStats: { damage: 25, speed: 1.2, fireDamage: 10 }, flavorText: "Die Klinge brennt in ewigem Feuer.", durability: 100, level: 10 },
  { id: "void_reaper", name: "Leerensensen", slot: "weapon", rarity: "epic", baseStats: { damage: 40, speed: 0.9, voidDamage: 20 }, flavorText: "Schnitten durch die Realität selbst.", durability: 100, level: 20 },
  { id: "excalibur", name: "Excalibur", slot: "weapon", rarity: "legendary", baseStats: { damage: 60, speed: 1.3, holyDamage: 30 }, flavorText: "Das Schwert des Königs.", durability: 100, level: 30 },
  { id: "godslayer", name: "Göttermörder", slot: "weapon", rarity: "mythic", baseStats: { damage: 100, speed: 1.5, divineDamage: 50 }, flavorText: "Getragen von einem Halbgott.", durability: 100, level: 50 },
  { id: "leather_armor", name: "Lederrüstung", slot: "armor", rarity: "common", baseStats: { defense: 5, weight: 3 }, flavorText: "Einfache Lederrüstung.", durability: 60, level: 1 },
  { id: "chain_mail", name: "Kettenhemd", slot: "armor", rarity: "uncommon", baseStats: { defense: 10, weight: 8 }, flavorText: "Vernietete Eisenringe.", durability: 80, level: 5 },
  { id: "plate_armor", name: "Plattenrüstung", slot: "armor", rarity: "rare", baseStats: { defense: 20, weight: 15 }, flavorText: "Gehärtete Stahlplatten.", durability: 100, level: 10 },
  { id: "dragon_scale", name: "Drachenschuppen", slot: "armor", rarity: "epic", baseStats: { defense: 35, weight: 12, fireResist: 20 }, flavorText: "Schuppen eines alten Drachen.", durability: 100, level: 20 },
  { id: "aegis", name: "Aegis", slot: "armor", rarity: "legendary", baseStats: { defense: 50, weight: 10, allResist: 15 }, flavorText: "Der Schild der Götter.", durability: 100, level: 30 },
  { id: "divine_plate", name: "Göttliche Platte", slot: "armor", rarity: "mythic", baseStats: { defense: 80, weight: 8, divineResist: 30 }, flavorText: "Rüstung der Himmlischen.", durability: 100, level: 50 },
  { id: "health_potion", name: "Heiltrank", slot: "consumable", rarity: "common", baseStats: { healing: 50 }, flavorText: "Stellt 50 HP wieder her.", level: 1 },
  { id: "mana_potion", name: "Manatrank", slot: "consumable", rarity: "common", baseStats: { manaRestore: 30 }, flavorText: "Stellt 30 MP wieder her.", level: 1 },
  { id: "elixir", name: "Elixier", slot: "consumable", rarity: "rare", baseStats: { healing: 200, manaRestore: 100 }, flavorText: "Stellt alle Ressourcen wieder her.", level: 10 },
  { id: "power_ring", name: "Ring der Macht", slot: "accessory", rarity: "rare", baseStats: { strength: 5, dexterity: 5 }, setName: "Set der Macht", flavorText: "Ein Ring, der die Kraft verstärkt.", level: 10 },
  { id: "wisdom_amulet", name: "Amulett der Weisheit", slot: "accessory", rarity: "rare", baseStats: { wisdom: 5, intelligence: 5 }, setName: "Set der Weisheit", flavorText: "Ein Amulett, das den Geist schärft.", level: 10 },
  { id: "speed_boots", name: "Stiefel der Geschwindigkeit", slot: "accessory", rarity: "uncommon", baseStats: { dexterity: 3, speed: 0.2 }, setName: "Set der Winde", flavorText: "Leichte Stiefel, die den Träger schneller machen.", level: 5 },
  { id: "fire_amulet", name: "Feueramulett", slot: "accessory", rarity: "epic", baseStats: { fireResist: 15, fireDamage: 10 }, setName: "Set der Flamme", flavorText: "Ein Amulett, das Feuer kontrolliert.", level: 20 },
  { id: "shadow_cloak_item", name: "Schattenumhang", slot: "accessory", rarity: "epic", baseStats: { stealth: 20, dexterity: 10 }, setName: "Set der Schatten", flavorText: "Ein Umhang, der den Träger verbirgt.", level: 20 },
];

// ---------------------------------------------------------------------------
// 3. Set-Boni
// ---------------------------------------------------------------------------

export interface SetBonus {
  setName: string;
  piecesRequired: number;
  bonus: Record<string, number>;
  description: string;
}

export const SET_BONUSES: SetBonus[] = [
  { setName: "Set der Macht", piecesRequired: 2, bonus: { strength: 10, constitution: 5 }, description: "+10 STR, +5 CON" },
  { setName: "Set der Weisheit", piecesRequired: 2, bonus: { wisdom: 10, intelligence: 5 }, description: "+10 WIS, +5 INT" },
  { setName: "Set der Winde", piecesRequired: 2, bonus: { dexterity: 10, speed: 0.3 }, description: "+10 DEX, +0.3 Speed" },
  { setName: "Set der Flamme", piecesRequired: 2, bonus: { fireResist: 25, fireDamage: 15 }, description: "+25 Fire Resist, +15 Fire Damage" },
  { setName: "Set der Schatten", piecesRequired: 2, bonus: { stealth: 30, dexterity: 15 }, description: "+30 Stealth, +15 DEX" },
];

// ---------------------------------------------------------------------------
// 4. Loot-Generator
// ---------------------------------------------------------------------------

export interface LootResult {
  item: Item;
  rolledRarity: RarityId;
  rolledStats: Record<string, number>;
  isUpgrade: boolean;
}

export function rollRarity(rng: () => number): RarityId {
  const roll = rng();
  let cumulative = 0;
  for (const rarity of RARITIES) {
    cumulative += rarity.dropChance;
    if (roll <= cumulative) return rarity.id;
  }
  return "common";
}

export function generateLoot(level: number, rng: () => number): LootResult {
  const rarityId = rollRarity(rng);
  const rarity = RARITIES.find((r) => r.id === rarityId)!;
  const template = ITEM_TEMPLATES[Math.floor(rng() * ITEM_TEMPLATES.length)];

  const rolledStats: Record<string, number> = {};
  for (const [stat, value] of Object.entries(template.baseStats)) {
    const scaled = Math.round(value * rarity.statMultiplier * (1 + level * 0.05));
    rolledStats[stat] = scaled;
  }

  return {
    item: { ...template, rarity: rarityId, baseStats: rolledStats },
    rolledRarity: rarityId,
    rolledStats,
    isUpgrade: rarity.statMultiplier > 1.0,
  };
}

// ---------------------------------------------------------------------------
// 5. Set-Boni-Berechnung
// ---------------------------------------------------------------------------

export interface SetBonusResult {
  setName: string;
  piecesWorn: number;
  bonusActive: boolean;
  bonus: Record<string, number>;
  description: string;
}

export function calculateSetBonuses(equippedItems: Item[]): SetBonusResult[] {
  const setCounts = new Map<string, number>();
  for (const item of equippedItems) {
    if (item.setName) {
      setCounts.set(item.setName, (setCounts.get(item.setName) ?? 0) + 1);
    }
  }

  const results: SetBonusResult[] = [];
  for (const bonus of SET_BONUSES) {
    const piecesWorn = setCounts.get(bonus.setName) ?? 0;
    results.push({
      setName: bonus.setName,
      piecesWorn,
      bonusActive: piecesWorn >= bonus.piecesRequired,
      bonus: piecesWorn >= bonus.piecesRequired ? bonus.bonus : {},
      description: bonus.description,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6. Item-Tooltip-Generator
// ---------------------------------------------------------------------------

export interface ItemTooltip {
  name: string;
  rarity: Rarity;
  slot: ItemSlot;
  level: number;
  stats: Record<string, number>;
  flavorText: string;
  durability?: number;
  setName?: string;
  setBonus?: string;
}

export function generateItemTooltip(item: Item): ItemTooltip {
  const rarity = RARITIES.find((r) => r.id === item.rarity) ?? RARITIES[0];
  return {
    name: item.name,
    rarity,
    slot: item.slot,
    level: item.level,
    stats: item.baseStats,
    flavorText: item.flavorText,
    durability: item.durability,
    setName: item.setName,
  };
}

// ---------------------------------------------------------------------------
// 7. Hilfsfunktionen
// ---------------------------------------------------------------------------

export function getRarityById(id: RarityId): Rarity {
  const rarity = RARITIES.find((r) => r.id === id);
  if (!rarity) throw new Error(`Unknown rarity: ${id}`);
  return rarity;
}

export function getItemById(id: string): Item {
  const item = ITEM_TEMPLATES.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

export function getAllItems(): Item[] {
  return [...ITEM_TEMPLATES];
}

export function getItemsByRarity(rarity: RarityId): Item[] {
  return ITEM_TEMPLATES.filter((i) => i.rarity === rarity);
}

export function getItemsBySlot(slot: ItemSlot): Item[] {
  return ITEM_TEMPLATES.filter((i) => i.slot === slot);
}

export function getSetBonusByName(name: string): SetBonus {
  const bonus = SET_BONUSES.find((b) => b.setName === name);
  if (!bonus) throw new Error(`Unknown set: ${name}`);
  return bonus;
}

export function getAllSetBonuses(): SetBonus[] {
  return [...SET_BONUSES];
}
