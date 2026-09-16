// Redetexte: Musterreden-Bibliothek für den Redenschreiber —
// Schwerpunkt POLITISCHE Reden (Wahlkampf, Parlament, Kommune, Gedenken).
//
// Reine Daten + pure Functions, keine LLM-Calls. Platzhalter im Format
// {{Name}} — der Aufrufer ersetzt sie oder lässt sie als Ausfüll-Hinweis.
// Texte bewusst kompakt (Eröffnung + 2–3 Kerngedanken + Schluss mit Appell)
// als Ausgangsbasis für eigene Reden oder die KI-Generierung.

/** Ein einzelner Redetext (Musterrede). */
export interface SpeechTemplate {
  /** Stabile ID, z. B. "wahlkampf-auftakt". */
  id: string;
  /** Anzeigename, z. B. "Wahlkampfrede (Auftakt)". */
  titel: string;
  /** Anlass, z. B. "Wahlkampf". */
  anlass: string;
  /** Rubrik für Gruppierung: Politik, Privat oder Geschäftlich. */
  kategorie: "politik" | "privat" | "geschaeftlich";
  /** Geschätzte Redezeit in Minuten (~130 Wörter/Min). */
  minuten: number;
  /** Verwendete Platzhalter, z. B. ["Name", "Ort"]. */
  platzhalter: string[];
  /** Der Redetext (Markdown, Absätze mit Leerzeile). */
  text: string;
}

/** Ersetzt {{Platzhalter}} durch Werte aus vars (unbekannte bleiben stehen). */
export function renderSpeechTemplate(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) =>
    vars[key] !== undefined ? vars[key] : m,
  );
}

export const SPEECH_TEMPLATES: SpeechTemplate[] = [
  {
    id: "wahlkampf-auftakt",
    titel: "Wahlkampfrede (Auftakt)",
    anlass: "Wahlkampf",
    kategorie: "politik",
    minuten: 7,
    platzhalter: ["Ort", "Name", "Wahltermin"],
    text: [
      "Liebe Freundinnen und Freunde, liebe Bürgerinnen und Bürger von {{Ort}},",
      "",
      "ich bin {{Name}}, und ich stehe heute hier, weil am {{Wahltermin}} eine Richtungsentscheidung ansteht. Nicht über Personen — über die Frage, in was für einer Stadt, in was für einem Land wir leben wollen.",
      "",
      "Schauen wir uns um: Die Mieten steigen, während Wohnungen leer stehen. Unsere Schulen platzen aus allen Nähten, während Geld für Prestigeprojekte da ist. Das ist keine Naturgewalt — das sind politische Entscheidungen. Und Entscheidungen kann man ändern.",
      "",
      "Ich verspreche Ihnen drei Dinge, messbar und überprüfbar: Erstens, jedes Jahr tausend neue bezahlbare Wohnungen — mit Baulandbeschluss noch in diesem Jahr. Zweitens, keine geschlossene Schwimmhalle, keine gestrichene Buslinie ohne Ersatz. Drittens, einen Haushalt, den jeder versteht — offengelegt, Zeile für Zeile.",
      "",
      "Man wird Ihnen einreden, das sei nicht finanzierbar. Dieselben Leute haben das Prestigeprojekt am Marktplatz für das Dreifache durchgewunken. Es ist keine Frage des Geldes — es ist eine Frage der Prioritäten.",
      "",
      "Am {{Wahltermin}} entscheiden Sie: Weiter so — oder endlich Politik für die Vielen. Ich bitte Sie um Ihr Vertrauen und Ihre Stimme. Kämpfen wir gemeinsam — für {{Ort}}!",
    ].join("\n"),
  },
  {
    id: "parteitag-grundsatz",
    titel: "Parteitagsrede (Grundsatz)",
    anlass: "Parteitag",
    kategorie: "politik",
    minuten: 8,
    platzhalter: ["Name", "Partei"],
    text: [
      "Liebe Genossinnen und Genossen, liebe Freunde von {{Partei}},",
      "",
      "ich bin {{Name}}. Parteitage sind der Ort, an dem wir uns ehrlich machen — miteinander und mit uns selbst. Also lassen Sie mich mit einer unbequemen Wahrheit beginnen: Wir haben Wahlen verloren, weil wir aufgehört haben, zuzuhören.",
      "",
      "Zu lange haben wir in Sitzungsräumen über Menschen gesprochen, statt mit ihnen. Wir haben Papiere geschrieben, wo Gespräche nötig gewesen wären. Das ändert sich — heute, hier, mit diesem Parteitag.",
      "",
      "Unsere Grundsätze stehen nicht zur Debatte: Soziale Gerechtigkeit, Freiheit des Einzelnen, Verantwortung für das, was nach uns kommt. Aber die Antworten auf neue Fragen — Digitalisierung, Klimawandel, der Zusammenhalt einer gespaltenen Gesellschaft — die müssen wir gemeinsam neu finden.",
      "",
      "Ich schlage Ihnen vor: Gehen wir raus. Nicht erst im Wahlkampf, sondern jetzt. Zehntausend Haustürgespräche bis zum Sommer. Wer macht mit? (Zwischenruf abwarten.)",
      "",
      "Eine Partei, die zuhört, kann nicht verlieren. Packen wir es an — für {{Partei}}, für unser Land!",
    ].join("\n"),
  },
  {
    id: "parlament-haushalt",
    titel: "Parlamentsrede (Haushaltsdebatte)",
    anlass: "Parlament / Haushaltsdebatte",
    kategorie: "politik",
    minuten: 6,
    platzhalter: ["Name", "Fraktion", "Beispiel"],
    text: [
      "Frau Präsidentin, meine Damen und Herren,",
      "",
      "ich bin {{Name}} von der Fraktion {{Fraktion}}. Ein Haushalt ist in Zahlen gegossene Politik — und dieser Entwurf erzählt eine Geschichte, die ich so nicht unterschreiben kann.",
      "",
      "Schauen wir auf die Fakten: Die Ausgaben für externe Beratung steigen um zwanzig Prozent, während bei {{Beispiel}} gekürzt wird. Das ist kein Sparen — das ist Umverteilen von unten nach oben, verpackt in Haushaltsdeutsch.",
      "",
      "Die Regierung wird einwenden, die Lage erfordere Zurückhaltung. Richtig — Zurückhaltung bei Prestige, nicht bei Zukunft. Jeder Euro in Bildung kommt dreifach zurück. Jeder Euro in Beraterverträge ist weg.",
      "",
      "Wir beantragen daher: Erstens, Deckelung der Beratungsausgaben auf Vorjahresniveau. Zweitens, Zweckbindung der frei werdenden Mittel für {{Beispiel}}. Drittens, ein öffentliches Ausgabenregister — damit jede Bürgerin nachvollziehen kann, wohin ihr Steuergeld fließt.",
      "",
      "Stimmen Sie mit uns für einen Haushalt, der rechnet — menschlich wie finanziell. Danke.",
    ].join("\n"),
  },
  {
    id: "kommune-buergerdialog",
    titel: "Bürgeransprache (Kommune)",
    anlass: "Bürgerversammlung / Kommune",
    kategorie: "politik",
    minuten: 5,
    platzhalter: ["Ort", "Name", "Vorhaben"],
    text: [
      "Liebe Bürgerinnen und Bürger von {{Ort}},",
      "",
      "ich bin {{Name}}, und ich freue mich, dass heute so viele gekommen sind. Denn worum es geht — {{Vorhaben}} — betrifft uns alle, und deshalb gehört es hierher: in die öffentliche Debatte, nicht in ein Hinterzimmer.",
      "",
      "Lassen Sie mich offen sein: Es gibt gute Gründe dafür und gute Gründe dagegen. Dafür spricht, dass wir seit Jahren über dieses Problem reden und handeln müssen. Dagegen spricht die Sorge vor Lärm, Kosten und Veränderung vor der eigenen Haustür. Beide Seiten haben Recht — und beide werden gehört.",
      "",
      "Was ich Ihnen verspreche: Erstens, alle Zahlen liegen ab morgen öffentlich aus — Kosten, Gutachten, Alternativen. Zweitens, keine Entscheidung vor der zweiten Bürgerversammlung im Herbst. Drittens, wenn die Mehrheit Nein sagt, ist es Nein.",
      "",
      "Demokratie lebt davon, dass wir streiten — fair und mit Fakten. Ich lade Sie ein: Nutzen Sie Ihre Stimme, heute und in den kommenden Wochen. {{Ort}} entscheidet gemeinsam. Danke.",
    ].join("\n"),
  },
  {
    id: "gedenkrede",
    titel: "Gedenkrede (politisch)",
    anlass: "Gedenkveranstaltung",
    kategorie: "politik",
    minuten: 5,
    platzhalter: ["Anlass", "Name"],
    text: [
      "Sehr geehrte Damen und Herren,",
      "",
      "wir sind heute zusammengekommen zu {{Anlass}}. Mein Name ist {{Name}}. Gedenken heißt: nicht vergessen — und daraus handeln.",
      "",
      "Die Geschichte lehrt uns, dass Freiheit nie selbstverständlich ist. Sie wurde erkämpft — von Menschen mit Namen und Gesichtern, die Verantwortung übernahmen, als Wegschauen bequemer gewesen wäre. Ihnen gilt heute unser Respekt.",
      "",
      "Aber Gedenken ohne Konsequenz ist Ritual. Wer heute von Versöhnung spricht, muss morgen für sie arbeiten: gegen Ausgrenzung im Alltag, gegen Hass im Netz, gegen das Vergessen in den Klassenzimmern.",
      "",
      "Ich bitte Sie: Tragen Sie dieses Gedenken nach draußen. Sprechen Sie darüber — mit Ihren Kindern, Ihren Nachbarn, Ihren Kolleginnen und Kollegen. Demokratie braucht Demokraten, jeden Tag aufs Neue.",
      "",
      "In stillem Gedenken — und mit dem festen Willen, aus der Geschichte zu lernen. Danke.",
    ].join("\n"),
  },
  {
    id: "krisenansprache",
    titel: "Krisenansprache",
    anlass: "Krise / Notlage",
    kategorie: "politik",
    minuten: 4,
    platzhalter: ["Name", "Funktion", "Lage"],
    text: [
      "Liebe Bürgerinnen und Bürger,",
      "",
      "ich bin {{Name}}, {{Funktion}}. Ich wende mich heute direkt an Sie, weil die Lage ernst ist: {{Lage}}. Ich will Ihnen nichts beschönigen — aber ich will Ihnen auch sagen, was wir tun.",
      "",
      "Erstens: Die Versorgung ist gesichert. Alle Einsatzkräfte sind im Dienst, die Leitungen stehen. Zweitens: Ab morgen früh informiert Sie der Krisenstab zweimal täglich — faktenbasiert, ohne Spekulation. Drittens: Wer Hilfe braucht, bekommt sie — die Hotline ist ab sofort geschaltet.",
      "",
      "Ich bitte Sie um drei Dinge: Ruhe bewahren, nur gesicherte Informationen weitergeben und aufeinander achten — besonders auf Ältere und Alleinlebende in Ihrer Nachbarschaft.",
      "",
      "Krisen zeigen, aus welchem Holz eine Gesellschaft geschnitzt ist. Ich bin überzeugt: Wir halten zusammen. Bleiben Sie besonnen — wir melden uns wieder. Danke.",
    ].join("\n"),
  },
  {
    id: "neujahrsansprache",
    titel: "Neujahrsansprache (politisch)",
    anlass: "Jahreswechsel",
    kategorie: "politik",
    minuten: 4,
    platzhalter: ["Ort", "Name"],
    text: [
      "Liebe Bürgerinnen und Bürger von {{Ort}},",
      "",
      "ich bin {{Name}}. Ein Jahr geht zu Ende — Zeit für einen ehrlichen Blick zurück und einen mutigen Blick nach vorn.",
      "",
      "Hinter uns liegt ein Jahr mit Licht und Schatten: Wir haben wichtige Vorhaben auf den Weg gebracht — und bei manchem länger gebraucht, als uns lieb war. Ich nenne das beim Namen, denn Vertrauen entsteht aus Ehrlichkeit, nicht aus Hochglanz.",
      "",
      "Im neuen Jahr stehen drei Aufgaben im Mittelpunkt: bezahlbares Wohnen, verlässliche Kinderbetreuung und eine Verwaltung, die dient statt verwaltet. Daran lassen Sie uns messen — mich zuerst.",
      "",
      "Mein Wunsch für {{Ort}}: dass wir mehr miteinander reden als übereinander. Dass wir streiten in der Sache und zusammenhalten als Gemeinschaft.",
      "",
      "Ihnen und Ihren Familien wünsche ich Gesundheit, Zuversicht und ein gutes neues Jahr. Packen wir es gemeinsam an!",
    ].join("\n"),
  },
  {
    id: "erwiderung-debatte",
    titel: "Erwiderung (Schlussplädoyer Debatte)",
    anlass: "Debatte / Erwiderung",
    kategorie: "politik",
    minuten: 4,
    platzhalter: ["Name", "Fraktion", "Kernforderung"],
    text: [
      "Frau Präsidentin, meine Damen und Herren,",
      "",
      "ich bin {{Name}} von der Fraktion {{Fraktion}}, und ich habe der Debatte aufmerksam zugehört. Drei Einwände kamen immer wieder — erlauben Sie mir, sie der Reihe nach zu entkräften.",
      "",
      "Erstens hieß es, unser Vorschlag sei zu teuer. Rechnen wir nach: Die Kosten des Nichthandelns — Reparaturen, Folgekosten, verlorene Jahre — übersteigen unsere Investition um ein Vielfaches. Teuer ist nicht das Handeln. Teuer ist das Abwarten.",
      "",
      "Zweitens hieß es, die Zeit sei nicht reif. Wann, wenn nicht jetzt? Die Betroffenen warten seit Jahren. Jede vertagte Entscheidung ist eine Entscheidung gegen sie.",
      "",
      "Drittens hieß es, das Problem löse sich von selbst. Sehr geehrte Damen und Herren, von selbst löst sich in der Politik gar nichts — außer Mehrheiten auf.",
      "",
      "Deshalb: {{Kernforderung}}. Stimmen Sie zu — nicht für uns, sondern für die Sache. Danke.",
    ].join("\n"),
  },
];

/** Alle Vorlagen (id + titel + anlass + kategorie + minuten) für Auswahl-Listen. */
export function listSpeechTemplates(): Pick<
  SpeechTemplate,
  "id" | "titel" | "anlass" | "kategorie" | "minuten"
>[] {
  return SPEECH_TEMPLATES.map(({ id, titel, anlass, kategorie, minuten }) => ({
    id,
    titel,
    anlass,
    kategorie,
    minuten,
  }));
}

/** Vorlagen einer Kategorie (z. B. nur "privat"). */
export function listSpeechTemplatesByKategorie(
  kategorie: SpeechTemplate["kategorie"],
): SpeechTemplate[] {
  return SPEECH_TEMPLATES.filter((t) => t.kategorie === kategorie);
}

/** Vorlage per ID holen (undefined, wenn unbekannt). */
export function getSpeechTemplate(id: string): SpeechTemplate | undefined {
  return SPEECH_TEMPLATES.find((t) => t.id === id);
}
