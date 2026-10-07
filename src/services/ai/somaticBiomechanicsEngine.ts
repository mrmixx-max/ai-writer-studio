// SomaticBiomechanicsEngine (WP 92.1)
// Somatische Biomechanik & Nervensystem-Engine.
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

export type AutonomicState = "sympathetic_fight" | "sympathetic_flight" | "parasympathetic_freeze" | "cold_flow";

export interface SomaticCascade {
  vasoconstriction: string;
  sensoryNarrowing: string;
  visceralReflex: string;
}

export interface SomaticProfile {
  id: string;
  autonomicState: AutonomicState;
  trigger: string;
  cascade: SomaticCascade;
  intensity: number; // 1-10
  proseInjection: string;
  seed: number;
}

const AUTONOMIC_STATES: AutonomicState[] = [
  "sympathetic_fight",
  "sympathetic_flight",
  "parasympathetic_freeze",
  "cold_flow",
];

const STATE_LABELS: Record<AutonomicState, { label: string; description: string }> = {
  sympathetic_fight: {
    label: "⚔️ Sympathischer Kampf",
    description: "Adrenalin-Tunnel, offensive Aggression",
  },
  sympathetic_flight: {
    label: "🏃 Sympathische Flucht",
    description: "Panik-getriebene Flucht, maximaler Output",
  },
  parasympathetic_freeze: {
    label: "🧊 Parasympathisches Erstarren",
    description: "Totenstarre, Dissoziation, Schock",
  },
  cold_flow: {
    label: "🧠 Kaltblütiger Flow",
    description: "Kontrollierte Erregung, präzise Execution",
  },
};

const VASOCONSTRICTION = [
  "Eiskalte, taube Fingerspitzen",
  "Aschfahles, wächsernes Gesicht",
  "Pulsierendes Weißen der Knöchel",
  "Kalte Schweißperlen auf der Stirn",
  "Blasse Lippen, bläuliche Nagelbetten",
  "Zitternde Hände trotz innerer Hitze",
];

const SENSORY_NARROWING = [
  "Pulsrauschen im Ohr, alles andere stumm",
  "Tunnelblick – Peripherie ausgeblendet",
  "Schärfester Fokus auf eine einzige Bewegung",
  "Geruch von Kupfer und Ozon in der Nase",
  "Geschmack von Blut auf der Zunge",
  "Zeitdehnung: Sekunden wie Minuten",
];

const VISCERAL_REFLEX = [
  "Trockener Schlund, unmöglich zu schlucken",
  "Magenkrampf wie ein Faustschlag von innen",
  "Zittern im Daumenansatz, unkontrollierbar",
  "Atemstillstand im Moment der Entscheidung",
  "Darmkrampf, drängendes Bedürfnis",
  "Herzschlag bis in die Schläfen spürbar",
];

const PROSE_TEMPLATES: Record<AutonomicState, string[]> = {
  sympathetic_fight: [
    "Seine Finger schlossen sich um den Griff, kalt und tot, doch der Griff war eisern.",
    "Das Rauschen in seinen Ohren wurde zum Kriegslärm, jedes Haar stand zu Berge.",
    "Er atmete nicht. Er wartete. Der Daumen zuckte – der einzige Verräter seiner Ruhe.",
  ],
  sympathetic_flight: [
    "Die Kehle zuschnürend, der Magen ein geknotetes Seil, rannte er, bevor er denken konnte.",
    "Peripheres Sehen weg. Nur der Ausgang. Der Puls in den Ohren der einzige Takt.",
    "Die Finger kribbelten taub, als würde Strom durch sie fließen – laufen, nur laufen.",
  ],
  parasympathetic_freeze: [
    "Kein Atem. Kein Gedanke. Nur das Rauschen im Schädel, während die Welt in Zeitlupe zerfiel.",
    "Der Körper gehorchte nicht mehr. Ein Marmorblock aus Fleisch, kalter Schweiß auf marmornem Teint.",
    "Die Knie weich, der Schlund trocken wie Wüstensand – ein Puppenmensch ohne Fäden.",
  ],
  cold_flow: [
    "Kein Zittern. Kein Rauschen. Nur die klare, kalte Mathematik der nächsten Bewegung.",
    "Puls sechzig. Atem rhythmisch. Die Welt auf eine Linie reduziert: Ziel, Weg, Ausführung.",
    "Adrenalin ja, aber gezähmt. Ein Reitpferd, das der Reiter im Schlaf lenkt."
  ]
};

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createSomaticProfile(trigger: string, seed: number = 42): SomaticProfile {
  const rng = createSeededRandom(hashString(trigger + seed));
  const autonomicState = pickRandom(AUTONOMIC_STATES, rng);
  const _stateInfo = STATE_LABELS[autonomicState];
  
  const cascade: SomaticCascade = {
    vasoconstriction: pickRandom(VASOCONSTRICTION, rng),
    sensoryNarrowing: pickRandom(SENSORY_NARROWING, rng),
    visceralReflex: pickRandom(VISCERAL_REFLEX, rng),
  };

  const intensity = 5 + Math.floor(rng() * 6); // 5-10
  const proseInjection = pickRandom(PROSE_TEMPLATES[autonomicState], rng);

  return {
    id: `SOM-${hashString(trigger + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    autonomicState,
    trigger,
    cascade,
    intensity,
    proseInjection,
    seed,
  };
}

export function injectSomaticProse(mentalProse: string, somaticProfile: SomaticProfile): string {
  return `${mentalProse} ${somaticProfile.proseInjection}`;
}

export function formatSomaticProfile(profile: SomaticProfile): string {
  const stateInfo = STATE_LABELS[profile.autonomicState];
  return [
    `🧬 SOMATISCHES PROFIL: ${profile.trigger}`,
    `ID: ${profile.id} | Zustand: ${stateInfo.label}`,
    `Intensität: ${profile.intensity}/10`,
    `Beschreibung: ${stateInfo.description}`,
    "",
    `📉 VASOKONSTRIKTION: ${profile.cascade.vasoconstriction}`,
    `👁️ SENSORISCHE VERENGERUNG: ${profile.cascade.sensoryNarrowing}`,
    `🫀 VISCERALER REFLEX: ${profile.cascade.visceralReflex}`,
    "",
    `✍️ PROSA-INJEKTION:`,
    `  "${profile.proseInjection}"`,
  ].join("\n");
}

export function createSampleProfile(): SomaticProfile {
  return createSomaticProfile("Duell bei Sonnenaufgang", 42);
}

export function createSampleInjection(): string {
  const profile = createSampleProfile();
  return injectSomaticProse("Er dachte an den morgigen Tag.", profile);
}