// @vitest-environment jsdom
/** Tests: CharacterOnomasticsLedger (WP 132.2 / Meilenstein 64.0, v7.6.0) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  NAMING_TRADITIONS,
  getNamingTradition,
  buildNameCulture,
  generateCharacterName,
  explainNameMeaning,
  checkNameHarmony,
  createSampleNameCulture,
  createSampleCharacterName,
} from "./characterOnomasticsLedger";

const TRADITION_IDS = ["patronymic", "clanSept", "occupational", "epithet"] as const;
const GENDERS = ["male", "female", "neutral"] as const;

describe("hashString — Determinismus", () => {
  it("ist deterministisch für denselben String", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("ist deterministisch für einen zusammengesetzten String", () => {
    expect(hashString("Nordmark:patronymic:42")).toBe(hashString("Nordmark:patronymic:42"));
  });

  it("ist deterministisch für einen leeren String", () => {
    expect(hashString("")).toBe(hashString(""));
  });

  it("ist deterministisch für einen langen String", () => {
    const long = "A".repeat(10000) + "Klinge";
    expect(hashString(long)).toBe(hashString(long));
  });

  it("liefert bei erneutem Aufruf stets denselben Wert", () => {
    const a = hashString("Sturmherz");
    const b = hashString("Sturmherz");
    const c = hashString("Sturmherz");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("hashString — Eindeutigkeit", () => {
  it("unterscheidet zwei kurze Strings", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("unterscheidet ähnliche Wörter", () => {
    expect(hashString("wald")).not.toBe(hashString("walde"));
  });

  it("unterscheidet String und Leerstring", () => {
    expect(hashString("")).not.toBe(hashString("x"));
  });

  it("liefert für 200 verschiedene Strings überwiegend verschiedene Hashes", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(hashString(`Namenskultur-${i}`));
    }
    expect(seen.size).toBe(200);
  });

  it("unterscheidet die vier Traditions-Kennungen", () => {
    const hashes = TRADITION_IDS.map((id) => hashString(id));
    expect(new Set(hashes).size).toBe(4);
  });
});

describe("hashString — 32-Bit-Ganzzahl", () => {
  it("liefert einen ganzzahligen Wert", () => {
    expect(Number.isInteger(hashString("loden"))).toBe(true);
  });

  it("liefert einen nicht-negativen Wert", () => {
    expect(hashString("loden")).toBeGreaterThanOrEqual(0);
  });

  it("bleibt unter 2^32", () => {
    expect(hashString("loden")).toBeLessThanOrEqual(0xffffffff);
  });

  it("bleibt für viele Eingaben im 32-Bit-Bereich", () => {
    for (let i = 0; i < 100; i++) {
      const h = hashString(`pruefwert-${i}`);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("liefert stets eine vorzeichenlose Ganzzahl", () => {
    expect(hashString("äöüß")).toBe(hashString("äöüß"));
    expect(hashString("äöüß")).toBeGreaterThanOrEqual(0);
  });
});

describe("hashString — Unicode", () => {
  it("verarbeitet Umlaute", () => {
    expect(hashString("Müller")).toBe(hashString("Müller"));
    expect(hashString("Müller")).not.toBe(hashString("Muller"));
  });

  it("unterscheidet ä von a", () => {
    expect(hashString("ä")).not.toBe(hashString("a"));
  });

  it("verarbeitet ß", () => {
    expect(hashString("Straße")).toBe(hashString("Straße"));
    expect(hashString("Straße")).not.toBe(hashString("Strasse"));
  });

  it("verarbeitet deutsche Anführungszeichen", () => {
    expect(hashString("„Wald“")).toBe(hashString("„Wald“"));
    expect(hashString("„Wald“")).not.toBe(hashString("Wald"));
  });

  it("verarbeitet Emoji-Codepunkte stabil", () => {
    expect(hashString("Wolf🐺")).toBe(hashString("Wolf🐺"));
  });
});

describe("createSeededRandom — Determinismus", () => {
  it("liefert gleiche Folgen für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 50; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("liefert unterschiedliche Folgen für unterschiedliche Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });

  it("ist reproduzierbar über neue Instanzen", () => {
    const a = createSeededRandom(1337)();
    const b = createSeededRandom(1337)();
    expect(a).toBe(b);
  });

  it("behandelt Seed 0 deterministisch", () => {
    const r1 = createSeededRandom(0);
    const r2 = createSeededRandom(0);
    expect(r1()).toBe(r2());
  });

  it("behandelt große Seeds deterministisch", () => {
    const r1 = createSeededRandom(0xffffffff);
    const r2 = createSeededRandom(0xffffffff);
    expect(r1()).toBe(r2());
  });
});

describe("createSeededRandom — Wertebereich", () => {
  it("liefert über 500 Ziehungen stets Werte in [0,1)", () => {
    const rng = createSeededRandom(2024);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("liefert über 500 Ziehungen ausschließlich endliche Zahlen", () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 500; i++) {
      expect(Number.isFinite(rng())).toBe(true);
    }
  });

  it("erzeugt nicht lauter identische Werte", () => {
    const rng = createSeededRandom(99);
    const set = new Set<number>();
    for (let i = 0; i < 500; i++) set.add(rng());
    expect(set.size).toBeGreaterThan(100);
  });

  it("deckt über 500 Ziehungen beide Hälften des Intervalls ab", () => {
    const rng = createSeededRandom(555);
    let low = 0;
    let high = 0;
    for (let i = 0; i < 500; i++) {
      if (rng() < 0.5) low += 1;
      else high += 1;
    }
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });
});

describe("NAMING_TRADITIONS — Struktur", () => {
  it("enthält genau 4 Traditionen", () => {
    expect(NAMING_TRADITIONS).toHaveLength(4);
  });

  it("ist ein Array", () => {
    expect(Array.isArray(NAMING_TRADITIONS)).toBe(true);
  });

  it("enthält die erwarteten Kennungen", () => {
    const ids = NAMING_TRADITIONS.map((t) => t.id);
    expect(ids).toEqual(["patronymic", "clanSept", "occupational", "epithet"]);
  });

  it("hat eindeutige Kennungen", () => {
    const ids = NAMING_TRADITIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("NAMING_TRADITIONS — Feldinhalte", () => {
  TRADITION_IDS.forEach((id) => {
    describe(`Tradition „${id}“`, () => {
      const t = getNamingTradition(id)!;

      it("hat einen nicht-leeren Namen", () => {
        expect(typeof t.name).toBe("string");
        expect(t.name.length).toBeGreaterThan(0);
      });

      it("hat eine nicht-leere Beschreibung", () => {
        expect(typeof t.description).toBe("string");
        expect(t.description.length).toBeGreaterThan(0);
      });

      it("hat ein nicht-leeres patterns-Array", () => {
        expect(Array.isArray(t.patterns)).toBe(true);
        expect(t.patterns.length).toBeGreaterThan(0);
      });

      it("hat ausschließlich nicht-leere Muster", () => {
        for (const p of t.patterns) {
          expect(typeof p).toBe("string");
          expect(p.length).toBeGreaterThan(0);
        }
      });

      it("hat ein nicht-leeres examples-Array", () => {
        expect(Array.isArray(t.examples)).toBe(true);
        expect(t.examples.length).toBeGreaterThan(0);
      });

      it("hat ausschließlich nicht-leere Beispiele", () => {
        for (const e of t.examples) {
          expect(typeof e).toBe("string");
          expect(e.length).toBeGreaterThan(0);
        }
      });

      it("echoed die Kennung im Objekt", () => {
        expect(t.id).toBe(id);
      });
    });
  });
});

describe("getNamingTradition", () => {
  it("liefert die Patronymika-Tradition", () => {
    expect(getNamingTradition("patronymic")?.id).toBe("patronymic");
  });

  it("liefert die Klan-Tradition", () => {
    expect(getNamingTradition("clanSept")?.id).toBe("clanSept");
  });

  it("liefert die Berufs-Tradition", () => {
    expect(getNamingTradition("occupational")?.id).toBe("occupational");
  });

  it("liefert die Beinamen-Tradition", () => {
    expect(getNamingTradition("epithet")?.id).toBe("epithet");
  });

  it("liefert für jede gültige Kennung ein Objekt", () => {
    for (const id of TRADITION_IDS) {
      expect(getNamingTradition(id)).toBeDefined();
    }
  });

  it("liefert undefined für eine unbekannte Kennung", () => {
    expect(getNamingTradition("unbekannt")).toBeUndefined();
  });

  it("liefert undefined für einen Leerstring", () => {
    expect(getNamingTradition("")).toBeUndefined();
  });

  it("ist case-sensitiv", () => {
    expect(getNamingTradition("Patronymic")).toBeUndefined();
  });

  it("liefert dieselbe Referenz wie im Katalog", () => {
    expect(getNamingTradition("patronymic")).toBe(NAMING_TRADITIONS[0]);
  });
});

describe("buildNameCulture — Basis", () => {
  const culture = buildNameCulture({ cultureName: "Nordmark", traditionId: "patronymic" }, 42);

  it("echoed den Kulturnamen", () => {
    expect(culture.cultureName).toBe("Nordmark");
  });

  it("liefert eine nicht-leere Tradition", () => {
    expect(typeof culture.tradition).toBe("string");
    expect(culture.tradition.length).toBeGreaterThan(0);
  });

  it("liefert ein nicht-leeres consonants-Array", () => {
    expect(Array.isArray(culture.consonants)).toBe(true);
    expect(culture.consonants.length).toBeGreaterThan(0);
  });

  it("liefert ein nicht-leeres vowels-Array", () => {
    expect(Array.isArray(culture.vowels)).toBe(true);
    expect(culture.vowels.length).toBeGreaterThan(0);
  });

  it("liefert einen nicht-leeren syllableStyle", () => {
    expect(typeof culture.syllableStyle).toBe("string");
    expect(culture.syllableStyle.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Beschreibung", () => {
    expect(typeof culture.description).toBe("string");
    expect(culture.description.length).toBeGreaterThan(0);
  });

  it("übernimmt die Traditionskennung", () => {
    expect(culture.tradition).toBe("patronymic");
  });
});

describe("buildNameCulture — pro Tradition", () => {
  TRADITION_IDS.forEach((id) => {
    it(`übernimmt die Kennung „${id}“`, () => {
      const c = buildNameCulture({ cultureName: "Testmark", traditionId: id }, 11);
      expect(c.tradition).toBe(id);
    });
  });
});

describe("buildNameCulture — Präferenzen und Determinismus", () => {
  it("nutzt bevorzugte Konsonanten, wenn übergeben", () => {
    const c = buildNameCulture(
      { cultureName: "Eigenmark", traditionId: "patronymic", preferredConsonants: ["k", "r"] },
      3
    );
    expect(c.consonants).toEqual(["k", "r"]);
  });

  it("nutzt bevorzugte Vokale, wenn übergeben", () => {
    const c = buildNameCulture(
      { cultureName: "Eigenmark", traditionId: "patronymic", preferredVowels: ["a", "o"] },
      3
    );
    expect(c.vowels).toEqual(["a", "o"]);
  });

  it("ignoriert leere Präferenz-Arrays und zieht aus dem Vorrat", () => {
    const c = buildNameCulture(
      { cultureName: "Eigenmark", traditionId: "patronymic", preferredConsonants: [] },
      3
    );
    expect(c.consonants.length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleichen Aufruf", () => {
    const a = buildNameCulture({ cultureName: "Nordmark", traditionId: "clanSept" }, 42);
    const b = buildNameCulture({ cultureName: "Nordmark", traditionId: "clanSept" }, 42);
    expect(a).toEqual(b);
  });

  it("liefert unterschiedliche Inventare für unterschiedliche Seeds", () => {
    const a = buildNameCulture({ cultureName: "Nordmark", traditionId: "clanSept" }, 1);
    const b = buildNameCulture({ cultureName: "Nordmark", traditionId: "clanSept" }, 2);
    expect(a).not.toEqual(b);
  });

  it("fällt bei unbekannter Tradition auf die erste zurück", () => {
    const c = buildNameCulture({ cultureName: "Fremdmark", traditionId: "gibt-es-nicht" }, 5);
    expect(c.tradition).toBe("patronymic");
  });

  it("echoed einen ungewöhnlichen Kulturnamen", () => {
    const c = buildNameCulture({ cultureName: "Xyzzy-9", traditionId: "occupational" }, 5);
    expect(c.cultureName).toBe("Xyzzy-9");
  });

  it("nimmt bei leerem Kulturnamen den leeren String an", () => {
    const c = buildNameCulture({ cultureName: "", traditionId: "epithet" }, 5);
    expect(c.cultureName).toBe("");
  });
});

describe("generateCharacterName — pro Tradition", () => {
  TRADITION_IDS.forEach((id) => {
    describe(`Tradition „${id}“`, () => {
      const name = generateCharacterName({ cultureName: "Nordmark", traditionId: id }, 42);

      it("liefert einen nicht-leeren Namen", () => {
        expect(typeof name.name).toBe("string");
        expect(name.name.length).toBeGreaterThan(0);
      });

      it("echoed die Tradition", () => {
        expect(name.tradition).toBe(id);
      });

      it("echoed den Kulturnamen", () => {
        expect(name.cultureName).toBe("Nordmark");
      });

      it("liefert ein nicht-leeres syllables-Array", () => {
        expect(Array.isArray(name.syllables)).toBe(true);
        expect(name.syllables.length).toBeGreaterThan(0);
      });

      it("liefert ausschließlich nicht-leere Silben", () => {
        for (const s of name.syllables) expect(s.length).toBeGreaterThan(0);
      });

      it("echoed das Geschlecht (neutral als Standard)", () => {
        expect(name.gender).toBe("neutral");
      });

      it("liefert eine nicht-leere Bedeutung", () => {
        expect(typeof name.meaning).toBe("string");
        expect(name.meaning.length).toBeGreaterThan(0);
      });

      it("liefert eine nicht-leere Etymologie", () => {
        expect(typeof name.etymology).toBe("string");
        expect(name.etymology.length).toBeGreaterThan(0);
      });

      it("ist deterministisch", () => {
        const again = generateCharacterName({ cultureName: "Nordmark", traditionId: id }, 42);
        expect(again).toEqual(name);
      });
    });
  });
});

describe("generateCharacterName — Geschlechter", () => {
  GENDERS.forEach((gender) => {
    it(`echoed das Geschlecht „${gender}“`, () => {
      const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "patronymic", gender }, 7);
      expect(n.gender).toBe(gender);
    });

    it(`liefert für „${gender}“ einen nicht-leeren Namen`, () => {
      const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "epithet", gender }, 7);
      expect(n.name.length).toBeGreaterThan(0);
    });
  });

  it("liefert unterschiedliche Namen für unterschiedliche Geschlechter", () => {
    const m = generateCharacterName({ cultureName: "Nordmark", traditionId: "patronymic", gender: "male" }, 9);
    const f = generateCharacterName({ cultureName: "Nordmark", traditionId: "patronymic", gender: "female" }, 9);
    expect(m.name).not.toBe(f.name);
  });
});

describe("generateCharacterName — Rolle und Determinismus", () => {
  it("berücksichtigt die Rolle in der Etymologie", () => {
    const n = generateCharacterName(
      { cultureName: "Nordmark", traditionId: "occupational", role: "Schmied" },
      3
    );
    expect(n.etymology).toContain("Schmied");
  });

  it("liefert ohne Rolle eine gültige Etymologie", () => {
    const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "occupational" }, 3);
    expect(n.etymology.length).toBeGreaterThan(0);
  });

  it("liefert unterschiedliche Namen für unterschiedliche Rollen", () => {
    const a = generateCharacterName({ cultureName: "Nordmark", traditionId: "epithet", role: "Krieger" }, 3);
    const b = generateCharacterName({ cultureName: "Nordmark", traditionId: "epithet", role: "Barde" }, 3);
    expect(a.name).not.toBe(b.name);
  });

  it("ist über 30 Seeds stets deterministisch", () => {
    for (let s = 0; s < 30; s++) {
      const a = generateCharacterName({ cultureName: "Nordmark", traditionId: "clanSept" }, s);
      const b = generateCharacterName({ cultureName: "Nordmark", traditionId: "clanSept" }, s);
      expect(a).toEqual(b);
    }
  });

  it("liefert über 30 Seeds stets nicht-leere Namen", () => {
    for (let s = 0; s < 30; s++) {
      const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "occupational" }, s);
      expect(n.name.length).toBeGreaterThan(0);
    }
  });

  it("fällt bei unbekannter Tradition auf die erste zurück", () => {
    const n = generateCharacterName({ cultureName: "Fremdmark", traditionId: "nope" }, 3);
    expect(n.tradition).toBe("patronymic");
  });

  it("nimmt den leeren Kulturnamen an", () => {
    const n = generateCharacterName({ cultureName: "", traditionId: "patronymic" }, 3);
    expect(n.cultureName).toBe("");
  });

  it("erzeugt 2 bis 3 Silben", () => {
    for (let s = 0; s < 20; s++) {
      const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "patronymic" }, s);
      expect(n.syllables.length).toBeGreaterThanOrEqual(2);
      expect(n.syllables.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("explainNameMeaning — Basisfelder", () => {
  const m = explainNameMeaning("Müller", 42);

  it("echoed den Namen", () => {
    expect(m.name).toBe("Müller");
  });

  it("liefert eine nicht-leere Bedeutung", () => {
    expect(typeof m.meaning).toBe("string");
    expect(m.meaning.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Etymologie", () => {
    expect(typeof m.etymology).toBe("string");
    expect(m.etymology.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Resonanz", () => {
    expect(typeof m.resonance).toBe("string");
    expect(m.resonance.length).toBeGreaterThan(0);
  });

  it("liefert ein components-Array", () => {
    expect(Array.isArray(m.components)).toBe(true);
    expect(m.components.length).toBeGreaterThan(0);
  });

  it("hat Bestandteile mit part und meaning", () => {
    for (const c of m.components) {
      expect(typeof c.part).toBe("string");
      expect(typeof c.meaning).toBe("string");
      expect(c.meaning.length).toBeGreaterThan(0);
    }
  });

  it("ist deterministisch", () => {
    expect(explainNameMeaning("Müller", 42)).toEqual(m);
  });
});

describe("explainNameMeaning — Zerlegung", () => {
  it("erkennt das Abstammungssuffix -son", () => {
    const m = explainNameMeaning("Leifsson", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "son")).toBe(true);
  });

  it("erkennt das Suffix -dóttir", () => {
    const m = explainNameMeaning("Sigridsdóttir", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "dóttir")).toBe(true);
  });

  it("erkennt das Präfix Fitz-", () => {
    const m = explainNameMeaning("Fitzgerald", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "fitz")).toBe(true);
  });

  it("erkennt das Präfix Mac-", () => {
    const m = explainNameMeaning("MacDonald", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "mac")).toBe(true);
  });

  it("erkennt das Präfix ibn-", () => {
    const m = explainNameMeaning("ibn Khaldun", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "ibn")).toBe(true);
  });

  it("erkennt den Beinamen-Artikel der", () => {
    const m = explainNameMeaning("der Eiserne", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "der")).toBe(true);
  });

  it("erkennt den Beinamen-Artikel die", () => {
    const m = explainNameMeaning("die Flinke", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "die")).toBe(true);
  });

  it("erkennt das Suffix -gesicht", () => {
    const m = explainNameMeaning("Wolfsgesicht", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "gesicht")).toBe(true);
  });

  it("erkennt das Suffix -hand", () => {
    const m = explainNameMeaning("Eisenhand", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "hand")).toBe(true);
  });

  it("erkennt das Suffix -herz", () => {
    const m = explainNameMeaning("Felsherz", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "herz")).toBe(true);
  });

  it("erkennt einen ganzen Beinamen als Ganzwort", () => {
    const m = explainNameMeaning("Bluthand", 1);
    expect(m.components[0].meaning).toContain("Bluthand");
  });

  it("erkennt das Berufssuffix -müller", () => {
    const m = explainNameMeaning("Salzmüller", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "müller")).toBe(true);
  });

  it("erkennt das Präfix Clan-", () => {
    const m = explainNameMeaning("Clan MacDuff", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "clan")).toBe(true);
  });

  it("erkennt das Suffix -sept", () => {
    const m = explainNameMeaning("Fionn-Sept", 1);
    expect(m.components.some((c) => c.part.toLowerCase() === "sept")).toBe(true);
  });

  it("zerlegt einen mehrteiligen Namen in mehrere Bestandteile", () => {
    const m = explainNameMeaning("Clan MacDuff", 1);
    expect(m.components.length).toBeGreaterThan(1);
  });
});

describe("explainNameMeaning — Grenzfälle", () => {
  it("behandelt einen leeren Namen", () => {
    const m = explainNameMeaning("", 1);
    expect(m.components.length).toBeGreaterThan(0);
    expect(m.meaning.length).toBeGreaterThan(0);
    expect(m.etymology.length).toBeGreaterThan(0);
    expect(m.resonance.length).toBeGreaterThan(0);
  });

  it("behandelt einen nur aus Leerzeichen bestehenden Namen", () => {
    const m = explainNameMeaning("   ", 1);
    expect(m.components.length).toBeGreaterThan(0);
    expect(m.meaning.length).toBeGreaterThan(0);
  });

  it("behandelt einen sehr langen Namen", () => {
    const long = "Waldsteinwolf".repeat(50);
    const m = explainNameMeaning(long, 1);
    expect(m.meaning.length).toBeGreaterThan(0);
    expect(m.etymology.length).toBeGreaterThan(0);
  });

  it("behandelt Umlaute", () => {
    const m = explainNameMeaning("Grünherz", 1);
    expect(m.components.length).toBeGreaterThan(0);
    expect(m.meaning.length).toBeGreaterThan(0);
  });

  it("ist über mehrere Seeds deterministisch", () => {
    for (let s = 0; s < 10; s++) {
      expect(explainNameMeaning("Bluthand", s)).toEqual(explainNameMeaning("Bluthand", s));
    }
  });

  it("liefert für einen unbekannten Namen einen Stamm-Bestandteil", () => {
    const m = explainNameMeaning("Qxzptl", 1);
    expect(m.components.length).toBeGreaterThan(0);
    expect(m.components[0].part.length).toBeGreaterThan(0);
  });
});

describe("checkNameHarmony — Struktur", () => {
  const h = checkNameHarmony(["Leifsson", "Sigridsdóttir"], "Nordmark", 42);

  it("liefert ein harmonisches-Boolean", () => {
    expect(typeof h.harmonious).toBe("boolean");
  });

  it("liefert einen Score zwischen 0 und 100", () => {
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
  });

  it("liefert einen ganzzahligen Score", () => {
    expect(Number.isInteger(h.score)).toBe(true);
  });

  it("liefert ein violations-Array", () => {
    expect(Array.isArray(h.violations)).toBe(true);
  });

  it("liefert ein suggestions-Array", () => {
    expect(Array.isArray(h.suggestions)).toBe(true);
  });

  it("liefert eine nicht-leere Beschreibung", () => {
    expect(typeof h.description).toBe("string");
    expect(h.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(checkNameHarmony(["Leifsson", "Sigridsdóttir"], "Nordmark", 42)).toEqual(h);
  });
});

describe("checkNameHarmony — Verhalten", () => {
  it("markiert eine leere Namensliste als unharmonisch", () => {
    const h = checkNameHarmony([], "Nordmark", 42);
    expect(h.harmonious).toBe(false);
  });

  it("gibt bei leerer Liste Score 0", () => {
    const h = checkNameHarmony([], "Nordmark", 42);
    expect(h.score).toBe(0);
  });

  it("erzeugt bei leerer Liste einen Vorschlag", () => {
    const h = checkNameHarmony([], "Nordmark", 42);
    expect(h.suggestions.length).toBeGreaterThan(0);
  });

  it("erzeugt bei leerer Liste einen Verstoß", () => {
    const h = checkNameHarmony([], "Nordmark", 42);
    expect(h.violations.length).toBeGreaterThan(0);
  });

  it("erzeugt bei unharmonischen Namen Vorschläge", () => {
    const h = checkNameHarmony(["Xqzvwk"], "Nordmark", 42);
    expect(h.suggestions.length).toBeGreaterThan(0);
  });

  it("erzeugt bei unharmonischen Namen Verstöße", () => {
    const h = checkNameHarmony(["Xqzvwk"], "Nordmark", 42);
    expect(h.violations.length).toBeGreaterThan(0);
  });

  it("harmonisch impliziert keine Verstöße", () => {
    const h = checkNameHarmony(["Müller", "Schmied"], "Nordmark", 42);
    if (h.harmonious) expect(h.violations).toHaveLength(0);
  });

  it("gibt bei leerem Buchstabeninhalt einen Verstoß", () => {
    const h = checkNameHarmony(["---"], "Nordmark", 42);
    expect(h.violations.length).toBeGreaterThan(0);
  });

  it("behandelt Umlaute in Namen", () => {
    const h = checkNameHarmony(["Müller"], "Nordmark", 42);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.description.length).toBeGreaterThan(0);
  });

  it("behandelt sehr lange Namen", () => {
    const h = checkNameHarmony(["Waldsteinwolfwald".repeat(10)], "Nordmark", 42);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
  });

  it("behandelt einen leeren Kulturnamen", () => {
    const h = checkNameHarmony(["Müller"], "", 42);
    expect(h.description.length).toBeGreaterThan(0);
  });

  it("ist über mehrere Seeds deterministisch", () => {
    for (let s = 0; s < 10; s++) {
      expect(checkNameHarmony(["Leifsson"], "Nordmark", s)).toEqual(
        checkNameHarmony(["Leifsson"], "Nordmark", s)
      );
    }
  });

  it("erzeugt höchstens drei Vorschläge bei kurzer Liste", () => {
    const h = checkNameHarmony(["Xqzvwk"], "Nordmark", 42);
    expect(h.suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe("createSampleNameCulture", () => {
  const c = createSampleNameCulture();

  it("liefert ein Objekt", () => {
    expect(c).toBeDefined();
  });

  it("nutzt den Kulturnamen Nordmark", () => {
    expect(c.cultureName).toBe("Nordmark");
  });

  it("nutzt die Patronymika-Tradition", () => {
    expect(c.tradition).toBe("patronymic");
  });

  it("liefert ein nicht-leeres consonants-Array", () => {
    expect(c.consonants.length).toBeGreaterThan(0);
  });

  it("liefert ein nicht-leeres vowels-Array", () => {
    expect(c.vowels.length).toBeGreaterThan(0);
  });

  it("liefert einen nicht-leeren syllableStyle", () => {
    expect(c.syllableStyle.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Beschreibung", () => {
    expect(c.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(createSampleNameCulture()).toEqual(c);
  });
});

describe("createSampleCharacterName", () => {
  const n = createSampleCharacterName();

  it("liefert ein Objekt", () => {
    expect(n).toBeDefined();
  });

  it("liefert einen nicht-leeren Namen", () => {
    expect(n.name.length).toBeGreaterThan(0);
  });

  it("nutzt den Kulturnamen Nordmark", () => {
    expect(n.cultureName).toBe("Nordmark");
  });

  it("nutzt die Patronymika-Tradition", () => {
    expect(n.tradition).toBe("patronymic");
  });

  it("nutzt das Geschlecht male", () => {
    expect(n.gender).toBe("male");
  });

  it("liefert ein nicht-leeres syllables-Array", () => {
    expect(n.syllables.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Bedeutung", () => {
    expect(n.meaning.length).toBeGreaterThan(0);
  });

  it("liefert eine nicht-leere Etymologie", () => {
    expect(n.etymology.length).toBeGreaterThan(0);
  });

  it("berücksichtigt die Rolle Krieger in der Etymologie", () => {
    expect(n.etymology).toContain("Krieger");
  });

  it("ist deterministisch", () => {
    expect(createSampleCharacterName()).toEqual(n);
  });
});

describe("Integration — Kultur und Name", () => {
  it("erzeugt für jede Tradition einen Namen innerhalb ihrer Kultur", () => {
    for (const id of TRADITION_IDS) {
      const name = generateCharacterName({ cultureName: "Nordmark", traditionId: id }, 42);
      expect(name.tradition).toBe(id);
      expect(name.cultureName).toBe("Nordmark");
    }
  });

  it("erklärt einen erzeugten Namen ohne Fehler", () => {
    const name = generateCharacterName({ cultureName: "Nordmark", traditionId: "patronymic" }, 42);
    const m = explainNameMeaning(name.name, 42);
    expect(m.meaning.length).toBeGreaterThan(0);
    expect(m.components.length).toBeGreaterThan(0);
  });

  it("prüft eine Liste erzeugter Namen ohne Fehler", () => {
    const names = TRADITION_IDS.map(
      (id) => generateCharacterName({ cultureName: "Nordmark", traditionId: id }, 42).name
    );
    const h = checkNameHarmony(names, "Nordmark", 42);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.description.length).toBeGreaterThan(0);
  });

  it("liefert über 20 Seeds gültige Kultur-Objekte", () => {
    for (let s = 0; s < 20; s++) {
      const c = buildNameCulture({ cultureName: "Nordmark", traditionId: "epithet" }, s);
      expect(c.consonants.length).toBeGreaterThan(0);
      expect(c.vowels.length).toBeGreaterThan(0);
    }
  });

  it("liefert für alle Traditionen und Geschlechter gültige Namen", () => {
    for (const id of TRADITION_IDS) {
      for (const g of GENDERS) {
        const n = generateCharacterName({ cultureName: "Nordmark", traditionId: id, gender: g }, 42);
        expect(n.name.length).toBeGreaterThan(0);
        expect(n.gender).toBe(g);
      }
    }
  });

  it("echoed bei jedem Namen den übergebenen Kulturnamen", () => {
    for (const cn of ["Nordmark", "Südland", "Fremdmark"]) {
      const n = generateCharacterName({ cultureName: cn, traditionId: "occupational" }, 42);
      expect(n.cultureName).toBe(cn);
    }
  });

  it("erzeugt über 40 Seeds keine leeren Namen", () => {
    for (let s = 0; s < 40; s++) {
      const n = generateCharacterName({ cultureName: "Nordmark", traditionId: "clanSept" }, s);
      expect(n.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("erklärt alle vier Beispielnamen der Kataloge ohne Fehler", () => {
    for (const t of NAMING_TRADITIONS) {
      for (const ex of t.examples) {
        const m = explainNameMeaning(ex, 42);
        expect(m.meaning.length).toBeGreaterThan(0);
        expect(m.components.length).toBeGreaterThan(0);
      }
    }
  });
});
