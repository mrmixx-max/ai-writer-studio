// ForensicPathologyEngine (WP 114.1, Meilenstein 55.0, v6.7.0)
// Forensische Pathologie & Todeszeit-Kalkulator für Krimi-/Thriller-Fiktion.
// Henssge-Formel (Todeszeit), Totenstarre, Totenflecke, Sektionsbericht.
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
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// 1. Todeszeit-Kalkulator (Henssge-Formel)
// ---------------------------------------------------------------------------

export type ClothingType = "none" | "normal" | "heavy" | "wet";

export interface TimeOfDeathOptions {
  rectalTempC: number;
  ambientTempC: number;
  bodyWeightKg: number;
  clothing: ClothingType;
  isInWater: boolean;
}

export interface TimeOfDeathResult {
  hoursSinceDeath: number;
  timeWindowLow: number;
  timeWindowHigh: number;
  method: string;
  notes: string;
}

// Bekleidungskorrektur: schwere Kleidung isoliert (langsamere Abkühlung),
// nasse Kleidung beschleunigt durch Verdunstungskälte.
const CLOTHING_FACTORS: Record<ClothingType, number> = {
  none: 1.05,
  normal: 1.0,
  heavy: 0.92,
  wet: 1.15,
};

const CLOTHING_LABELS: Record<ClothingType, string> = {
  none: "unbekleidet",
  normal: "normal bekleidet",
  heavy: "schwer bekleidet (Winterkleidung)",
  wet: "durchnässt",
};

/**
 * Schätzt die Todeszeit nach der vereinfachten Henssge-Formel:
 *   Stunden seit Tod = (37,2 - Rektaltemperatur) / (0,83 * Abkühlfaktor) - 3
 * Der Abkühlfaktor wird aus Bekleidung, Körpergewicht, Umgebungstemperatur
 * und Wasserlagerung abgeleitet.
 */
export function calculateTimeOfDeath(options: TimeOfDeathOptions): TimeOfDeathResult {
  const { rectalTempC, ambientTempC, bodyWeightKg, clothing, isInWater } = options;

  const clothingFactor = CLOTHING_FACTORS[clothing] ?? 1.0;
  // Schwere Körper isolieren Wärme: höheres Gewicht senkt den Abkühlfaktor.
  const weightFactor = clamp(1 - (bodyWeightKg - 70) / 400, 0.7, 1.15);
  // Kalte Umgebung beschleunigt die Auskühlung.
  const ambientFactor = clamp(1 + (23 - ambientTempC) / 150, 0.75, 1.4);
  // Wasser entzieht Wärme rund viermal schneller als ruhende Luft.
  const waterFactor = isInWater ? 1.3 : 1.0;

  const coolingFactor = clothingFactor * weightFactor * ambientFactor * waterFactor;

  let hoursSinceDeath = 0;
  if (rectalTempC < 37.2) {
    hoursSinceDeath = (37.2 - rectalTempC) / (0.83 * coolingFactor) - 3;
  }
  hoursSinceDeath = Math.max(0, round1(hoursSinceDeath));

  // Streubereich: Kälte-Einwirkung und Gewebebeschaffenheit erzeugen Unsicherheit.
  const timeWindowLow = Math.max(0, round1(hoursSinceDeath * 0.85 - 0.5));
  const timeWindowHigh = round1(hoursSinceDeath * 1.2 + 1);

  const noteParts: string[] = [];
  noteParts.push(`Bekleidung: ${CLOTHING_LABELS[clothing]}.`);
  noteParts.push(`Körpergewicht ${bodyWeightKg} kg (Gewichtskorrektur ${weightFactor.toFixed(3)}).`);
  noteParts.push(`Umgebungstemperatur ${ambientTempC} °C (Umgebungskorrektur ${ambientFactor.toFixed(3)}).`);
  if (isInWater) {
    noteParts.push("Wasserlagerung beschleunigt die Auskühlung deutlich.");
  }
  if (rectalTempC >= 37.2) {
    noteParts.push("Rektaltemperatur nicht unter Normwert — Todeszeit rechnerisch nicht bestimmbar.");
  } else if (rectalTempC >= 32) {
    noteParts.push("Frühe Abkühlphase: Schätzung mit erhöhter Streubreite.");
  } else if (rectalTempC <= 22) {
    noteParts.push("Späte Abkühlphase: Umgebungstemperatur dominiert, Schätzung unsicher.");
  }
  noteParts.push(`Wirksamer Abkühlfaktor: ${coolingFactor.toFixed(3)}.`);

  return {
    hoursSinceDeath,
    timeWindowLow,
    timeWindowHigh,
    method: "Henssge-Formel (vereinfachtes Nomogramm, 0,83-Konstante)",
    notes: noteParts.join(" "),
  };
}

export function createSampleTimeOfDeath(): TimeOfDeathResult {
  return calculateTimeOfDeath({
    rectalTempC: 29.4,
    ambientTempC: 18,
    bodyWeightKg: 72,
    clothing: "normal",
    isInWater: false,
  });
}

// ---------------------------------------------------------------------------
// 2. Totenstarre (Rigor Mortis)
// ---------------------------------------------------------------------------

export type RigorPhase = "none" | "beginning" | "full" | "fading" | "resolved";

export interface RigorMortisResult {
  phase: RigorPhase;
  jawStiffness: number;
  limbStiffness: number;
  notes: string;
}

const RIGOR_LABELS: Record<RigorPhase, string> = {
  none: "keine Totenstarre",
  beginning: "beginnende Totenstarre",
  full: "vollständige Totenstarre",
  fading: "nachlassende Totenstarre",
  resolved: "gelöste Totenstarre",
};

/**
 * Leitet die Totenstarre aus den Stunden seit dem Tod ab.
 * Kiefer beginnt nach 2-4 h, vollständige Starre bei ~12 h,
 * Lösung zwischen 36 und 48 h.
 */
export function calculateRigorMortis(hoursSinceDeath: number): RigorMortisResult {
  const h = Math.max(0, hoursSinceDeath);

  let phase: RigorPhase;
  if (h < 2) {
    phase = "none";
  } else if (h < 12) {
    phase = "beginning";
  } else if (h < 36) {
    phase = "full";
  } else if (h < 48) {
    phase = "fading";
  } else {
    phase = "resolved";
  }

  // Kiefer versteift zuerst (2-12 h), Extremitäten folgen mit Verzögerung.
  const jawStiffness =
    h < 2 ? 0 : h < 12 ? clamp((h - 2) / 10, 0, 1) : h < 36 ? 1 : clamp((48 - h) / 12, 0, 1);
  const limbStiffness =
    h < 4 ? 0 : h < 12 ? clamp((h - 4) / 8, 0, 1) : h < 36 ? 1 : clamp((48 - h) / 14, 0, 1);

  let notes = `Befund: ${RIGOR_LABELS[phase]} nach ${round1(h)} h. `;
  if (phase === "beginning") {
    notes += "Kiefergelenk zunehmend steif, große Gelenke noch beweglich.";
  } else if (phase === "full") {
    notes += "Alle Gelenke fest, Körperhaltung fixiert — Lagerung nach Todeseintritt möglich.";
  } else if (phase === "fading") {
    notes += "Starre löst sich zuerst an den Beinen, Gelenke wieder passiv beweglich.";
  } else if (phase === "resolved") {
    notes += "Muskulatur vollständig erschlafft; erneute Starre nach Manipulation beachten.";
  } else {
    notes += "Noch keine Starre nachweisbar; früher Todeseintritt oder atypische Umstände.";
  }
  notes += ` Kiefersteifigkeit ${(jawStiffness * 100).toFixed(0)} %, Extremitätensteifigkeit ${(limbStiffness * 100).toFixed(0)} %.`;

  return {
    phase,
    jawStiffness: Math.round(jawStiffness * 1000) / 1000,
    limbStiffness: Math.round(limbStiffness * 1000) / 1000,
    notes,
  };
}

// ---------------------------------------------------------------------------
// 3. Totenflecke (Livor Mortis)
// ---------------------------------------------------------------------------

export type LivorPhase = "notStarted" | "blanching" | "fixed" | "nonBlanching";

export interface LivorMortisResult {
  phase: LivorPhase;
  blanchable: boolean;
  color: string;
  notes: string;
}

export interface TransportCheckResult {
  bodyMoved: boolean;
  interpretation: string;
  notes: string;
}

const LIVOR_LABELS: Record<LivorPhase, string> = {
  notStarted: "noch keine Totenflecke",
  blanching: "wegdrückbare Totenflecke",
  fixed: "beginnend fixierte Totenflecke",
  nonBlanching: "nicht wegdrückbare Totenflecke",
};

/**
 * Leitet die Totenflecke aus den Stunden seit dem Tod ab.
 * Kein Beginn vor 0,5 h, wegdrückbar 0,5-8 h, Fixierung ab 8-12 h,
 * danach vollständig nicht wegdrückbar.
 */
export function calculateLivorMortis(hoursSinceDeath: number): LivorMortisResult {
  const h = Math.max(0, hoursSinceDeath);

  let phase: LivorPhase;
  if (h < 0.5) {
    phase = "notStarted";
  } else if (h < 8) {
    phase = "blanching";
  } else if (h < 12) {
    phase = "fixed";
  } else {
    phase = "nonBlanching";
  }

  const blanchable = phase === "blanching";

  let color: string;
  if (phase === "notStarted") {
    color = "hautfarben blass (keine livide Verfärbung)";
  } else if (phase === "blanching") {
    color = "livide blassrot bis dunkelrot";
  } else if (phase === "fixed") {
    color = "satt livide, fleckig konfluierend";
  } else {
    color = "dunkelviolett bis blaugrau";
  }

  let notes = `Befund: ${LIVOR_LABELS[phase]} nach ${round1(h)} h. `;
  if (phase === "notStarted") {
    notes += "Früheste Phase — nur wenige Minuten bis maximal halbe Stunde vergangen.";
  } else if (phase === "blanching") {
    notes += "Flecke durch Daumendruck vollständig wegdrückbar; Umlagerung noch möglich.";
  } else if (phase === "fixed") {
    notes += "Flecke nur teilweise wegdrückbar; Fixierung im Gange.";
  } else {
    notes += "Flecke bleiben auf Druck unverändert; Lagerung als gesichert anzunehmen.";
  }
  notes += ` Färbung: ${color}.`;

  return { phase, blanchable, color, notes };
}

/**
 * Prüft anhand des Totenfleckmusters, ob der Leichnam nach dem Tod
 * umgelagert wurde. Ein reines Muster spricht für unveränderte Lage,
 * gemischte oder fehlende Flecke für einen Transport.
 */
export function transportCheck(blanchPattern: "livid" | "mixed" | "absent"): TransportCheckResult {
  if (blanchPattern === "livid") {
    return {
      bodyMoved: false,
      interpretation: "Regelrechtes Totenfleckmuster entsprechend der Auffindelage.",
      notes: "Einheitliche livide Verfärbung an den tiefsten Körperstellen — kein Hinweis auf Umlagerung.",
    };
  }
  if (blanchPattern === "mixed") {
    return {
      bodyMoved: true,
      interpretation: "Gemischtes Totenfleckmuster — widersprüchliche Verteilung.",
      notes:
        "Nebeneinander liegende Fleckareale in unterschiedlichen Körperregionen " +
        "sprechen für eine Umlagerung des Leichnams nach Eintritt der Flecken.",
    };
  }
  return {
    bodyMoved: true,
    interpretation: "Fehlende Totenflecke trotz fortgeschrittener Liegezeit.",
    notes:
      "Kein nachweisbares Fleckmuster — verdächtig auf Transport, " +
      "starken Blutverlust oder konkurrierende Intoxikation.",
  };
}

// ---------------------------------------------------------------------------
// 4. Sektionsbericht-Generator
// ---------------------------------------------------------------------------

const EXAMINERS: string[] = [
  "Dr. med. Konrad Weißmann",
  "Dr. med. Helena Vosskamp",
  "Dr. med. Berthold Aichinger",
  "Dr. med. Miriam Steinhardt",
  "Dr. med. Ferdinand Löwenstein",
];

const INSTITUTES: string[] = [
  "Institut für Rechtsmedizin, Universitätsklinikum",
  "Landesinstitut für gerichtliche Medizin",
  "Zentrum für forensische Pathologie",
];

const EXTERNAL_TEMPLATES: string[] = [
  "Leichenflecke an den abhängigen Körperpartien (Rücken, Nacken, Gesäß) ausgeprägt.",
  "Hautblässe mit beginnender grünlicher Verfärbung im rechten Unterbauch.",
  "Mehrere punktförmige Einblutungen (Petechien) in den Lidbindehäuten.",
  "Deutliche Trockenheit der Hornhäute beider Augen mit ersten Trübungszeichen.",
  "Schürfwunden an den Knien und Handflächen, vital durchblutet.",
  "Hämatom an der linken Schläfe, Ausdehnung ca. 6 x 4 cm.",
  "Leichte livide Verfärbung der Lippen und der Fingerspitzen.",
  "Narbengewebe am rechten Unterarm, älteren Datums.",
  "Nagelbettverletzungen unter zwei Fingernägeln der rechten Hand.",
  "Zungenbiss mit Einblutung an der linken Zungenkante.",
];

const INTERNAL_TEMPLATES: string[] = [
  "Herzgewicht 340 g, Muskelwand unauffällig, Koronararterien ohne relevante Stenose.",
  "Lungen beidseits gebläht, dunkelrot, Gewicht rechts 620 g, links 580 g.",
  "Magen mit ca. 200 ml zähflüssigem Speisebrei gefüllt, Schleimhaut unauffällig.",
  "Leber 1.550 g, glatte Oberfläche, homogen braunrot, Schnittfläche unauffällig.",
  "Milz 130 g, weiche Konsistenz, rote Pulpa unauffällig.",
  "Nieren beidseits 150 g, glatte Kapsel, Rinde und Mark scharf abgegrenzt.",
  "Schädelkalotte unverletzt, Hirngewicht 1.380 g, Hirnhäute zart.",
  "Kehlkopf und Luftröhre frei, Schleimhaut leicht gerötet.",
  "Blutleere der großen venösen Gefäße des Unterleibs.",
  "Feingewebliche Untersuchung zeigt vitale Reaktionen im Randbereich der Verletzung.",
];

const TOX_TEMPLATES: string[] = [
  "Alkoholgehalt der Blutprobe: 1,4 Promille.",
  "Toxikologie: keine auffälligen Befunde, weiteres Ergebnis ausstehend.",
  "Blutalkohol 0,6 Promille, zusätzlich Spuren eines Schlafmittels.",
  "Toxikologischer Befund unauffällig für gängige Substanzen.",
];

const REMARK_TEMPLATES: string[] = [
  "Die Obduktion wurde im Beisein der ermittelnden Beamtin durchgeführt.",
  "Gewebeproben zur feingeweblichen und toxikologischen Untersuchung asserviert.",
  "Identität des Verstorbenen durch Fingerabdrücke gesichert.",
  "Körper wurde nach fotografischer Dokumentation freigegeben.",
  "Zeitpunkt des Todeseintritts nach Aktenlage mit dem pathologischen Befund konsistent.",
];

function section(title: string, body: string): string {
  const line = "─".repeat(Math.max(20, title.length + 4));
  return `${line}\n${title.toUpperCase()}\n${line}\n${body}`;
}

/**
 * Erzeugt einen authentisch-klinischen Sektionsbericht.
 * Alle Zufallselemente sind über den Seed deterministisch.
 */
export function generateAutopsyReport(causeOfDeath: string, findings: string[], seed: number): string {
  const rng = createSeededRandom(hashString(`autopsy:${causeOfDeath}:${seed}`));

  const examiner = pick(EXAMINERS, rng);
  const institute = pick(INSTITUTES, rng);
  const caseNo = `${new Date(2024, 0, 1).getFullYear()}-${String(hashString(causeOfDeath + seed) % 100000).padStart(5, "0")}`;
  const day = 1 + Math.floor(rng() * 28);
  const month = 1 + Math.floor(rng() * 12);
  const hour = String(Math.floor(rng() * 24)).padStart(2, "0");
  const minute = String(Math.floor(rng() * 60)).padStart(2, "0");
  const durationMin = 55 + Math.floor(rng() * 90);

  // Zusammenstellung der Befundabschnitte.
  const external: string[] = [];
  const externalCount = 3 + Math.floor(rng() * 3);
  const extUsed = new Set<number>();
  let guard = 0;
  while (external.length < externalCount && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * EXTERNAL_TEMPLATES.length);
    if (extUsed.has(idx)) continue;
    extUsed.add(idx);
    external.push(EXTERNAL_TEMPLATES[idx]);
  }

  const internal: string[] = [];
  const internalCount = 4 + Math.floor(rng() * 3);
  const intUsed = new Set<number>();
  guard = 0;
  while (internal.length < internalCount && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * INTERNAL_TEMPLATES.length);
    if (intUsed.has(idx)) continue;
    intUsed.add(idx);
    internal.push(INTERNAL_TEMPLATES[idx]);
  }

  const extraFindings = findings.filter((f) => f.trim().length > 0);
  const tox = pick(TOX_TEMPLATES, rng);
  const remark = pick(REMARK_TEMPLATES, rng);

  const protocol = [
    `Fall-Nr.:  ${caseNo}`,
    `Institut:  ${institute}`,
    `Obduzent:  ${examiner}`,
    `Datum:     ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${new Date(2024, 0, 1).getFullYear()}, ${hour}:${minute} Uhr`,
    `Dauer:     ${durationMin} Minuten`,
    "Art:       gerichtliche Obduktion gemäß § 87 StPO",
  ].join("\n");

  const externalBody =
    external.map((line, i) => `${i + 1}. ${line}`).join("\n") +
    (extraFindings.length > 0
      ? "\n" + extraFindings.map((f, i) => `${external.length + i + 1}. ${f}`).join("\n")
      : "");

  const internalBody = internal.map((line, i) => `${i + 1}. ${line}`).join("\n");

  const causeBody =
    `Als Todesursache wird festgestellt: ${causeOfDeath}.\n` +
    "Der Todeseintritt wird auf den obduktionsgestützten Befund abgestellt; " +
    "die Todesart wird nach Würdigung aller Befunde beurteilt.";

  const remarkBody = [tox, remark, "Für Rückfragen steht der Obduzent zur Verfügung."].join("\n");

  return [
    section("Obduktionsprotokoll", protocol),
    section("Äußerer Befund", externalBody),
    section("Innerer Befund", internalBody),
    section("Todesursache", causeBody),
    section("Bemerkungen", remarkBody),
  ].join("\n\n");
}

export function createSampleAutopsyReport(): string {
  return generateAutopsyReport(
    "Akute Herzinsuffizienz infolge stumpfer Gewalteinwirkung gegen den Thorax",
    ["Rippenfrakturen 5-7 links mit umgebendem Hämatom", "Bluterguss in der linken Pleurahöhle"],
    42,
  );
}
