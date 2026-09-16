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

  // =========================================================================
  // PRIVAT (8)
  // =========================================================================
  {
    id: "hochzeit",
    titel: "Hochzeitsrede (Trauzeuge)",
    anlass: "Hochzeit",
    kategorie: "privat",
    minuten: 5,
    platzhalter: ["Brautpaar", "Name"],
    text: [
      "Liebes {{Brautpaar}}, liebe Gäste,",
      "",
      "als {{Name}} mich bat, heute ein paar Worte zu sagen, habe ich erst gelacht — und dann sehr lange nachgedacht. Denn wie fasst man in wenigen Minuten zusammen, was zwei Menschen verbindet?",
      "",
      "Ich kenne die beiden seit Jahren, und eines war immer klar: Zusammen sind sie mehr als die Summe ihrer Teile. Wo der eine zweifelt, macht die andere Mut. Wo die eine zögert, geht der andere voran.",
      "",
      "Ich erinnere mich an einen Abend, an dem sie stundenlang über nichts und alles geredet haben — und genau da wusste ich: Die zwei gehören zusammen.",
      "",
      "Mein Wunsch für euch: Bewahrt euch diesen Blick füreinander. Nicht nur heute, im schönsten Licht, sondern auch an grauen Dienstagen. Hört einander zu, lacht miteinander — und vergesst nie, warum ihr hier steht.",
      "",
      "Erhebt mit mir das Glas: Auf {{Brautpaar}} — auf Liebe, Mut und ein langes, lautes, wunderbares gemeinsames Leben!",
    ].join("\n"),
  },
  {
    id: "geburtstag",
    titel: "Geburtstagsrede (runder Geburtstag)",
    anlass: "Runder Geburtstag",
    kategorie: "privat",
    minuten: 4,
    platzhalter: ["Jubilar", "Alter", "Name"],
    text: [
      "Liebe Familie, liebe Freunde,",
      "",
      "wir sind heute hier, um mit {{Jubilar}} den {{Alter}}. Geburtstag zu feiern. Und wenn ich mich umschaue, sehe ich in jedem Gesicht eine andere Geschichte mit dem Geburtstagskind — das sagt alles.",
      "",
      "{{Alter}} Jahre — das klingt erst einmal nach viel. Aber wer {{Jubilar}} kennt, weiß: Gezählt wird hier nicht in Jahren, sondern in Abenteuern, in gelungenen Festen, in Menschen, die man zusammengebracht hat.",
      "",
      "Ich habe {{Name}} gefragt, was {{Jubilar}} sich wünscht. Die Antwort war typisch: Alle sollen da sein und es soll ihnen gut gehen. Nun — schau dich um. Wunsch erfüllt.",
      "",
      "Auf viele weitere Jahre voller Gesundheit, Neugier und dieser unnachahmlichen Art, aus jedem Tag etwas Besonderes zu machen. Alles Gute, {{Jubilar}}!",
    ].join("\n"),
  },
  {
    id: "trauerfeier",
    titel: "Trauerrede",
    anlass: "Trauerfeier",
    kategorie: "privat",
    minuten: 4,
    platzhalter: ["Verstorbene", "Name"],
    text: [
      "Liebe Trauergemeinde,",
      "",
      "wir haben uns heute versammelt, um Abschied zu nehmen von {{Verstorbene}}. Abschied zu nehmen fällt schwer — besonders von einem Menschen, der so viele Spuren hinterlassen hat.",
      "",
      "{{Verstorbene}} war ein Mensch mit klaren Werten: Verlässlichkeit, Herzenswärme und ein trockener Humor, der selbst schwierige Tage heller machte. Viele von uns tragen einen Satz, eine Geste, einen Rat mit sich, der bleibt.",
      "",
      "Trauer ist der Preis der Liebe, sagt man. Und wenn das stimmt, dann ist die Trauer heute groß — weil die Liebe groß war.",
      "",
      "Mein Name ist {{Name}}. Ich danke Ihnen, dass Sie heute hier sind und gemeinsam erinnern. Möge {{Verstorbene}} in Frieden ruhen — und in unserer Erinnerung weiterleben.",
    ].join("\n"),
  },
  {
    id: "konfirmation",
    titel: "Konfirmationsrede (Eltern)",
    anlass: "Konfirmation / Jugendweihe",
    kategorie: "privat",
    minuten: 3,
    platzhalter: ["Kind", "Name"],
    text: [
      "Liebe Familie, liebe Freunde,",
      "",
      "heute ist ein besonderer Tag für {{Kind}} — und ehrlich gesagt auch für uns als Eltern. Mein Name ist {{Name}}, und ich schaue auf einen jungen Menschen, der gerade dabei ist, erwachsen zu werden — ob wir wollen oder nicht.",
      "",
      "{{Kind}}, du hast uns in den letzten Jahren oft überrascht: mit guten Fragen, mit eigenem Kopf und mit einem Herzen, das am rechten Fleck sitzt. Behalte dir das bei — gerade den eigenen Kopf.",
      "",
      "Unser Wunsch für deinen Weg: Bleib neugierig, bleib mutig und bleib anständig. Fehler gehören dazu — wichtig ist, was du daraus machst. Und wisse: Egal, wohin dich dein Weg führt, hier ist immer ein Zuhause für dich.",
      "",
      "Feiern wir heute dich, {{Kind}} — und alles, was noch kommt!",
    ].join("\n"),
  },
  {
    id: "einschulung",
    titel: "Einschulungsrede (Eltern)",
    anlass: "Einschulung",
    kategorie: "privat",
    minuten: 2,
    platzhalter: ["Kind"],
    text: [
      "Liebes {{Kind}},",
      "",
      "heute ist dein großer Tag: Dein erster Schultag! Die Schultüte ist gepackt, der Ranzen sitzt — und ein bisschen aufgeregt bist du auch. Das ist gut so, das gehört dazu.",
      "",
      "In der Schule wirst du lesen, schreiben und rechnen lernen. Aber das Wichtigste lernst du nebenbei: Freunde finden, zusammenhalten und neugierig bleiben.",
      "",
      "Wir sind stolz auf dich und freuen uns auf alles, was du uns erzählen wirst. Jetzt geht's los — viel Spaß, {{Kind}}!",
    ].join("\n"),
  },
  {
    id: "silberhochzeit",
    titel: "Silberhochzeit (Jubelpaar)",
    anlass: "Silberhochzeit",
    kategorie: "privat",
    minuten: 4,
    platzhalter: ["Partner", "Name"],
    text: [
      "Liebe Familie, liebe Freunde,",
      "",
      "25 Jahre — ein Vierteljahrhundert. Als {{Partner}} und ich uns das Jawort gaben, hat uns niemand eine Gebrauchsanweisung mitgegeben. Wir mussten alles selbst herausfinden — und wir haben es herausgefunden.",
      "",
      "Ich bin {{Name}}, und wenn man mich fragt, was das Geheimnis ist, sage ich: Es gibt keins. Es gibt nur den Alltag — und die Entscheidung, ihn gemeinsam zu meistern. Durch dick und dünn, durch Umzüge, Kinder, Sorgen und Feste.",
      "",
      "Danke an alle, die uns auf diesem Weg begleitet haben: unsere Familien, unsere Freunde — und vor allem danke dir, {{Partner}}, für 25 Jahre Geduld mit mir.",
      "",
      "Auf die nächsten 25! Erhebt das Glas mit uns!",
    ].join("\n"),
  },
  {
    id: "taufe",
    titel: "Taufrede (Paten)",
    anlass: "Taufe",
    kategorie: "privat",
    minuten: 3,
    platzhalter: ["Kind", "Name"],
    text: [
      "Liebe Familie, liebe Freunde,",
      "",
      "heute wird {{Kind}} getauft — und ich habe die Ehre, als {{Name}} Pate zu sein. Ein Pate verspricht, da zu sein: nicht nur heute im Festgewand, sondern auch später, wenn es darauf ankommt.",
      "",
      "{{Kind}}, du bist noch klein und verstehst heute kein Wort. Aber eines Tages wirst du diese Rede lesen und wissen: Du warst von Anfang an von Menschen umgeben, die dich lieben.",
      "",
      "Mein Versprechen an dich: Ich bin da — bei Fragen, bei Sorgen, bei Abenteuern. Du kannst jederzeit anklopfen.",
      "",
      "Willkommen in dieser großen, lauten, wunderbaren Familie, {{Kind}}!",
    ].join("\n"),
  },
  {
    id: "ruhestand-privat",
    titel: "Abschied in den Ruhestand (Kollegenkreis)",
    anlass: "Ruhestand (privat)",
    kategorie: "privat",
    minuten: 3,
    platzhalter: ["Kollege", "Jahre", "Name"],
    text: [
      "Liebe Kolleginnen und Kollegen,",
      "",
      "nach {{Jahre}} Jahren sagt {{Kollege}} heute Tschüss — und wir lassen ihn nur ungern gehen. Mein Name ist {{Name}}, und ich darf heute aussprechen, was viele denken.",
      "",
      "{{Kollege}} war mehr als ein Kollege: Ansprechpartner in schwierigen Lagen, ruhiger Pol im Trubel und jemand, dessen Tür immer offen stand. Die Kaffeeküche wird ohne dich leiser — und unsere Projekte ärmer an Erfahrung.",
      "",
      "Für den neuen Lebensabschnitt wünschen wir dir Gesundheit, Zeit für alles Aufgeschobene und die Gelassenheit, morgens auch mal liegen zu bleiben.",
      "",
      "Danke für alles, {{Kollege}} — und komm uns besuchen!",
    ].join("\n"),
  },

  // =========================================================================
  // GESCHÄFTLICH (8)
  // =========================================================================
  {
    id: "firmenjubilaeum",
    titel: "Firmenjubiläum",
    anlass: "Firmenjubiläum",
    kategorie: "geschaeftlich",
    minuten: 5,
    platzhalter: ["Firma", "Jahre", "Name"],
    text: [
      "Sehr geehrte Gäste, liebe Kolleginnen und Kollegen,",
      "",
      "{{Jahre}} Jahre {{Firma}} — das ist kein Zufall, das ist das Ergebnis von Menschen, die jeden Tag ihr Bestes geben. Heute feiern wir nicht nur eine Zahl, sondern all die Arbeit dahinter.",
      "",
      "Ich bin {{Name}}, und ich erinnere mich noch an die Anfänge: kleine Büros, große Pläne und der feste Glaube, dass Qualität sich durchsetzt. Dieser Glaube hat uns getragen — durch gute Jahre und durch schwierige.",
      "",
      "Unser Dank gilt zuerst unseren Mitarbeiterinnen und Mitarbeitern: Sie sind das Gesicht und das Herz dieses Unternehmens. Er gilt unseren Kunden für ihr Vertrauen — und unseren Partnern für jahrelange Treue.",
      "",
      "Der Blick geht nach vorn: Die nächsten {{Jahre}} Jahre werden anders — digitaler, schneller, anspruchsvoller. Aber mit dieser Mannschaft bin ich zuversichtlich: Wir schaffen das. Auf {{Firma}}!",
    ].join("\n"),
  },
  {
    id: "produktlaunch",
    titel: "Produktvorstellung (Launch)",
    anlass: "Produktlaunch",
    kategorie: "geschaeftlich",
    minuten: 5,
    platzhalter: ["Produkt", "Firma", "Name"],
    text: [
      "Herzlich willkommen — schön, dass Sie heute hier sind!",
      "",
      "Ich bin {{Name}} von {{Firma}}, und ich freue mich, Ihnen heute {{Produkt}} vorzustellen. Kein Update, keine Variante — etwas wirklich Neues.",
      "",
      "Ausgangspunkt war eine einfache Beobachtung bei unseren Kunden: Die bestehenden Lösungen sind entweder zu kompliziert oder zu schwach. Also haben wir gefragt: Was wäre, wenn man beides verbindet — Leistung und Einfachheit?",
      "",
      "{{Produkt}} tut genau das: Es spart Ihnen im Alltag messbar Zeit, läuft auf Ihren bestehenden Systemen und ist in unter einer Stunde einsatzbereit. Keine Schulung nötig, keine Umstellung — es funktioniert einfach.",
      "",
      "Ab heute bestellbar, Lieferung ab kommendem Monat. Unsere Berater stehen Ihnen nach der Präsentation für alle Fragen zur Verfügung. Danke — und überzeugen Sie sich selbst!",
    ].join("\n"),
  },
  {
    id: "eroeffnungsrede",
    titel: "Eröffnungsrede (Filiale / Standort)",
    anlass: "Eröffnung",
    kategorie: "geschaeftlich",
    minuten: 3,
    platzhalter: ["Standort", "Firma", "Name"],
    text: [
      "Sehr geehrte Gäste, liebe Nachbarn,",
      "",
      "ich bin {{Name}} von {{Firma}}, und ich freue mich, heute unseren neuen Standort in {{Standort}} zu eröffnen. Eine Eröffnung ist immer ein Vertrauensbeweis — in den Ort, in die Menschen hier und in die Zukunft.",
      "",
      "{{Standort}} war für uns keine Zufallsentscheidung: kurze Wege, engagierte Mitarbeiterinnen und Mitarbeiter aus der Region und eine herzliche Aufnahme durch Stadt und Nachbarschaft.",
      "",
      "Kommen Sie herein, schauen Sie sich um — heute ist Tag der offenen Tür mit Programm für die ganze Familie. Wir freuen uns auf Sie!",
    ].join("\n"),
  },
  {
    id: "motivationsrede-team",
    titel: "Motivationsrede (Team / Kick-off)",
    anlass: "Team-Kick-off",
    kategorie: "geschaeftlich",
    minuten: 4,
    platzhalter: ["Team", "Ziel", "Name"],
    text: [
      "Guten Morgen, {{Team}}!",
      "",
      "ich bin {{Name}}. Vor uns liegt ein anspruchsvolles Quartal — und ich sage bewusst nicht: ein schwieriges. Denn {{Ziel}} ist erreichbar, wenn wir drei Dinge tun: fokussieren, zusammenhalten und dranbleiben.",
      "",
      "Fokussieren heißt: Jeder kennt seine wichtigste Aufgabe der Woche. Nicht fünf — eine. Zusammenhalten heißt: Niemand kämpft allein; wer feststeckt, meldet sich früh. Dranbleiben heißt: Wir messen wöchentlich, feiern Fortschritte und korrigieren schnell.",
      "",
      "Ich verspreche Ihnen: Erfolge werden sichtbar belohnt — und Hindernisse räume ich mit Ihnen gemeinsam aus dem Weg.",
      "",
      "Also: Ärmel hoch, Blick nach vorn — {{Ziel}} schaffen wir zusammen. Los geht's!",
    ].join("\n"),
  },
  {
    id: "verabschiedung-chef",
    titel: "Verabschiedung (Geschäftsführung)",
    anlass: "Führungswechsel",
    kategorie: "geschaeftlich",
    minuten: 4,
    platzhalter: ["Nachfolger", "Name", "Jahre"],
    text: [
      "Liebe Kolleginnen und Kollegen,",
      "",
      "nach {{Jahre}} Jahren übergebe ich heute die Geschäftsführung an {{Nachfolger}}. Mein Name ist {{Name}}, und dieser Moment ist für mich mit Dankbarkeit und Zuversicht verbunden.",
      "",
      "Dankbarkeit für das, was wir gemeinsam aufgebaut haben: aus einem kleinen Betrieb ein Unternehmen, das seinen Namen mit Stolz trägt. Das war nie die Leistung Einzelner — das waren Sie alle.",
      "",
      "{{Nachfolger}} bringt frische Ideen, Erfahrung und — was am wichtigsten ist — Respekt vor dem Erreichten mit. Ich bitte Sie: Schenken Sie ihm das Vertrauen, das Sie mir geschenkt haben.",
      "",
      "Ich gehe nicht ganz: Als Berater bleibe ich an Bord, solange man mich braucht. Danke für alles — und viel Erfolg uns allen!",
    ].join("\n"),
  },
  {
    id: "dankesrede-preis",
    titel: "Dankesrede (Preis / Auszeichnung)",
    anlass: "Preisverleihung",
    kategorie: "geschaeftlich",
    minuten: 3,
    platzhalter: ["Auszeichnung", "Name"],
    text: [
      "Sehr geehrte Damen und Herren,",
      "",
      "die {{Auszeichnung}} entgegenzunehmen, ehrt mich zutiefst — und ehrlich gesagt: Ich bin sprachlos. Fast. Denn ein paar Worte des Dankes müssen sein.",
      "",
      "Ich bin {{Name}}, und ich stehe heute hier, weil andere an mich geglaubt haben — oft stärker, als ich selbst es tat. Dieser Preis gehört deshalb nicht mir allein.",
      "",
      "Er gehört meinem Team, das täglich liefert, ohne im Rampenlicht zu stehen. Er gehört unseren Kunden, die uns fordern und dadurch besser machen. Und er gehört meiner Familie, die jeden Überstunden-Abend mitgetragen hat.",
      "",
      "Ich verspreche: Diese Auszeichnung ist für mich Ansporn, nicht Anlass zum Ausruhen. Herzlichen Dank!",
    ].join("\n"),
  },
  {
    id: "weihnachtsansprache-firma",
    titel: "Weihnachtsansprache (Firma)",
    anlass: "Weihnachtsfeier",
    kategorie: "geschaeftlich",
    minuten: 3,
    platzhalter: ["Firma", "Name"],
    text: [
      "Liebe Kolleginnen und Kollegen,",
      "",
      "das Jahr neigt sich dem Ende — Zeit, kurz innezuhalten. Hinter uns liegen zwölf Monate mit Höhen und Tiefen, mit Projekten, die geglückt sind, und solchen, aus denen wir gelernt haben.",
      "",
      "Ich bin {{Name}}, und ich möchte heute vor allem eines sagen: Danke. Danke für Engagement, das oft über das Selbstverständliche hinausging. Danke für Zusammenhalt, gerade wenn es eng wurde.",
      "",
      "{{Firma}} ist, was es ist, durch die Menschen hier im Raum. Darauf können wir stolz sein — heute Abend besonders.",
      "",
      "Ich wünsche Ihnen und Ihren Familien ruhige Feiertage, Zeit füreinander und einen guten Start ins neue Jahr. Genießen wir den Abend!",
    ].join("\n"),
  },
  {
    id: "kundenbegruessung",
    titel: "Kundenbegrüßung (Veranstaltung)",
    anlass: "Kundenveranstaltung",
    kategorie: "geschaeftlich",
    minuten: 3,
    platzhalter: ["Firma", "Name", "Thema"],
    text: [
      "Herzlich willkommen bei {{Firma}}!",
      "",
      "ich bin {{Name}}, und ich freue mich, dass Sie sich heute Zeit für uns nehmen. Das Thema {{Thema}} bewegt die Branche — und wir wollen Ihnen heute zeigen, wo wir stehen und wohin die Reise geht.",
      "",
      "Erwarten Sie keine Werbeveranstaltung: Wir zeigen echte Einblicke — in unsere Arbeit, unsere Zahlen und auch unsere offenen Baustellen. Denn Partnerschaft heißt für uns: ehrlich miteinander reden.",
      "",
      "Nutzen Sie den Tag: Stellen Sie Fragen, fordern Sie uns heraus, vernetzen Sie sich. Unsere Experten stehen Ihnen in den Pausen und Workshops zur Verfügung.",
      "",
      "Danke für Ihr Kommen — und einen erkenntnisreichen Tag!",
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

// Reden-Druck: druckt NUR den Redetext (Titel + Anlass + Text) über ein
// temporäres Druckfenster. Nutzt window.print mit Print-CSS statt PDF-Lib —
export function printSpeech(title: string, anlass: string, text: string): void {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  win.document.write(`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Georgia,serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#000}
h1{font-size:1.6rem;margin-bottom:.2rem} .anlass{color:#555;margin-bottom:1.5rem}
p{line-height:1.6;margin:0 0 1rem} @media print{.no-print{display:none}}
</style></head><body>
<h1>${esc(title)}</h1><div class="anlass">${esc(anlass)}</div>${paras}
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/** Fenster-Event: Teleprompter soll einen Redetext übernehmen + öffnen. */
export const OPEN_TELEPROMPTER_EVENT = "teleprompter:open-with-text";

/** Fordert Sidebar + Teleprompter auf, einen Redetext zu übernehmen. */
export function requestTeleprompterWithText(text: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_TELEPROMPTER_EVENT, { detail: text }));
}

/** Vorlage per ID holen (undefined, wenn unbekannt). */
export function getSpeechTemplate(id: string): SpeechTemplate | undefined {
  return SPEECH_TEMPLATES.find((t) => t.id === id);
}
