// OnomatopoeiaStylist (WP 91.1)
// Comic-Soundeffekt- & Onomatopoesie-Stylist.
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

export type SFXCategory = 
  | "impact" | "explosion" | "weapon" | "movement" | "environment" 
  | "biological" | "mechanical" | "magical" | "ui" | "emotional";

export interface SFXEntry {
  id: string;
  western: string; // Westliches Comic-SFX
  manga: string; // Japanisches Giongo/Gitaigo
  category: SFXCategory;
  intensity: 1 | 2 | 3 | 4 | 5; // 1=leise, 5=Schockwelle
  description: string;
  svgPath?: string; // Vektor-Pfad für gerenderten Schriftzug
}

export interface SFXProfile {
  id: string;
  name: string;
  entries: SFXEntry[];
  seed: number;
}

const WESTERN_SFX: Record<SFXCategory, string[]> = {
  impact: ["BAM", "WHAM", "THUD", "CRUNCH", "SMACK", "THWACK", "KER-THUNK", "DOINK"],
  explosion: ["BOOM", "KABOOM", "KRAKOOM", "BLAM", "KA-POW", "WHOOOOSH", "FOOOM", "BA-BOOM"],
  weapon: ["SHING", "SNICKT", "CLANG", "CLINK", "THWIP", "SNKT", "CHIK", "KER-CHUNK"],
  movement: ["WHOOSH", "SWISH", "ZOOM", "VROOM", "SCRITCH", "PATTER", "THUMP-THUMP", "GALLOP"],
  environment: ["CRASH", "RUMBLE", "CRACKLE", "HISS", "SPLASH", "DRIP", "CREAK", "GROAN"],
  biological: ["THUMP-THUMP", "GULP", "SNIFF", "COUGH", "SNEEZE", "YAWN", "SIGH", "GROWL"],
  mechanical: ["WHIRR", "CLICK", "HUM", "BUZZ", "BEEP", "CLANK", "GRIND", "RATCHET"],
  magical: ["ZAP", "FWOOSH", "SHIMMER", "POOF", "TWINKLE", "CRACKLE", "HUM", "RESONATE"],
  ui: ["DING", "PING", "CHIME", "BLIP", "BLOOP", "CLICK", "POP", "SNAP"],
  emotional: ["DOKI-DOKI", "THUMP-THUMP", "SQUEE", "UGH", "AHA", "OHO", "HMM", "GASP"],
};

const MANGA_SFX: Record<SFXCategory, string[]> = {
  impact: ["ドーン", "バン", "ガン", "ドカ", "バキ", "ゴツ", "ズシン", "ドカーン"],
  explosion: ["ドカーン", "ババーン", "ドゴーン", "ズドーン", "ドカーン", "バキューン", "ゴゴゴ", "ドドド"],
  weapon: ["シャキン", "シュッ", "カチン", "キーン", "シュバ", "スパッ", "ザシュ", "ギン"],
  movement: ["シュッ", "ヒュッ", "バッ", "ドドド", "タタタ", "スタスタ", "トコトコ", "ダダダ"],
  environment: ["ゴロゴロ", "ザーザー", "パチパチ", "シュー", "チャプン", "ポタポタ", "キシキシ", "グオオ"],
  biological: ["ドキドキ", "ゴクリ", "クンクン", "ハックション", "クシュン", "フワッ", "ハア", "グルル"],
  mechanical: ["ウィーン", "カチッ", "ブーン", "ブーン", "ピポッ", "ガチャン", "ガリガリ", "カリカリ"],
  magical: ["ピカッ", "シュワッ", "キラキラ", "ポフ", "フワリ", "パチパチ", "ウウウ", "ゴオオ"],
  ui: ["ピンポン", "ピコッ", "チャイム", "ピッ", "ポコッ", "カチッ", "ポン", "スッ"],
  emotional: ["ドキドキ", "ドキドキ", "キュン", "ウウ", "ハッ", "ホッ", "フム", "ギャッ"],
};

const CATEGORY_LABELS: Record<SFXCategory, string> = {
  impact: "💥 Aufprall",
  explosion: "💣 Explosion",
  weapon: "⚔️ Waffe",
  movement: "🏃 Bewegung",
  environment: "🌍 Umgebung",
  biological: "🫀 Biologisch",
  mechanical: "⚙️ Mechanisch",
  magical: "✨ Magisch",
  ui: "🖥️ UI",
  emotional: "💓 Emotional",
};

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateSVGPath(text: string, intensity: number, rng: () => number): string {
  // Einfacher Vektor-Pfad für Comic-Schriftzug
  const width = text.length * 24 + 20;
  const height = 40 + intensity * 8;
  const skew = (rng() - 0.5) * intensity * 10;
  const distortion = intensity * 2;
  
  return `M10,${height/2} Q${width/2 + skew},${-distortion} ${width - 10},${height/2} Q${width/2 + skew},${height + distortion} 10,${height/2}`;
}

export function createSFXProfile(name: string, seed: number = 42): SFXProfile {
  const rng = createSeededRandom(hashString(name + seed));
  const categories: SFXCategory[] = [
    "impact", "explosion", "weapon", "movement", "environment",
    "biological", "mechanical", "magical", "ui", "emotional",
  ];
  
  const entries: SFXEntry[] = categories.map(cat => {
    const western = pickRandom(WESTERN_SFX[cat], rng);
    const manga = pickRandom(MANGA_SFX[cat], rng);
    const intensity = (1 + Math.floor(rng() * 5)) as SFXEntry["intensity"];
    const svgPath = generateSVGPath(western, intensity, rng);
    
    return {
      id: `SFX-${hashString(western + cat + seed).toString(16).padStart(6, "0")}`,
      western,
      manga,
      category: cat,
      intensity,
      description: `${CATEGORY_LABELS[cat]} — Intensität ${intensity}/5`,
      svgPath,
    };
  });
  
  return {
    id: `SFXP-${hashString(name + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    entries,
    seed,
  };
}

export function translateSFX(western: string, target: "western" | "manga"): string {
  // Einfaches Lookup für Demo
  const allWestern = Object.values(WESTERN_SFX).flat();
  const allManga = Object.values(MANGA_SFX).flat();
  const idx = allWestern.indexOf(western);
  if (idx >= 0 && target === "manga") return allManga[Math.min(idx, allManga.length - 1)];
  if (target === "western") return western;
  return western;
}

export function formatSFXProfile(profile: SFXProfile): string {
  const lines = [
    `🎭 ONOMATOPOESIE-PROFIL: ${profile.name}`,
    `ID: ${profile.id} | Seed: ${profile.seed} | Einträge: ${profile.entries.length}`,
    "",
  ];
  
  for (const entry of profile.entries) {
    const stars = "★".repeat(entry.intensity) + "☆".repeat(5 - entry.intensity);
    lines.push(
      `${CATEGORY_LABELS[entry.category]} (${stars}):`,
      `  Westlich: "${entry.western}"`,
      `  Manga:    "${entry.manga}"`,
      `  ${entry.description}`,
      ""
    );
  }
  
  return lines.join("\n");
}

export function createSampleProfile(): SFXProfile {
  return createSFXProfile("Action-Comic", 42);
}

export function createSampleTranslation(): { western: string; manga: string } {
  return { western: "BAM", manga: "ドーン" };
}