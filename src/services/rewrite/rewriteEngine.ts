// Rewrite Engine (Sprint 26, Agent 3): Textverbesserung mit Techniken.
// Lokal, kein LLM nötig, deterministisch.

export interface RewriteTechnique {
  id: string;
  name: string;
  description: string;
}

export interface RewriteResult {
  original: string;
  rewritten: string;
  technique: string;
  changes: { original: string; replacement: string }[];
}

export const REWRITE_TECHNIQUES: RewriteTechnique[] = [
  { id: "active-voice", name: "Aktiv → Passiv", description: "Aktivsätze in Passiv umwandeln" },
  { id: "simplify", name: "Vereinfachen", description: "Komplexe Sätze kürzer machen" },
  { id: "formal", name: "Formell", description: "Umgangssprache in Fachsprache" },
  { id: "vivid", name: "Lebendig", description: "Starke Verben statt Adjektive" },
  { id: "show-dont-tell", name: "Zeigen nicht Sagen", description: "Gefühle durch Handlungen zeigen" },
];

const ACTIVE_TO_PASSIVE: [RegExp, string][] = [
  [/(\w+) ist (\w+) von (\w+)/g, "$1 wird von $3 $2"],
  [/(\w+) hat (\w+) (\w+)/g, "$1 wird $2 $3"],
  [/(\w+) wird (\w+) haben/g, "$1 wird $2 haben"],
];

const SIMPLIFY_REPLACEMENTS: [RegExp, string][] = [
  [/in der Tat/g, "tatsächlich"],
  [/aufgrund des Umstandes, dass/g, "weil"],
  [/in Anbetracht der Tatsache/g, "weil"],
  [/zu dem Schluss kommen/g, "schlussfolgern"],
  [/kam zu dem Schluss/g, "schlussfolgerte"],
  [/kamen zu dem Schluss/g, "schlussfolgerten"],
  [/in der Lage sein/g, "können"],
  [/in Bezug auf/g, "bezüglich"],
  [/im Hinblick auf/g, "hinsichtlich"],
  [/in Anbetracht/g, "wegen"],
  [/aufgrund/g, "wegen"],
  [/infolge/g, "durch"],
  [/demnach/g, "also"],
  [/folglich/g, "also"],
  [/demzufolge/g, "deshalb"],
  [/insofern/g, "deshalb"],
  [/somit/g, "also"],
  [/mithin/g, "also"],
  [/gleichwohl/g, "trotzdem"],
  [/indessen/g, "trotzdem"],
  [/nichtsdestotrotz/g, "trotzdem"],
  [/dennoch/g, "trotzdem"],
  [/allerdings/g, "aber"],
  [/jedoch/g, "aber"],
  [/hingegen/g, "aber"],
  [/wohingegen/g, "aber"],
  [/während/g, "aber"],
  [/andererseits/g, "aber"],
  [/einerseits/g, "zum einen"],
  [/zum anderen/g, "zum anderen"],
  [/erstere/g, "erstere"],
  [/letztere/g, "letztere"],
  [/erstens/g, "zuerst"],
  [/zweitens/g, "zweitens"],
  [/drittens/g, "drittens"],
  [/schlussendlich/g, "schließlich"],
  [/letztendlich/g, "schließlich"],
  [/zuletzt/g, "schließlich"],
  [/zu guter Letzt/g, "schließlich"],
  [/nicht nur/g, "nicht nur"],
  [/sondern auch/g, "sondern auch"],
  [/sowohl/g, "sowohl"],
  [/als auch/g, "als auch"],
  [/weder/g, "weder"],
  [/noch/g, "noch"],
  [/entweder/g, "entweder"],
  [/oder/g, "oder"],
];

const INFORMAL_TO_FORMAL: [RegExp, string][] = [
  [/geht nicht/g, "ist nicht möglich"],
  [/kriegt/g, "erhält"],
  [/macht/g, "erstellt"],
  [/gibt/g, "bietet"],
  [/sagt/g, "erklärt"],
  [/will/g, "beabsichtigt"],
  [/kann/g, "vermag"],
  [/muss/g, "ist verpflichtet"],
  [/sollte/g, "wäre ratsam"],
  [/könnte/g, "würde in der Lage sein"],
  [/möchte/g, "wünscht"],
  [/braucht/g, "benötigt"],
  [/fehlt/g, "mangelt"],
  [/steht/g, "befindet sich"],
  [/liegt/g, "befindet sich"],
  [/kommt/g, "erscheint"],
  [/sieht/g, "erscheint"],
  [/hört/g, "vernehmbar"],
  [/fühlt/g, "empfindet"],
  [/riecht/g, "duftet"],
  [/schmeckt/g, "hat den Geschmack"],
];

const WEAK_TO_STRONG: [RegExp, string][] = [
  [/sehr gut/g, "exzellent"],
  [/sehr schlecht/g, "katastrophal"],
  [/sehr groß/g, "gewaltig"],
  [/sehr klein/g, "winzig"],
  [/sehr schnell/g, "blitzschnell"],
  [/sehr langsam/g, "schleppend"],
  [/sehr alt/g, "uralt"],
  [/sehr neu/g, "brandneu"],
  [/sehr wichtig/g, "entscheidend"],
  [/sehr interessant/g, "faszinierend"],
  [/sehr langweilig/g, "ermüdend"],
  [/sehr schön/g, "hinreißend"],
  [/sehr hässlich/g, "abscheulich"],
  [/sehr laut/g, "ohrenbetäubend"],
  [/sehr leise/g, "flüsternd"],
  [/sehr warm/g, "brennend"],
  [/sehr kalt/g, "eiskalt"],
  [/sehr hell/g, "blendend"],
  [/sehr dunkel/g, "pechschwarz"],
  [/sehr hart/g, "stahlhart"],
  [/sehr weich/g, "samtig"],
  [/sehr dick/g, "massig"],
  [/sehr dünn/g, "hauchdünn"],
  [/sehr schwer/g, "schwer wie Blei"],
  [/sehr leicht/g, "leicht wie eine Feder"],
  [/sehr kurz/g, "kurz und bündig"],
  [/sehr lang/g, "endlos"],
  [/sehr viel/g, "unzählig"],
  [/sehr wenig/g, "minimal"],
  [/sehr oft/g, "ständig"],
  [/sehr selten/g, "kaum je"],
  [/sehr gut/g, "meisterhaft"],
  [/sehr schlecht/g, "miserabel"],
];

/**
 * Wendet eine Rewrite-Technik auf den Text an.
 */
export function rewriteText(text: string, techniqueId: string): RewriteResult {
  const technique = REWRITE_TECHNIQUES.find((t) => t.id === techniqueId);
  if (!technique) {
    return { original: text, rewritten: text, technique: "unknown", changes: [] };
  }

  let rewritten = text;
  const changes: { original: string; replacement: string }[] = [];

  switch (techniqueId) {
    case "active-voice":
      for (const [pattern, replacement] of ACTIVE_TO_PASSIVE) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            changes.push({ original: match, replacement: match.replace(pattern, replacement) });
          }
          rewritten = rewritten.replace(pattern, replacement);
        }
      }
      break;

    case "simplify":
      for (const [pattern, replacement] of SIMPLIFY_REPLACEMENTS) {
        const matches = rewritten.match(pattern);
        if (matches) {
          for (const match of matches) {
            changes.push({ original: match, replacement });
          }
          rewritten = rewritten.replace(pattern, replacement);
        }
      }
      break;

    case "formal":
      for (const [pattern, replacement] of INFORMAL_TO_FORMAL) {
        const matches = rewritten.match(pattern);
        if (matches) {
          for (const match of matches) {
            changes.push({ original: match, replacement });
          }
          rewritten = rewritten.replace(pattern, replacement);
        }
      }
      break;

    case "vivid":
      for (const [pattern, replacement] of WEAK_TO_STRONG) {
        const matches = rewritten.match(pattern);
        if (matches) {
          for (const match of matches) {
            changes.push({ original: match, replacement });
          }
          rewritten = rewritten.replace(pattern, replacement);
        }
      }
      break;

    case "show-dont-tell":
      // Ersetze "ist/wird" + Adjektiv durch Handlungsbeschreibung
      rewritten = rewritten.replace(/ist traurig/g, "weint");
      rewritten = rewritten.replace(/ist glücklich/g, "strahlt");
      rewritten = rewritten.replace(/ist wütend/g, "ballt die Fäuste");
      rewritten = rewritten.replace(/ist ängstlich/g, "zittert");
      rewritten = rewritten.replace(/ist müde/g, "gähnt");
      rewritten = rewritten.replace(/ist hungrig/g, "knurrt der Magen");
      rewritten = rewritten.replace(/ist durstig/g, "die Kehle ist trocken");
      rewritten = rewritten.replace(/ist krank/g, "hustet");
      rewritten = rewritten.replace(/ist gesund/g, "strahlt vor Gesundheit");
      rewritten = rewritten.replace(/ist schnell/g, "rennt");
      rewritten = rewritten.replace(/ist langsam/g, "schleicht");
      rewritten = rewritten.replace(/ist laut/g, "brüllt");
      rewritten = rewritten.replace(/ist leise/g, "flüstert");
      rewritten = rewritten.replace(/ist warm/g, "schwitzt");
      rewritten = rewritten.replace(/ist kalt/g, "friert");
      rewritten = rewritten.replace(/ist hell/g, "blinzelt");
      rewritten = rewritten.replace(/ist dunkel/g, "tastet");
      rewritten = rewritten.replace(/ist hart/g, "klirrt");
      rewritten = rewritten.replace(/ist weich/g, "wölbt sich");
      rewritten = rewritten.replace(/ist dick/g, "quetscht");
      rewritten = rewritten.replace(/ist dünn/g, "windet sich");
      rewritten = rewritten.replace(/ist schwer/g, "schiebt");
      rewritten = rewritten.replace(/ist leicht/g, "hebt");
      rewritten = rewritten.replace(/ist kurz/g, "stoppt");
      rewritten = rewritten.replace(/ist lang/g, "dehnt sich");
      rewritten = rewritten.replace(/ist viel/g, "häuft");
      rewritten = rewritten.replace(/ist wenig/g, "spart");
      rewritten = rewritten.replace(/ist oft/g, "wiederholt");
      rewritten = rewritten.replace(/ist selten/g, "zögert");
      rewritten = rewritten.replace(/ist gut/g, "glänzt");
      rewritten = rewritten.replace(/ist schlecht/g, "mangelt");
      break;
  }

  return { original: text, rewritten, technique: techniqueId, changes };
}

/**
 * Wendet alle Techniken auf den Text an.
 */
export function rewriteAll(text: string): RewriteResult[] {
  return REWRITE_TECHNIQUES.map((t) => rewriteText(text, t.id));
}
