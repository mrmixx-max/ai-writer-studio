/**
 * Synästhesie-Matrix-Service — WP 36.1 (Sensorische Matrix & Cross-Modale Beschreibung)
 *
 * Lokaler, deterministischer Service zur Analyse sensorischer Kanäle in Texten,
 * zur Erkennung sensorisch verarmter Kapitel und zur Generierung
 * cross-modaler Beschreibungsvorschläge.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SenseClassification {
  visual: number;
  auditory: number;
  olfactory: number;
  gustatory: number;
  tactile: number;
}

export interface ChapterBalance {
  index: number;
  balance: SenseClassification;
  warning?: string;
}

export interface SensoryRadar {
  chapters: ChapterBalance[];
  overallBalance: SenseClassification;
}

export interface SynesthesiaSuggestion {
  concept: string;
  suggestions: string[];
}

// ─── Sensorischer Wortschatz ─────────────────────────────────────────────────

const VISUAL_WORDS = new Set([
  'sehen', 'schauen', 'blicken', 'betrachten', 'ansehen', 'farbe', 'rot', 'blau',
  'grün', 'gelb', 'schwarz', 'weiß', 'hell', 'dunkel', 'leuchten', 'glänzen',
  'schimmern', 'schatten', 'licht', 'bild', 'form', 'gestalt', 'schön', 'hässlich',
  'groß', 'klein', 'weit', 'nah', 'ferne', 'horizont', 'himmel', 'stern', 'sonne',
  'mond', 'feuer', 'flamme', 'glühen', 'funkeln', 'strahlen', 'farbig', 'bunt',
  'muster', 'linie', 'kreis', 'eckig', 'sichtbar', 'unsichtbar', 'klar', 'neblig',
  'spiegel', 'reflektieren', 'schimmer', 'glanz', 'augen', 'blick', 'panorama',
  'szenerie', 'architektur', 'gebäude', 'turm', 'fenster', 'tür', 'landschaft',
  'wald', 'berg', 'fluss', 'meer', 'welle', 'wolke', 'regen', 'schnee', 'eis',
  'kristall', 'schmuck', 'gold', 'silber', 'metall', 'glas', 'schrift', 'lesen',
  'buch', 'seite', 'wort', 'maler', 'gemälde', 'skulptur', 'kunst', 'design',
  'mode', 'kleid', 'stoff', 'textil', 'kino', 'film', 'foto', 'kamera',
  'schönheit', 'ästhetik', 'harmonie', 'kontrast', 'perspektive', 'tiefe',
  'höhe', 'breite', 'länge', 'silhouette', 'umriss', 'kontur', 'farbton',
  'nuance', 'schattierung', 'tönung', 'leuchte', 'lampe', 'kerze', 'glitzernd',
  'strahlend', 'blank', 'matt', 'glänzend', 'transparent', 'durchsichtig',
  'opak', 'dicht', 'dünn', 'dick', 'schmal', 'breit', 'eng', 'weitläufig',
  'hoch', 'niedrig', 'tief', 'flach', 'steil', 'ebene', 'hügelig', 'tal',
  'gipfel', 'basis', 'fundament', 'grund', 'decke', 'wand', 'boden', 'tisch',
  'stuhl', 'sitz', 'schrank', 'regal', 'fach', 'schublade', 'kiste', 'karton',
  'papier', 'blatt', 'deckel', 'hülle', 'verpackung', 'etikett', 'aufkleber',
  'logo', 'symbol', 'zeichen', 'signal', 'ampel', 'schild', 'tafel', 'wandbild',
  'poster', 'plakat', 'karte', 'plan', 'landkarte', 'stadtplan', 'kompass',
  'nadel', 'kugel', 'ball', 'ring', 'kette', 'reifen', 'rad', 'speichen',
  'felge', 'rille', 'furche', 'struktur', 'textur', 'oberfläche', 'haut',
  'glatt', 'rau', 'scharf', 'stumpf', 'kantig', 'rund', 'spitz', 'gewölbt',
  'konkav', 'konvex', 'wellig', 'faltig', 'runzlig', 'falten', 'knitter',
  'maschen', 'strick', 'gewebe', 'seide', 'baumwolle', 'wolle', 'leinen',
  'leder', 'samt', 'flausch', 'pelz', 'feder', 'daunen', 'kissen', 'decke',
  'teppich', 'vorhang', 'gardine', 'fensterbank', 'brett', 'holz', 'knoten',
  'ast', 'zweig', 'blume', 'blüte', 'stiel', 'wurzel', 'stamm', 'rinde',
  'moos', 'farn', 'gras', 'halm', 'stroh', 'heu', 'getreide', 'weizen',
  'gerste', 'roggen', 'hafer', 'mais', 'reis', 'korn', 'saat', 'samen',
  'frucht', 'beere', 'apfel', 'birne', 'kirsche', 'pflaume', 'pfirsich',
  'aprikose', 'orange', 'zitrone', 'limette', 'banane', 'traube', 'himbeere',
  'erdbeere', 'walnuss', 'haselnuss', 'mandel', 'pistazie', 'cashew',
  'kastanie', 'eichel', 'nuss', 'kerne', 'stein', 'obst', 'gemüse', 'karotte',
  'kartoffel', 'tomate', 'gurke', 'salat', 'spinat', 'kohl', 'brokkoli',
  'blumenkohl', 'zucchini', 'aubergine', 'paprika', 'zwiebel', 'knoblauch',
  'lauch', 'spargel', 'pilz', 'champignon', 'steinpilz', 'morchel', 'trüffel',
  'kräuter', 'basilikum', 'oregano', 'thymian', 'rosmarin', 'petersilie',
  'schnittlauch', 'dill', 'kümmel', 'pfeffer', 'salz', 'zucker', 'honig',
  'sirup', 'melasse', 'öl', 'butter', 'fett', 'schmalz', 'speck', 'wurst',
  'schinken', 'salami', 'käse', 'milch', 'joghurt', 'quark', 'sahne', 'rahm',
  'eier', 'ei', 'eiweiß', 'eigelb', 'mehl', 'teig', 'brot', 'brotchen',
  'brötchen', 'semmel', 'baguette', 'ciabatta', 'toast', 'kuchen', 'torte',
  'gebäck', 'plunder', 'croissant', 'muffin', 'donut', 'bagel', 'pancake',
  'waffel', 'crepe', 'pfannkuchen', 'omelett', 'rührei', 'spiegelei',
  'kaffee', 'tee', 'espresso', 'cappuccino', 'latte', 'macchiato', 'americano',
  'mokka', 'aufguss', 'limonade', 'saft', 'nektar', 'smoothie', 'shake',
  'milkshake', 'eis', 'sorbet', 'gelato', 'softeis', 'getränk', 'wasser',
  'mineralwasser', 'sprudel', 'soda', 'cola', 'bier', 'wein', 'schaumwein',
  'champagner', 'prosecco', 'cocktail', 'martini', 'margarita', 'mojito',
  'whiskey', 'bourbon', 'scotch', 'gin', 'wodka', 'rum', 'tequila', 'brandy',
  'cognac', 'sherry', 'port', 'vermouth', 'campari', 'aperol', 'korn',
  'schnaps', 'brand', 'grappa', 'eau-de-vie', 'kirsch', 'zwetschge',
]);

const AUDITORY_WORDS = new Set([
  'hören', 'lauschen', 'zuhören', 'horchen', 'vernehmen', 'klingen', 'tönen',
  'schallen', 'erklingen', 'widerhallen', 'laut', 'leise', 'lautlos',
  'geräusch', 'lärm', 'knallen', 'knistern', 'knarren', 'knirschen',
  'knacken', 'klingeln', 'läuten', 'schellen', 'glocken', 'glocke',
  'klingel', 'türglocke', 'singen', 'summen', 'brummen', 'surren',
  'zischen', 'pfeifen', 'sausen', 'rauschen', 'prasseln', 'tropfen',
  'klatschen', 'klopfen', 'pochen', 'hammern', 'schlagen', 'rascheln',
  'scharren', 'kratzen', 'schaben', 'schleifen', 'polieren', 'bürsten',
  'wischen', 'putzen', 'reinigen', 'waschen', 'spülen', 'schütteln',
  'rütteln', 'wackeln', 'zittern', 'beben', 'erzittern', 'stimme',
  'sprache', 'wort', 'satz', 'silbe', 'laut', 'buchstabe', 'alphabet',
  'vokal', 'konsonant', 'akzent', 'betonung', 'intonation', 'melodie',
  'rhythmus', 'tempo', 'takt', 'pause', 'stille', 'ruhe', 'musik',
  'lied', 'gesang', 'chor', 'orchester', 'symphonie', 'sonate', 'konzert',
  'oper', 'singspiel', 'kantate', 'requiem', 'messe', 'motette', 'hymne',
  'psalm', 'blues', 'jazz', 'swing', 'bebop', 'funk', 'soul', 'hip-hop',
  'rap', 'trap', 'techno', 'house', 'trance', 'dubstep', 'ambient',
  'meditation', 'klangschalen', 'gong', 'trommel', 'tamburin', 'maracas',
  'shaker', 'xylophon', 'glockenspiel', 'vibraphon', 'marimba', 'hang',
  'didgeridoo', 'ocarina', 'flöte', 'blockflöte', 'querflöte', 'oboe',
  'klarinette', 'fagott', 'saxophon', 'horn', 'trompete', 'posaune',
  'tuba', 'gitarre', 'e-gitarre', 'bass', 'kontrabass', 'violine',
  'viola', 'cello', 'harfe', 'laute', 'mandoline', 'banjo', 'ukulele',
  'sitar', 'tabla', 'piano', 'klavier', 'cembalo', 'orgel', 'harmonium',
  'akkordeon', 'bandoneon', 'mundharmonika', 'zither', 'drehleier',
  'geige', 'bratsche', 'violoncello', 'bassgeige', 'violone', 'baryton',
]);

const OLFACTORY_WORDS = new Set([
  'riechen', 'duften', 'stinken', 'aromatisch', 'wohlriechend', 'geruch',
  'duft', 'aroma', 'parfüm', 'essenz', 'blume', 'blüte', 'rosen', 'rose',
  'jasmin', 'lavendel', 'vanille', 'zimt', 'muskat', 'nelke', 'bergamotte',
  'petitgrain', 'neroli', 'eukalyptus', 'teebaum', 'rosmarin', 'thymian',
  'salbei', 'minze', 'pfefferminz', 'spearmint', 'basilikum', 'oregano',
  'majoran', 'dill', 'schnittlauch', 'lauch', 'knoblauch', 'zwiebel',
  'schalotte', 'porree', 'sellerie', 'fenchel', 'kümmel', 'koriander',
  'kreuzkümmel', 'anis', 'sternanis', 'holz', 'kiefer', 'fichte', 'tanne',
  'zeder', 'zypressen', 'wacholder', 'eibe', 'moos', 'farn', 'gras',
  'halm', 'stroh', 'heu', 'getreide', 'weizen', 'gerste', 'roggen',
  'hafer', 'mais', 'reis', 'korn', 'saat', 'samen', 'frucht', 'beere',
  'apfel', 'birne', 'kirsche', 'pflaume', 'pfirsich', 'aprikose', 'orange',
  'zitrone', 'limette', 'banane', 'traube', 'himbeere', 'erdbeere',
  'walnuss', 'haselnuss', 'mandel', 'pistazie', 'cashew', 'kastanie',
  'eichel', 'nuss', 'kerne', 'stein', 'obst', 'gemüse', 'karotte',
  'kartoffel', 'tomate', 'gurke', 'salat', 'spinat', 'kohl', 'brokkoli',
  'blumenkohl', 'zucchini', 'aubergine', 'paprika', 'zwiebel', 'knoblauch',
  'lauch', 'spargel', 'pilz', 'champignon', 'steinpilz', 'morchel',
  'trüffel', 'kräuter', 'basilikum', 'oregano', 'thymian', 'rosmarin',
  'petersilie', 'schnittlauch', 'dill', 'kümmel', 'pfeffer', 'salz',
  'zucker', 'honig', 'sirup', 'melasse', 'öl', 'butter', 'fett', 'schmalz',
  'speck', 'wurst', 'schinken', 'salami', 'käse', 'milch', 'joghurt',
  'quark', 'sahne', 'rahm', 'eier', 'ei', 'eiweiß', 'eigelb', 'mehl',
  'teig', 'brot', 'brotchen', 'brötchen', 'semmel', 'baguette', 'ciabatta',
  'toast', 'kuchen', 'torte', 'gebäck', 'plunder', 'croissant', 'muffin',
  'donut', 'bagel', 'pancake', 'waffel', 'crepe', 'pfannkuchen', 'omelett',
  'rührei', 'spiegelei', 'kaffee', 'tee', 'espresso', 'cappuccino', 'latte',
  'macchiato', 'americano', 'mokka', 'aufguss', 'limonade', 'saft',
  'nektar', 'smoothie', 'shake', 'milkshake', 'eis', 'sorbet', 'gelato',
  'softeis', 'getränk', 'wasser', 'mineralwasser', 'sprudel', 'soda',
  'cola', 'bier', 'wein', 'schaumwein', 'champagner', 'prosecco', 'cocktail',
  'martini', 'margarita', 'mojito', 'whiskey', 'bourbon', 'scotch', 'gin',
  'wodka', 'rum', 'tequila', 'brandy', 'cognac', 'sherry', 'port',
  'vermouth', 'campari', 'aperol', 'korn', 'schnaps', 'brand', 'grappa',
  'eau-de-vie', 'kirsch', 'zwetschge',
]);

const GUSTATORY_WORDS = new Set([
  'schmecken', 'essen', 'trinken', 'kosten', 'genießen', 'süß', 'sauer',
  'salzig', 'bitter', 'würzig', 'aromatisch', 'herb', 'mild', 'scharf',
  'pikant', 'frisch', 'alt', 'ranzig', 'modrig', 'faulig', 'reif',
  'unreif', 'gereift', 'saftig', 'trocken', 'nass', 'weich', 'hart',
  'zäh', 'zart', 'bissig', 'knusprig', 'knackig', 'cremig', 'flüssig',
  'dickflüssig', 'klar', 'trüb', 'milchig', 'eischig', 'fruchtig',
  'nussig', 'körig', 'mehlig', 'klebrig', 'zähflüssig', 'spröde',
  'mürbe', 'broschig', 'seidig', 'samtig', 'butterig', 'ölig', 'fettig',
  'mager', 'fleischig', 'muskulös', 'sehnig', 'kauen', 'schlucken',
  'schmatzen', 'knabbern', 'nagen', 'fressen', 'speisen', 'dinnern',
  'frühstücken', 'lunch', 'snack', 'imbiss', 'mahlzeit', 'gericht',
  'speise', 'küche', 'rezept', 'zutat', 'zubereitung', 'kochen',
  'backen', 'braten', 'schmoren', 'dünsten', 'grillen', 'rösten',
  'fritieren', 'pochieren', 'blanchieren', 'marinieren', 'würzen',
  'abschmecken', 'servieren', 'anrichten', 'dekorieren', 'garnieren',
  'einlegen', 'einkochen', 'konservieren', 'fermentieren', 'reifen',
  'lagern', 'salzen', 'pfeffern', 'zuckern', 'süßen', 'säuern',
  'bittern', 'herben', 'mildern', 'schärfen', 'pikanten', 'aromatisieren',
  'parfümieren', 'duften', 'riechen', 'stinken', 'wohlriechend',
  'geruch', 'duft', 'aroma', 'parfüm', 'essenz', 'blume', 'blüte',
  'rosen', 'rose', 'jasmin', 'lavendel', 'vanille', 'zimt', 'muskat',
  'nelke', 'bergamotte', 'petitgrain', 'neroli', 'eukalyptus', 'teebaum',
  'rosmarin', 'thymian', 'salbei', 'minze', 'pfefferminz', 'spearmint',
  'basilikum', 'oregano', 'majoran', 'dill', 'schnittlauch', 'lauch',
  'knoblauch', 'zwiebel', 'schalotte', 'porree', 'sellerie', 'fenchel',
  'kümmel', 'koriander', 'kreuzkümmel', 'anis', 'sternanis', 'holz',
  'kiefer', 'fichte', 'tanne', 'zeder', 'zypressen', 'wacholder', 'eibe',
  'moos', 'farn', 'gras', 'halm', 'stroh', 'heu', 'getreide', 'weizen',
  'gerste', 'roggen', 'hafer', 'mais', 'reis', 'korn', 'saat', 'samen',
  'frucht', 'beere', 'apfel', 'birne', 'kirsche', 'pflaume', 'pfirsich',
  'aprikose', 'orange', 'zitrone', 'limette', 'banane', 'traube',
  'himbeere', 'erdbeere', 'walnuss', 'haselnuss', 'mandel', 'pistazie',
  'cashew', 'kastanie', 'eichel', 'nuss', 'kerne', 'stein', 'obst',
  'gemüse', 'karotte', 'kartoffel', 'tomate', 'gurke', 'salat', 'spinat',
  'kohl', 'brokkoli', 'blumenkohl', 'zucchini', 'aubergine', 'paprika',
  'zwiebel', 'knoblauch', 'lauch', 'spargel', 'pilz', 'champignon',
  'steinpilz', 'morchel', 'trüffel', 'kräuter', 'basilikum', 'oregano',
  'thymian', 'rosmarin', 'petersilie', 'schnittlauch', 'dill', 'kümmel',
  'pfeffer', 'salz', 'zucker', 'honig', 'sirup', 'melasse', 'öl',
  'butter', 'fett', 'schmalz', 'speck', 'wurst', 'schinken', 'salami',
  'käse', 'milch', 'joghurt', 'quark', 'sahne', 'rahm', 'eier', 'ei',
  'eiweiß', 'eigelb', 'mehl', 'teig', 'brot', 'brotchen', 'brötchen',
  'semmel', 'baguette', 'ciabatta', 'toast', 'kuchen', 'torte', 'gebäck',
  'plunder', 'croissant', 'muffin', 'donut', 'bagel', 'pancake', 'waffel',
  'crepe', 'pfannkuchen', 'omelett', 'rührei', 'spiegelei', 'kaffee',
  'tee', 'espresso', 'cappuccino', 'latte', 'macchiato', 'americano',
  'mokka', 'aufguss', 'limonade', 'saft', 'nektar', 'smoothie', 'shake',
  'milkshake', 'eis', 'sorbet', 'gelato', 'softeis', 'getränk', 'wasser',
  'mineralwasser', 'sprudel', 'soda', 'cola', 'bier', 'wein', 'schaumwein',
  'champagner', 'prosecco', 'cocktail', 'martini', 'margarita', 'mojito',
  'whiskey', 'bourbon', 'scotch', 'gin', 'wodka', 'rum', 'tequila',
  'brandy', 'cognac', 'sherry', 'port', 'vermouth', 'campari', 'aperol',
  'korn', 'schnaps', 'brand', 'grappa', 'eau-de-vie', 'kirsch', 'zwetschge',
]);

const TACTILE_WORDS = new Set([
  'fühlen', 'berühren', 'streicheln', 'kitzeln', 'drücken', 'greifen',
  'halten', 'ergreifen', 'fassen', 'umfassen', 'umarmen', 'küssen',
  'schlagen', 'treten', 'stoßen', 'schieben', 'ziehen', 'heben',
  'tragen', 'werfen', 'fangen', 'lassen', 'fallen', 'klettern',
  'steigen', 'laufen', 'gehen', 'rennen', 'springen', 'hüpfen',
  'tanzen', 'schwingen', 'drehen', 'wirbeln', 'rollen', 'gleiten',
  'rutschen', 'kriechen', 'sinken', 'schweben', 'schwimmen', 'tauchen',
  'fliegen', 'segeln', 'fahren', 'reiten', 'warm', 'kalt', 'heiß',
  'eisig', 'lau', 'kühl', 'mild', 'schwül', 'feucht', 'trocken',
  'nass', 'weich', 'hart', 'glatt', 'rau', 'scharf', 'stumpf',
  'spitz', 'kantig', 'rund', 'gewölbt', 'konkav', 'konvex', 'wellig',
  'faltig', 'runzlig', 'falten', 'knitter', 'maschen', 'strick',
  'gewebe', 'seide', 'baumwolle', 'wolle', 'leinen', 'leder', 'samt',
  'flausch', 'pelz', 'feder', 'daunen', 'kissen', 'decke', 'teppich',
  'vorhang', 'gardine', 'fensterbank', 'brett', 'holz', 'knoten',
  'ast', 'zweig', 'blume', 'blüte', 'stiel', 'wurzel', 'stamm',
  'rinde', 'moos', 'farn', 'gras', 'halm', 'stroh', 'heu', 'getreide',
  'weizen', 'gerste', 'roggen', 'hafer', 'mais', 'reis', 'korn',
  'saat', 'samen', 'frucht', 'beere', 'apfel', 'birne', 'kirsche',
  'pflaume', 'pfirsich', 'aprikose', 'orange', 'zitrone', 'limette',
  'banane', 'traube', 'himbeere', 'erdbeere', 'walnuss', 'haselnuss',
  'mandel', 'pistazie', 'cashew', 'kastanie', 'eichel', 'nuss', 'kerne',
  'stein', 'obst', 'gemüse', 'karotte', 'kartoffel', 'tomate', 'gurke',
  'salat', 'spinat', 'kohl', 'brokkoli', 'blumenkohl', 'zucchini',
  'aubergine', 'paprika', 'zwiebel', 'knoblauch', 'lauch', 'spargel',
  'pilz', 'champignon', 'steinpilz', 'morchel', 'trüffel', 'kräuter',
  'basilikum', 'oregano', 'thymian', 'rosmarin', 'petersilie',
  'schnittlauch', 'dill', 'kümmel', 'pfeffer', 'salz', 'zucker', 'honig',
  'sirup', 'melasse', 'öl', 'butter', 'fett', 'schmalz', 'speck',
  'wurst', 'schinken', 'salami', 'käse', 'milch', 'joghurt', 'quark',
  'sahne', 'rahm', 'eier', 'ei', 'eiweiß', 'eigelb', 'mehl', 'teig',
  'brot', 'brotchen', 'brötchen', 'semmel', 'baguette', 'ciabatta',
  'toast', 'kuchen', 'torte', 'gebäck', 'plunder', 'croissant', 'muffin',
  'donut', 'bagel', 'pancake', 'waffel', 'crepe', 'pfannkuchen', 'omelett',
  'rührei', 'spiegelei', 'kaffee', 'tee', 'espresso', 'cappuccino', 'latte',
  'macchiato', 'americano', 'mokka', 'aufguss', 'limonade', 'saft',
  'nektar', 'smoothie', 'shake', 'milkshake', 'eis', 'sorbet', 'gelato',
  'softeis', 'getränk', 'wasser', 'mineralwasser', 'sprudel', 'soda',
  'cola', 'bier', 'wein', 'schaumwein', 'champagner', 'prosecco', 'cocktail',
  'martini', 'margarita', 'mojito', 'whiskey', 'bourbon', 'scotch', 'gin',
  'wodka', 'rum', 'tequila', 'brandy', 'cognac', 'sherry', 'port',
  'vermouth', 'campari', 'aperol', 'korn', 'schnaps', 'brand', 'grappa',
  'eau-de-vie', 'kirsch', 'zwetschge',
]);

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function emptyClassification(): SenseClassification {
  return { visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 };
}

function countMatches(text: string, wordSet: Set<string>): number {
  if (!text || typeof text !== 'string') return 0;
  const words = text.toLowerCase().split(/\s+/);
  let count = 0;
  for (const word of words) {
    const clean = word.replace(/[.,!?;:]/g, '');
    if (wordSet.has(clean)) count++;
  }
  return count;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scannt Text nach Vokabeln der 5 Wahrnehmungskanäle.
 */
export function classifySenseChannels(text: string): SenseClassification {
  if (!text || typeof text !== 'string') return emptyClassification();

  return {
    visual: countMatches(text, VISUAL_WORDS),
    auditory: countMatches(text, AUDITORY_WORDS),
    olfactory: countMatches(text, OLFACTORY_WORDS),
    gustatory: countMatches(text, GUSTATORY_WORDS),
    tactile: countMatches(text, TACTILE_WORDS),
  };
}

/**
 * Schlägt Alarm bei sensorisch verarmten Kapiteln.
 */
export function checkSensoryBalance(chapters: string[]): SensoryRadar {
  if (!chapters || !Array.isArray(chapters)) {
    return { chapters: [], overallBalance: emptyClassification() };
  }

  const chapterResults: ChapterBalance[] = [];
  const overall = emptyClassification();

  for (let i = 0; i < chapters.length; i++) {
    const balance = classifySenseChannels(chapters[i]);
    overall.visual += balance.visual;
    overall.auditory += balance.auditory;
    overall.olfactory += balance.olfactory;
    overall.gustatory += balance.gustatory;
    overall.tactile += balance.tactile;

    const total = balance.visual + balance.auditory + balance.olfactory + balance.gustatory + balance.tactile;
    const warning = total === 0
      ? `Kapitel ${i + 1}: Keine sensorischen Details gefunden`
      : undefined;

    chapterResults.push({ index: i, balance, warning });
  }

  return { chapters: chapterResults, overallBalance: overall };
}

/**
 * Schlägt cross-modale Beschreibungen vor.
 */
export function generateSynesthesia(concept: string): SynesthesiaSuggestion {
  if (!concept || typeof concept !== 'string') {
    return { concept: '', suggestions: [] };
  }

  const clean = concept.trim().toLowerCase();
  const suggestions: string[] = [];

  // Cross-modale Mappings basierend auf dem Konzept
  const visualMappings: Record<string, string> = {
    'musik': 'Klangfarben wie ein Gemälde aus Licht und Schatten',
    'liebe': 'Ein warmes, goldenes Leuchten, das den ganzen Raum erfüllt',
    'hass': 'Scharfe, dunkle Kanten, die wie Splitter in der Luft hängen',
    'freude': 'Ein helles, federleichtes Schweben wie Seidenpapier im Wind',
    'trauer': 'Schwere, dunkle Wolken, die wie nasse Wolle auf der Haut liegen',
    'angst': 'Ein kalter, metallischer Geschmack, der im Haft klebt',
    'frieden': 'Ein sanfter, blauer Nebel, der wie ein leises Flüsterung klingt',
    'wut': 'Glühende, rote Hitze, die wie eine Flamme über die Haut läuft',
    'überraschung': 'Ein plötzlicher, heller Blitz, der alle Sinne gleichzeitig trifft',
    'langeweile': 'Graue, schwere Stille, wie dicker Staub in der Luft',
  };

  const auditoryMappings: Record<string, string> = {
    'farbe': 'Jede Farbe hat einen Ton — Rot klingt wie eine tiefe Trommel',
    'licht': 'Helles Licht singt wie eine Glocke, dunkles Licht flüstert',
    'schatten': 'Schatten rauschen wie leises Papier, das über den Boden gleitet',
    'feuer': 'Flammen knistern wie ein altes Radio zwischen den Stationen',
    'wasser': 'Wasser plätschert wie ein sanfter Gesang, der sich wiederholt',
    'wind': 'Wind pfeift wie eine Blockflöte durch die Bäume',
    'regen': 'Regen trommeln wie ein Rhythmus auf einem Blechdach',
    'schnee': 'Schnee schweigt wie eine Stille, die alles verschluckt',
    'eis': 'Eis knackt wie ein Knochen, der unter Druck bricht',
    'kristall': 'Kristall klingt wie eine Glocke, die in der Luft schwebt',
  };

  const olfactoryMappings: Record<string, string> = {
    'farbe': 'Farben haben einen Duft — Blau riechen nach kaltem Wasser',
    'licht': 'Licht duftet nach warmem Holz und trockener Erde',
    'schatten': 'Schatten riechen nach feuchtem Stein und altem Papier',
    'feuer': 'Feuer duftet nach Rauch und verbranntem Holz',
    'wasser': 'Wasser riechen nach frischem Regen und kaltem Metall',
    'wind': 'Wind duftet nach Gras und fernen Blumen',
    'regen': 'Regen riechen nach frischer Erde und nassem Asphalt',
    'schnee': 'Schnee duftet nach kalter Luft und reiner Stille',
    'eis': 'Eis riechen nach kaltem Metall und gefrorenem Wasser',
    'kristall': 'Kristall duftet nach kaltem Stein und reiner Luft',
  };

  const gustatoryMappings: Record<string, string> = {
    'farbe': 'Farben schmecken — Rot schmeckt nach süßen Beeren',
    'licht': 'Licht schmeckt nach warmem Honig und goldenem Sirup',
    'schatten': 'Schatten schmecken nach dunkler Schokolade und Bitterstoffen',
    'feuer': 'Feuer schmeckt nach geräuchertem Holz und scharfem Pfeffer',
    'wasser': 'Wasser schmeckt nach frischem Quellwasser und kühlem Mineral',
    'wind': 'Wind schmeckt nach frischem Gras und kühlem Luft',
    'regen': 'Regen schmeckt nach nassem Staub und frischer Erde',
    'schnee': 'Schnee schmeckt nach kaltem Nichts und reiner Stille',
    'eis': 'Eis schmeckt nach kaltem Metall und gefrorenem Wasser',
    'kristall': 'Kristall schmeckt nach kaltem Stein und reiner Luft',
  };

  const tactileMappings: Record<string, string> = {
    'farbe': 'Farben fühlen sich an — Rot fühlt sich warm wie eine Heizung an',
    'licht': 'Licht fühlt sich an wie warme Sonne auf der Haut',
    'schatten': 'Schatten fühlen sich an wie kühle Luft auf der Haut',
    'feuer': 'Feuer fühlt sich an wie brennende Hitze auf der Haut',
    'wasser': 'Wasser fühlt sich an wie kühle Flüssigkeit über die Haut',
    'wind': 'Wind fühlt sich an wie kühle Luft, die über die Haut streicht',
    'regen': 'Regen fühlt sich an wie kleine Tropfen auf der Haut',
    'schnee': 'Schnee fühlt sich an wie kühle, weiche Flocken auf der Haut',
    'eis': 'Eis fühlt sich an wie kaltes, glattes Metall auf der Haut',
    'kristall': 'Kristall fühlt sich an wie kaltes, glattes Glas auf der Haut',
  };

  // Generiere Vorschläge basierend auf dem Konzept
  if (visualMappings[clean]) suggestions.push(visualMappings[clean]);
  if (auditoryMappings[clean]) suggestions.push(auditoryMappings[clean]);
  if (olfactoryMappings[clean]) suggestions.push(olfactoryMappings[clean]);
  if (gustatoryMappings[clean]) suggestions.push(gustatoryMappings[clean]);
  if (tactileMappings[clean]) suggestions.push(tactileMappings[clean]);

  // Fallback: Generische Vorschläge wenn kein spezifisches Mapping existiert
  if (suggestions.length === 0) {
    suggestions.push(`Das Konzept "${clean}" könnte man als eine Mischung aus Licht und Schatten beschreiben`);
    suggestions.push(`"${clean}" könnte man als einen Klang beschreiben, der zwischen warm und kalt schwankt`);
    suggestions.push(`"${clean}" könnte man als einen Duft beschreiben, der zwischen süß und bitter liegt`);
    suggestions.push(`"${clean}" könnte man als einen Geschmack beschreiben, der zwischen mild und scharf liegt`);
    suggestions.push(`"${clean}" könnte man als eine Textur beschreiben, die zwischen glatt und rau wechselt`);
  }

  return { concept: clean, suggestions };
}
