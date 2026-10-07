// CombatAuditoryTunnel (WP 87.1)
// Kampf-Tinnitus & Hör-Tunnel-Simulator.
// Deterministisch: FNV-1a + mulberry32. WebAudio API. Keine Node-Module.

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

export type ShockSource = "explosion" | "naher_schuss" | "schwert_auf_helm" | "kanonendonner" | "magischer_knall" | "donner" | "granate" | "schallwand";

export interface ShockProfile {
  source: ShockSource;
  peakDb: number;              // Spitzenschalldruck in dB (140-190)
  durationMs: number;          // Dauer des Initialschocks (10-500ms)
  tinnitusFreqHz: number;      // Tinnitus-Frequenz (3000-8000 Hz)
  tinnitusDb: number;          // Tinnitus-Lautstärke (20-60 dB über Hörschwelle)
  lowPassCutoffHz: number;     // Tiefpass-Filter für Auditory Exclusion (200-2000 Hz)
  lowPassQ: number;            // Resonanz (0.5-10)
  recoveryTimeS: number;       // Erholung bis Normalität (5-120s)
  heartRateBpm: number;        // Herzfrequenz während Schocks (80-180)
}

export interface AuditoryState {
  timeMs: number;
  ambientDb: number;           // Umgebungslautstärke (gedämpft)
  tinnitusDb: number;          // Aktuelle Tinnitus-Lautstärke
  lowPassFreq: number;         // Aktuelle Tiefpass-Grenzfrequenz
  heartRateBpm: number;        // Aktuelle Herzfrequenz
  muffledFactor: number;       // 0 = normal, 1 = komplett gedämpft
  ringing: boolean;            // Tinnitus aktiv
}

export interface ShockProse {
  german: string;
  english: string;
  spanish: string;
  french: string;
  intensity: "leicht" | "mittel" | "schwer" | "extrem";
  sensoryDetails: string[];
}

const SHOCK_PROFILES: Record<ShockSource, Omit<ShockProfile, "source">> = {
  explosion: { peakDb: 170, durationMs: 150, tinnitusFreqHz: 6000, tinnitusDb: 50, lowPassCutoffHz: 500, lowPassQ: 3, recoveryTimeS: 60, heartRateBpm: 150 },
  naher_schuss: { peakDb: 155, durationMs: 30, tinnitusFreqHz: 4500, tinnitusDb: 40, lowPassCutoffHz: 800, lowPassQ: 2, recoveryTimeS: 30, heartRateBpm: 140 },
  schwert_auf_helm: { peakDb: 140, durationMs: 10, tinnitusFreqHz: 3500, tinnitusDb: 30, lowPassCutoffHz: 1200, lowPassQ: 1.5, recoveryTimeS: 15, heartRateBpm: 130 },
  kanonendonner: { peakDb: 180, durationMs: 300, tinnitusFreqHz: 7000, tinnitusDb: 55, lowPassCutoffHz: 300, lowPassQ: 4, recoveryTimeS: 90, heartRateBpm: 160 },
  magischer_knall: { peakDb: 165, durationMs: 80, tinnitusFreqHz: 8000, tinnitusDb: 45, lowPassCutoffHz: 600, lowPassQ: 2.5, recoveryTimeS: 45, heartRateBpm: 145 },
  donner: { peakDb: 150, durationMs: 200, tinnitusFreqHz: 4000, tinnitusDb: 35, lowPassCutoffHz: 1000, lowPassQ: 2, recoveryTimeS: 25, heartRateBpm: 120 },
  granate: { peakDb: 175, durationMs: 100, tinnitusFreqHz: 6500, tinnitusDb: 52, lowPassCutoffHz: 400, lowPassQ: 3.5, recoveryTimeS: 75, heartRateBpm: 155 },
  schallwand: { peakDb: 160, durationMs: 50, tinnitusFreqHz: 5500, tinnitusDb: 38, lowPassCutoffHz: 900, lowPassQ: 2, recoveryTimeS: 20, heartRateBpm: 125 },
};

const PROSE_TEMPLATES = {
  leicht: {
    german: "Ein scharfes Pfeifen bohrt sich in die Ohren, während die Welt dumpf und fern wird, als höre man sie durch dicke Watte.",
    english: "A sharp whine drills into the ears while the world grows dull and distant, as if heard through thick wool.",
    spanish: "Un agudo silbido taladra los oídos mientras el mundo se vuelve sordo y lejano, como si se oyera a través de espesa lana.",
    french: "Un sifflement perçant perce les oreilles tandis que le monde devient sourd et lointain, comme entendu à travers de la laine épaisse.",
    sensoryDetails: ["hohes Pfeifen", "gedämpfte Umgebungsgeräusche", "eigener Herzschlag hörbar"]
  },
  mittel: {
    german: "Die Explosion reißt die Stille auf. Ein ohrenbetäubendes Rauschen füllt den Kopf, das eigene Atmen donnert wie ein Wasserfall in den Ohren. Die Stimmen der Kameraden klingen wie aus einem tiefen Brunnen.",
    english: "The explosion tears open the silence. A deafening roar fills the head, one's own breathing thunders like a waterfall in the ears. Comrades' voices sound as if from a deep well.",
    spanish: "La explosión rasga el silencio. Un ensordecedor zumbido llena la cabeza, la propia respiración truena como una cascada en los oídos. Las voces de los compañeros suenan como desde un pozo profundo.",
    french: "L'explosion déchire le silence. Un rugissement assourdissant remplit la tête, sa propre respiration tonne comme une cascade dans les oreilles. Les voix des camarades sonnent comme depuis un puits profond.",
    sensoryDetails: ["ohrenbetäubendes Rauschen", "eigenes Atmen als Donnern", "Stimmen wie aus der Ferne", "Herzschlag pochend"]
  },
  schwer: {
    german: "Die Welt erlischt zu einem einzigen, dumpfen Dröhnen wie dickflüssiges Öl. Nur das nasse Hämmern des eigenen Herzschlags bleibt hörbar — ein metronomischer Trommelrhythmus im leeren Schädel. Das hochfrequente Pfeinen beißt sich in die Nervenbahnen, unverlierbar, unausweichlich.",
    english: "The world fades into a single, dull roar like viscous oil. Only the wet hammering of one's own heartbeat remains audible — a metronomic drum rhythm in the empty skull. The high-pitched whine bites into the nerve pathways, inescapable, inevitable.",
    spanish: "El mundo se desvanece en un único zumbido sordo como aceite espeso. Solo el húmedo martilleo del propio latido sigue siendo audible — un ritmo de tambor metronómico en el cráneo vacío. El agudo silbido se clava en las vías nerviosas, inescapable, inevitable.",
    french: "Le monde s'efface en un unique bourdonnement sourd comme de l'huile visqueuse. Seul le martèlement humide de son propre battement de cœur reste audible — un rythme métronomique dans le crâne vide. Le sifflement aigu s'enfonce dans les voies nerveuses, inévitable, inéluctable.",
    sensoryDetails: ["dumpfes Dröhnen wie Öl", "nur eigener Herzschlag hörbar", "hochfrequentes Pfeifen", "zeitliche Dehnung", "Tunnelhörigkeit"]
  },
  extrem: {
    german: "Stille. Absolute, schreiende Stille — und darin ein einziger Ton: ein reines, quälendes Sinus-Signal bei 6000 Hertz, das keine Quelle hat und kein Ende nimmt. Der Körper existiert nicht mehr, nur noch dieses eine Signal, das das Bewusstsein ausfüllt wie flüssiges Quecksilber. Kein Atem, kein Herz, keine Welt. Nur der Ton.",
    english: "Silence. Absolute, screaming silence — and within it a single tone: a pure, tormenting sine wave at 6000 Hz, with no source and no end. The body no longer exists, only this one signal filling consciousness like liquid mercury. No breath, no heart, no world. Only the tone.",
    spanish: "Silencio. Silencio absoluto y gritón — y en él un solo tono: una onda senoidal pura y torturante a 6000 Hz, sin fuente ni fin. El cuerpo ya no existe, solo esta señal que llena la conciencia como mercurio líquido. Ni respiración, ni corazón, ni mundo. Solo el tono.",
    french: "Silence. Silence absolu, hurlant — et dedans un seul son : une onde sinusoïdale pure, torturante, à 6000 Hz, sans source ni fin. Le corps n'existe plus, seul ce signal remplit la conscience comme du mercure liquide. Ni souffle, ni cœur, ni monde. Seulement le son.",
    sensoryDetails: ["absolute Stille", "reiner Sinus-Ton", "kein Körperbewusstsein", "Zeit steht still", "reines Bewusstsein = Ton"]
  },
};

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createShockProfile(source: ShockSource, seed: number = 42): ShockProfile {
  const rng = createSeededRandom(hashString(source + seed));
  const base = SHOCK_PROFILES[source];
  return {
    source,
    peakDb: Math.round(base.peakDb + (rng() - 0.5) * 10),
    durationMs: Math.round(base.durationMs * (0.8 + rng() * 0.4)),
    tinnitusFreqHz: Math.round(base.tinnitusFreqHz * (0.9 + rng() * 0.2)),
    tinnitusDb: Math.round(base.tinnitusDb + (rng() - 0.5) * 10),
    lowPassCutoffHz: Math.round(base.lowPassCutoffHz * (0.85 + rng() * 0.3)),
    lowPassQ: Math.round((base.lowPassQ * (0.8 + rng() * 0.4)) * 10) / 10,
    recoveryTimeS: Math.round(base.recoveryTimeS * (0.7 + rng() * 0.6)),
    heartRateBpm: Math.round(base.heartRateBpm + (rng() - 0.5) * 20),
  };
}

export function simulateAuditoryState(profile: ShockProfile, timeMs: number): AuditoryState {
  const progress = Math.min(1, timeMs / (profile.recoveryTimeS * 1000));
  const shockPhase = timeMs < profile.durationMs;
  const recoveryPhase = timeMs >= profile.durationMs && progress < 1;

  let ambientDb, tinnitusDb, lowPassFreq, heartRateBpm, muffledFactor, ringing;

  if (shockPhase) {
    const shockProgress = timeMs / profile.durationMs;
    ambientDb = lerp(60, 20, shockProgress);
    tinnitusDb = profile.tinnitusDb;
    lowPassFreq = lerp(20000, profile.lowPassCutoffHz, shockProgress);
    heartRateBpm = profile.heartRateBpm;
    muffledFactor = shockProgress;
    ringing = true;
  } else if (recoveryPhase) {
    ambientDb = lerp(20, 60, progress);
    tinnitusDb = lerp(profile.tinnitusDb, 0, progress);
    lowPassFreq = lerp(profile.lowPassCutoffHz, 20000, progress);
    heartRateBpm = lerp(profile.heartRateBpm, 70, progress);
    muffledFactor = 1 - progress;
    ringing = tinnitusDb > 5;
  } else {
    ambientDb = 60;
    tinnitusDb = 0;
    lowPassFreq = 20000;
    heartRateBpm = 70;
    muffledFactor = 0;
    ringing = false;
  }

  return {
    timeMs,
    ambientDb: Math.round(ambientDb),
    tinnitusDb: Math.round(tinnitusDb),
    lowPassFreq: Math.round(lowPassFreq),
    heartRateBpm: Math.round(heartRateBpm),
    muffledFactor: Math.round(muffledFactor * 100) / 100,
    ringing,
  };
}

export function generateShockProse(profile: ShockProfile, language: "de" | "en" | "es" | "fr" = "de"): ShockProse {
  const intensity = profile.peakDb >= 175 ? "extrem" : profile.peakDb >= 160 ? "schwer" : profile.peakDb >= 150 ? "mittel" : "leicht";
  const template = PROSE_TEMPLATES[intensity];
  return {
    german: template.german,
    english: template.english,
    spanish: template.spanish,
    french: template.french,
    intensity,
    sensoryDetails: [...template.sensoryDetails],
  };
}

export function createAudioContextMock(): AudioContext | null {
  if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return null;
}

export function createTinnitusOscillator(ctx: AudioContext, freq: number, gainDb: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = Math.pow(10, (gainDb - 60) / 20);
  osc.connect(gain);
  gain.connect(ctx.destination);
  return osc;
}

export function createLowPassFilter(ctx: AudioContext, cutoff: number, q: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.Q.value = q;
  return filter;
}

export function playShockDemo(profile: ShockProfile, durationMs: number = 5000): Promise<void> {
  return new Promise(resolve => {
    const ctx = createAudioContextMock();
    if (!ctx) {
      console.warn("WebAudio nicht verfügbar");
      resolve();
      return;
    }
    const osc = createTinnitusOscillator(ctx, profile.tinnitusFreqHz, profile.tinnitusDb);
    const filter = createLowPassFilter(ctx, profile.lowPassCutoffHz, profile.lowPassQ);
    osc.connect(filter);
    filter.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close().catch(() => {});
      resolve();
    }, durationMs);
  });
}

export function createSampleProfile(): ShockProfile {
  return createShockProfile("explosion", 42);
}

export function createSampleProse(): ShockProse {
  return generateShockProse(createSampleProfile(), "de");
}

export function createSampleState(): AuditoryState {
  return simulateAuditoryState(createSampleProfile(), 5000);
}