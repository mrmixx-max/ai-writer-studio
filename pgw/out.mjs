function hashString(input) {
  let h = 2166136261 >>> 0;
  const text = typeof input === "string" ? input : "";
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1) >>> 0;
    t = (t ^ t + Math.imul(t ^ t >>> 7, t | 61)) >>> 0;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(items, rng) {
  if (items.length === 0) {
    throw new Error("pick: leeres Array");
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)];
}
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
const MANIPULATION_TACTICS = [
  {
    id: "realityInversion",
    name: "Realit\xE4ts-Inversion (Gaslighting)",
    description: "Der Manipulator leugnet Ereignisse, verdreht Tatsachen und s\xE4t Zweifel an der Wahrnehmung des Opfers, bis dieses seiner eigenen Erinnerung misstraut.",
    targetEffect: "das Vertrauen des Opfers in die eigene Wahrnehmung zu zerst\xF6ren",
    warningSign: "H\xE4ufige S\xE4tze wie \u201EDas habe ich nie gesagt\u201C oder \u201EDu bildest dir das ein\u201C; das Opfer entschuldigt sich f\xFCr Dinge, die nie geschahen."
  },
  {
    id: "loveBombingWithdrawal",
    name: "Love-Bombing & Entzug",
    description: "\xDCberw\xE4ltigende Zuwendung wechselt ohne Vorwarnung mit K\xE4lte und R\xFCckzug. Die N\xE4he wird zur Belohnung, die der Manipulator jederzeit entziehen kann.",
    targetEffect: "das Opfer durch den Wechsel von N\xE4he und K\xE4lte emotional abh\xE4ngig zu machen",
    warningSign: "Extreme N\xE4he kippt abrupt in Funkstille; das Opfer entschuldigt sich f\xFCr nichtige Anl\xE4sse, um die warme Phase zur\xFCckzuholen."
  },
  {
    id: "darvo",
    name: "T\xE4ter-Opfer-Umkehr (DARVO)",
    description: "Der Manipulator bestreitet die Tat, greift an und stilisiert sich selbst zum Opfer \u2014 wer ihn zur Rede stellt, wird kurzerhand zum T\xE4ter erkl\xE4rt.",
    targetEffect: "jede Anklage in Schuld umzukehren und das Opfer zum T\xE4ter zu erkl\xE4ren",
    warningSign: "Bei jeder Konfrontation wechselt die Rollenverteilung blitzschnell; am Ende entschuldigt sich das Opfer und tr\xF6stet den Angreifer."
  },
  {
    id: "triangulation",
    name: "Triangulation",
    description: "Der Manipulator zieht eine dritte Person oder Instanz hinzu, um Vergleich, Eifersucht und Konkurrenz zu erzeugen und die Bindung zu destabilisieren.",
    targetEffect: "das Opfer durch Vergleich und Eifersucht zu verunsichern und zu isolieren",
    warningSign: "St\xE4ndige Vergleiche (\u201EX h\xE4tte das verstanden\u201C) und Andeutungen, das Opfer sei leicht zu ersetzen."
  }
];
const EXCHANGE_POOLS = {
  realityInversion: {
    manipulator: [
      {
        surface: "Ich sage das nur, weil ich dich liebe, {victim}: So ist es nie gewesen.",
        subtext: "Ich schreibe deine Vergangenheit neu, und du wirst mir glauben."
      },
      {
        surface: "Mach dir keine Sorgen, Schatz. In letzter Zeit verwechselst du einfach Dinge.",
        subtext: "Deine Wahrnehmung ist defekt; ohne mich verlierst du die Wirklichkeit."
      },
      {
        surface: "Ich w\xFCrde dich niemals anl\xFCgen. Vielleicht bist du nur ersch\xF6pft.",
        subtext: "Dein Zweifel an dir selbst ist mein bestes Werkzeug."
      },
      {
        surface: "Ich mache mir Sorgen um dich. Dein Kopf spielt dir manchmal Streiche.",
        subtext: "Ich bin die einzige Quelle der Wahrheit, die dir noch bleibt."
      },
      {
        surface: "Das habe ich nie gesagt \u2014 aber ich verzeihe dir, dass du es so geh\xF6rt hast.",
        subtext: "Selbst dein Geh\xF6r steht gegen dich, also gegen dich selbst."
      }
    ],
    victim: [
      {
        surface: "Vielleicht habe ich mich wirklich get\xE4uscht.",
        subtext: "Ich traue meinem eigenen Ged\xE4chtnis nicht mehr."
      },
      {
        surface: "Es tut mir leid, ich h\xE4tte besser zuh\xF6ren sollen.",
        subtext: "Ich entschuldige mich f\xFCr etwas, das nie geschah."
      },
      {
        surface: "Ich wei\xDF nicht mehr, was stimmt.",
        subtext: "Der Boden unter meiner Wahrnehmung br\xF6ckelt."
      }
    ]
  },
  loveBombingWithdrawal: {
    manipulator: [
      {
        surface: "Du bedeutest mir alles, {victim}. Deshalb brauche ich gerade etwas Zeit f\xFCr mich.",
        subtext: "N\xE4he ist eine Belohnung, die ich dir jederzeit entziehen kann."
      },
      {
        surface: "Ich habe den ganzen Tag an dich gedacht. Warum machst du es mir nur so schwer?",
        subtext: "Meine Zuwendung ist eine Schuld, die du abtragen musst."
      },
      {
        surface: "Ich bin so stolz auf dich \u2014 wenn du nur ein wenig mehr auf mich h\xF6ren w\xFCrdest.",
        subtext: "Du bist nie genug, und das ist deine Aufgabe zu l\xF6sen."
      },
      {
        surface: "Komm her, ich halte dich. Sp\xE4ter muss ich dann aber wirklich allein sein.",
        subtext: "Ich dosiere die W\xE4rme, damit du s\xFCchtig bleibst."
      },
      {
        surface: "Ich liebe dich so sehr, dass es mir Angst macht. Deshalb halte ich Abstand.",
        subtext: "Mein R\xFCckzug ist die Strafe, die dich gef\xFCgig macht."
      }
    ],
    victim: [
      {
        surface: "Ich verstehe, nimm dir die Zeit, die du brauchst.",
        subtext: "Wenn ich nur lieb genug bin, kommt die W\xE4rme zur\xFCck."
      },
      {
        surface: "War es etwas, das ich gesagt habe?",
        subtext: "Ich suche den Fehler immer zuerst bei mir."
      },
      {
        surface: "Ich bin so froh, wenn wir wieder wie fr\xFCher sind.",
        subtext: "Ich klammere an die gute Phase und \xFCbersehe die K\xE4lte."
      }
    ]
  },
  darvo: {
    manipulator: [
      {
        surface: "Ich verstehe, dass du w\xFCtend bist, {victim}. Aber jetzt bin ich diejenige, die leidet.",
        subtext: "Dein Schmerz wird zu meiner Waffe gegen dich."
      },
      {
        surface: "Wie kannst du mir das antun, wo ich doch so viel f\xFCr dich aufgegeben habe?",
        subtext: "Ich erkl\xE4re dich zum T\xE4ter, damit deine Anklage verstummt."
      },
      {
        surface: "Ich wollte nur das Beste f\xFCr uns. Dass du das nicht siehst, bricht mir das Herz.",
        subtext: "Deine Wahrheit verletzt mich \u2014 also ist sie verboten."
      },
      {
        surface: "Bitte, beruhige dich. Du machst mir Angst, wenn du so bist.",
        subtext: "Ich kehre die Rollen um, und du wirst mich tr\xF6sten."
      },
      {
        surface: "Ich bin nicht w\xFCtend auf dich, ich bin nur so entt\xE4uscht.",
        subtext: "Entt\xE4uschung ist meine sanfte Art, dich zu bestrafen."
      }
    ],
    victim: [
      {
        surface: "Es tut mir leid, ich wollte dich nicht verletzen.",
        subtext: "Ich entschuldige mich daf\xFCr, dass ich verletzt wurde."
      },
      {
        surface: "Vielleicht habe ich \xFCberreagiert.",
        subtext: "Ich mache mich selbst zum Angeklagten."
      },
      {
        surface: "Ich m\xF6chte nicht, dass du leidest.",
        subtext: "Ich tr\xF6ste den, der mir wehgetan hat."
      }
    ]
  },
  triangulation: {
    manipulator: [
      {
        surface: "Ich sage das nicht, um dich zu vergleichen, {victim} \u2014 aber X h\xE4tte das sofort verstanden.",
        subtext: "Du bist austauschbar; k\xE4mpfe um deinen Platz."
      },
      {
        surface: "Alle finden, dass du dich ver\xE4ndert hast. Ich verteidige dich ja.",
        subtext: "Ich spreche durch andere, damit du niemandem mehr traust."
      },
      {
        surface: "Ich verbringe Zeit mit ihr, weil sie mich versteht. Du solltest ihr dankbar sein.",
        subtext: "Deine Eifersucht ist das Feuer, das ich sch\xFCre."
      },
      {
        surface: "Du bist etwas ganz Besonderes \u2014 das sagen \xFCbrigens viele.",
        subtext: "Viele beobachten dich, und ich bestimme, was sie sehen."
      },
      {
        surface: "Ich erz\xE4hle dir nur, was er \xFCber dich gesagt hat, damit du es wei\xDFt.",
        subtext: "Ich stelle mich zwischen euch, wo kein Platz ist."
      }
    ],
    victim: [
      {
        surface: "Was hat sie, das ich nicht habe?",
        subtext: "Ich f\xFChle mich austauschbar."
      },
      {
        surface: "Ich versuche doch nur, dir zu gefallen.",
        subtext: "Ich k\xE4mpfe um einen Platz, den ich nie besitze."
      },
      {
        surface: "Ich wei\xDF nicht, wem ich noch glauben kann.",
        subtext: "Selbst meine Verb\xFCndeten werden zu Richtern."
      }
    ]
  }
};
const TACTIC_BASE_ESCALATION = {
  realityInversion: 6,
  loveBombingWithdrawal: 5,
  darvo: 7,
  triangulation: 6
};
const ARC_PHASES = [
  "Ann\xE4herung",
  "Verunsicherung",
  "Bindung",
  "Kontrolle",
  "Isolation",
  "Ersch\xF6pfung",
  "Bruchpunkt"
];
const ARC_PHASE_DESCRIPTIONS = [
  "\xDCberw\xE4ltigende Aufmerksamkeit und Komplimente legen den Grundstein f\xFCr Vertrauen.",
  "Erste Zweifel werden ges\xE4t; kleine Widerspr\xFCche nagen am Selbstbild des Opfers.",
  "Das Opfer sucht die N\xE4he, die es einmal kannte, und beginnt, sich anzupassen.",
  "Der Manipulator bestimmt zunehmend, was das Opfer denken, f\xFChlen und sagen darf.",
  "Das soziale Umfeld wird verd\xE4chtig; Verb\xFCndete werden zu Verr\xE4tern erkl\xE4rt.",
  "Das Opfer ist ausgelaugt, schuldbeladen und kaum noch f\xE4hig, sich zu wehren.",
  "Die Wahrnehmung kippt; das Opfer durchschaut die Dynamik \u2014 oder bricht zusammen."
];
const RECOVERY_SUGGESTIONS = {
  realityInversion: "Vertraute Aufzeichnungen (Tagebuch, Nachrichten, Notizen) als Anker nutzen und die eigene Wahrnehmung durch unabh\xE4ngige Zeugen best\xE4tigen lassen.",
  loveBombingWithdrawal: "Die warmen und kalten Phasen schriftlich festhalten, N\xE4he nicht l\xE4nger durch Anpassung erkaufen und ein eigenes, stabiles Umfeld aufbauen.",
  darvo: "Bei Konfrontationen sachlich bleiben, Verantwortung klar benennen und sich nicht in die Opferrolle dr\xE4ngen lassen; Rollenwechsel dokumentieren.",
  triangulation: "Vergleiche als Manipulationsmittel erkennen, sich nicht in Konkurrenz dr\xE4ngen lassen und die Beziehung direkt statt \xFCber Dritte kl\xE4ren."
};
function resolveTactic(tacticId) {
  if (typeof tacticId === "string") {
    const found = MANIPULATION_TACTICS.find((t) => t.id === tacticId);
    if (found) return found;
  }
  return MANIPULATION_TACTICS[0];
}
function normalizeName(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
function fillTemplate(template, manipulator, victim, context) {
  return template.replace(/\{manipulator\}/g, manipulator).replace(/\{victim\}/g, victim).replace(/\{context\}/g, context);
}
function weaveManipulativeDialogue(input, seed) {
  const tactic = resolveTactic(input?.tacticId);
  const manipulator = normalizeName(input?.manipulatorName, "Manipulator");
  const victim = normalizeName(input?.victimName, "Opfer");
  const context = typeof input?.context === "string" ? input.context.trim() : "";
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;
  const rng = createSeededRandom(
    hashString(`${tactic.id}#${manipulator}#${victim}#${context}#${seedValue}`)
  );
  const pool = EXCHANGE_POOLS[tactic.id] ?? EXCHANGE_POOLS.realityInversion;
  const count = Math.max(6, 6 + Math.floor(rng() * 4));
  const exchanges = [];
  for (let i = 0; i < count; i++) {
    const isManipulator = i % 2 === 0;
    const template = isManipulator ? pick(pool.manipulator, rng) : pick(pool.victim, rng);
    exchanges.push({
      speaker: isManipulator ? manipulator : victim,
      line: fillTemplate(template.surface, manipulator, victim, context),
      subtext: fillTemplate(template.subtext, manipulator, victim, context)
    });
  }
  const base = TACTIC_BASE_ESCALATION[tactic.id] ?? 5;
  const escalationLevel = clamp(Math.round(base + count * 0.3 + rng() * 1.5), 0, 10);
  const contextNote = context.length > 0 ? ` im Kontext \u201E${context}\u201C` : "";
  const subtextSummary = `${tactic.name} \u2014 \xFCber ${exchanges.length} Wortwechsel${contextNote} klingen die S\xE4tze von ${manipulator} warm und besorgt, doch der Subtext arbeitet unabl\xE4ssig daran, ${tactic.targetEffect}.`;
  return {
    tactic: tactic.name,
    exchanges,
    subtextSummary,
    escalationLevel
  };
}
function buildManipulationArc(input, seed) {
  const tactic = resolveTactic(input?.tacticId);
  const requested = Number.isFinite(input?.sceneCount) ? Math.floor(input.sceneCount) : 6;
  const sceneCount = clamp(requested, 2, 12);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : 0;
  const rng = createSeededRandom(hashString(`${tactic.id}#arc#${sceneCount}#${seedValue}`));
  let confidence = 88 + Math.floor(rng() * 8);
  let control = 18 + Math.floor(rng() * 12);
  const scenes = [];
  for (let i = 0; i < sceneCount; i++) {
    const progress = sceneCount > 1 ? i / (sceneCount - 1) : 0;
    if (i > 0) {
      const confDrop = 5 + Math.floor(rng() * 8) + Math.floor(progress * 8);
      const ctrlGain = 6 + Math.floor(rng() * 8) + Math.floor(progress * 8);
      confidence = clamp(confidence - confDrop, 2, 100);
      control = clamp(control + ctrlGain, 0, 98);
    }
    const phaseIndex = clamp(Math.floor(progress * ARC_PHASES.length), 0, ARC_PHASES.length - 1);
    const phase = ARC_PHASES[phaseIndex];
    const phaseDescription = ARC_PHASE_DESCRIPTIONS[phaseIndex];
    const description = `${phase}: ${phaseDescription}`;
    scenes.push({
      sceneNumber: i + 1,
      victimConfidence: confidence,
      manipulatorControl: control,
      description
    });
  }
  const critical = scenes.find((s) => s.victimConfidence <= 30);
  const lowest = scenes.reduce((min, s) => s.victimConfidence < min.victimConfidence ? s : min, scenes[0]);
  const breakingPoint = (critical ?? lowest).sceneNumber;
  const recoverySuggestion = RECOVERY_SUGGESTIONS[tactic.id] ?? "Abstand gewinnen, die Dynamik dokumentieren und Unterst\xFCtzung im eigenen Umfeld suchen.";
  return {
    scenes,
    breakingPoint,
    recoverySuggestion
  };
}
function createSampleDialogue() {
  return weaveManipulativeDialogue(
    {
      tacticId: "realityInversion",
      manipulatorName: "Marlene",
      victimName: "Jonas",
      context: "ein gemeinsames Abendessen"
    },
    42
  );
}
function createSampleArc() {
  return buildManipulationArc({ tacticId: "loveBombingWithdrawal", sceneCount: 6 }, 42);
}
export {
  MANIPULATION_TACTICS,
  buildManipulationArc,
  createSampleArc,
  createSampleDialogue,
  createSeededRandom,
  hashString,
  weaveManipulativeDialogue
};
