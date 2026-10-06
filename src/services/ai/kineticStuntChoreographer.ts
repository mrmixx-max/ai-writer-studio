// KineticStuntChoreographer (WP 75.1)
//
// Berechnet kinetische Parameter für Stunt-Sequenzen und generiert
// Prosa für Action-Montagen. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

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

/** Kinetische Parameter eines Stunts. */
export interface KineticParams {
  speedKmh: number;
  fallHeightM: number;
  massKg: number;
  frictionCoeff: number;
  recoilForceN: number;
  brakingDistanceM: number;
}

/** Ein berechnetes Stunt-Ergebnis. */
export interface StuntResult {
  kineticEnergyKj: number;
  impactForceKn: number;
  fallTimeSec: number;
  maxSpeedKmh: number;
  isSurvivable: boolean;
  description: string;
}

/** Eine Stunt-Montage. */
export interface StuntMontage {
  title: string;
  params: KineticParams;
  result: StuntResult;
  ruleOfCool: number; // 0-100
  prose: string;
}

/** Reibungskoeffizienten für verschiedene Oberflächen. */
export const FRICTION_COEFFS: Record<string, number> = {
  ice: 0.03,
  wet_asphalt: 0.35,
  dry_asphalt: 0.7,
  gravel: 0.55,
  grass: 0.45,
  sand: 0.6,
  metal: 0.25,
  rubber: 0.9,
};

/** Berechnet die kinetische Energie in kJ. */
export function computeKineticEnergy(massKg: number, speedKmh: number): number {
  const speedMs = speedKmh / 3.6;
  return Math.round((0.5 * massKg * speedMs * speedMs) / 1000 * 100) / 100;
}

/** Berechnet die Aufprall-Kraft in kN. */
export function computeImpactForce(massKg: number, speedKmh: number, brakingDistanceM: number): number {
  if (brakingDistanceM <= 0) return 0;
  const speedMs = speedKmh / 3.6;
  const energyJ = 0.5 * massKg * speedMs * speedMs;
  return Math.round((energyJ / brakingDistanceM) / 1000 * 100) / 100;
}

/** Berechnet die Fallzeit in Sekunden. */
export function computeFallTime(fallHeightM: number): number {
  if (fallHeightM <= 0) return 0;
  return Math.round(Math.sqrt((2 * fallHeightM) / 9.81) * 100) / 100;
}

/** Berechnet die maximale Geschwindigkeit nach dem Fall. */
export function computeMaxSpeedAfterFall(fallHeightM: number): number {
  if (fallHeightM <= 0) return 0;
  const speedMs = Math.sqrt(2 * 9.81 * fallHeightM);
  return Math.round(speedMs * 3.6 * 10) / 10;
}

/** Prüft, ob ein Stunt überlebbar ist. */
export function isSurvivable(result: StuntResult): boolean {
  return result.impactForceKn < 50 && result.fallTimeSec < 5;
}

/** Berechnet einen vollständigen Stunt. */
export function computeStunt(params: KineticParams): StuntResult {
  const ke = computeKineticEnergy(params.massKg, params.speedKmh);
  const impact = computeImpactForce(params.massKg, params.speedKmh, params.brakingDistanceM);
  const fallTime = computeFallTime(params.fallHeightM);
  const maxSpeed = computeMaxSpeedAfterFall(params.fallHeightM);
  const survivable = impact < 50 && fallTime < 5;

  let description: string;
  if (survivable) {
    description = "Der Stunt ist physikalisch überlebbar, aber spektakulär genug für das Kino.";
  } else if (impact < 100) {
    description = "Der Stunt ist extrem gefährlich — nur mit Spezialeffekten oder Stuntman durchführbar.";
  } else {
    description = "Der Stunt ist tödlich — Hollywood-Physik erforderlich.";
  }

  return {
    kineticEnergyKj: ke,
    impactForceKn: impact,
    fallTimeSec: fallTime,
    maxSpeedKmh: maxSpeed,
    isSurvivable: survivable,
    description,
  };
}

/** Generiert eine Stunt-Montage. */
export function generateStuntMontage(
  title: string,
  params: KineticParams,
  ruleOfCool: number = 50,
): StuntMontage {
  const result = computeStunt(params);

  const coolFactor = ruleOfCool / 100;
  const speedDesc = params.speedKmh > 100 ? "rasend" : params.speedKmh > 50 ? "schnell" : "gemächlich";
  const heightDesc = params.fallHeightM > 50 ? "hauchdünn" : params.fallHeightM > 10 ? "bedrohlich" : "winzig";

  const proseParts: string[] = [];
  proseParts.push(`Der ${speedDesc} Ansturm — ${params.speedKmh} km/h — durchbricht jede Vorstellung von Tempo.`);
  if (params.fallHeightM > 0) {
    proseParts.push(`Dann der Absturz: ${params.fallHeightM} Meter in die Tiefe, ${heightDesc}, die Schwerkraft zieht mit voller Wucht.`);
  }
  if (params.frictionCoeff < 0.3) {
    proseParts.push(`Der Boden ist glatt wie Eis — Reibung ${params.frictionCoeff}, kein Halt, kein Ausweg.`);
  } else if (params.frictionCoeff > 0.7) {
    proseParts.push(`Der Boden bietet Grip — Reibung ${params.frictionCoeff}, aber der Impuls ist trotzdem überwältigend.`);
  }
  if (result.impactForceKn > 50) {
    proseParts.push(`Der Aufprall: ${result.impactForceKn} kN — das ist kein mehr ein Stunt, sondern ein Kampf gegen die Physik.`);
  }
  if (coolFactor > 0.7) {
    proseParts.push(`Hollywood-Physik greift: Der Held steht auf, schüttelt den Staub ab und weiter geht's.`);
  } else if (coolFactor < 0.3) {
    proseParts.push(`Knallharte Realität: Jeder Impuls, jede Ermüdung, jede Beinahe-Katastrophe wird gezeigt.`);
  }

  return {
    title,
    params,
    result,
    ruleOfCool,
    prose: proseParts.join(" "),
  };
}

/** Formatiert eine Stunt-Montage als Text. */
export function formatStuntMontage(montage: StuntMontage): string {
  const lines: string[] = [];
  lines.push(`=== STUNT-MONTAGE: ${montage.title} ===`);
  lines.push(`Rule of Cool: ${montage.ruleOfCool}%`);
  lines.push(`Kinetische Energie: ${montage.result.kineticEnergyKj} kJ`);
  lines.push(`Aufprall-Kraft: ${montage.result.impactForceKn} kN`);
  lines.push(`Fallzeit: ${montage.result.fallTimeSec} s`);
  lines.push(`Max. Geschwindigkeit: ${montage.result.maxSpeedKmh} km/h`);
  lines.push(`Überlebbar: ${montage.result.isSurvivable ? "Ja" : "Nein"}`);
  lines.push(`Beschreibung: ${montage.result.description}`);
  lines.push("");
  lines.push(montage.prose);
  return lines.join("\n");
}

/** Generiert eine Beispiel-Montage. */
export function createSampleMontage(): StuntMontage {
  return generateStuntMontage(
    "Verfolgungsjagd auf dem Zugdach",
    {
      speedKmh: 120,
      fallHeightM: 15,
      massKg: 75,
      frictionCoeff: 0.35,
      recoilForceN: 500,
      brakingDistanceM: 2,
    },
    70,
  );
}
