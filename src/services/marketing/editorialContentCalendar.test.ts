// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  CAMPAIGN_PHASES,
  getCampaignPhase,
  phaseForDay,
  CHANNELS,
  getChannel,
  generateCalendarEntry,
  generateEditorialCalendar,
  exportCalendarToCsv,
  exportCalendarToMarkdown,
  createSampleCalendarEntry,
  createSampleEditorialCalendar,
} from "./editorialContentCalendar";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(17);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("CAMPAIGN_PHASES", () => {
  it("enthält vier Kampagnen-Phasen", () => {
    expect(CAMPAIGN_PHASES).toHaveLength(4);
  });
  it("Phasen sind aufeinanderfolgend", () => {
    for (let i = 1; i < CAMPAIGN_PHASES.length; i++) {
      expect(CAMPAIGN_PHASES[i].startDay).toBe(CAMPAIGN_PHASES[i - 1].endDay + 1);
    }
  });
  it("Pre-Order beginnt am Tag 1", () => {
    expect(getCampaignPhase("preOrder")!.startDay).toBe(1);
  });
  it("Post-Launch endet am Tag 30", () => {
    expect(getCampaignPhase("postLaunch")!.endDay).toBe(30);
  });
  it("getCampaignPhase lieferv undefined für unbekannt", () => {
    expect(getCampaignPhase("xyz" as never)).toBeUndefined();
  });
});

describe("phaseForDay", () => {
  it("Tag 1 ist Pre-Order", () => {
    expect(phaseForDay(1).id).toBe("preOrder");
  });
  it("Tag 15 ist Hype-Countdown", () => {
    expect(phaseForDay(15).id).toBe("hypeCountdown");
  });
  it("Tag 22 ist Release-Week", () => {
    expect(phaseForDay(22).id).toBe("releaseWeek");
  });
  it("Tag 28 ist Post-Launch", () => {
    expect(phaseForDay(28).id).toBe("postLaunch");
  });
  it("Tag 0 wird auf 1 begrenzt", () => {
    expect(phaseForDay(0).id).toBe("preOrder");
  });
  it("Tag 31 wird auf 30 begrenzt", () => {
    expect(phaseForDay(31).id).toBe("postLaunch");
  });
});

describe("CHANNELS", () => {
  it("enthält fünf Kanäle", () => {
    expect(CHANNELS).toHaveLength(5);
  });
  it("jeder Kanal hat beste Uhrzeit und Format", () => {
    for (const c of CHANNELS) {
      expect(c.bestTime.length).toBeGreaterThan(0);
      expect(c.format.length).toBeGreaterThan(0);
    }
  });
  it("getChannel liefert undefined für unbekannt", () => {
    expect(getChannel("xyz" as never)).toBeUndefined();
  });
});

describe("generateCalendarEntry", () => {
  it("ist deterministisch", () => {
    expect(generateCalendarEntry(15, 42).title).toBe(generateCalendarEntry(15, 42).title);
  });
  it("enthält Tag, Phase, Kanal, Titel, Beschreibung, Hashtags und CTA", () => {
    const e = generateCalendarEntry(10, 42);
    expect(e.day).toBe(10);
    expect(e.phase.id).toBe("preOrder");
    expect(e.channel.name.length).toBeGreaterThan(0);
    expect(e.title.length).toBeGreaterThan(0);
    expect(e.description.length).toBeGreaterThan(0);
    expect(e.hashtags.length).toBeGreaterThan(0);
    expect(e.cta.length).toBeGreaterThan(0);
  });
  it("Tag 0 wird auf 1 begrenzt", () => {
    expect(generateCalendarEntry(0, 42).day).toBe(1);
  });
  it("Tag 31 wird auf 30 begrenzt", () => {
    expect(generateCalendarEntry(31, 42).day).toBe(30);
  });
});

describe("generateEditorialCalendar", () => {
  it("ist deterministisch", () => {
    expect(generateEditorialCalendar(42).id).toBe(generateEditorialCalendar(42).id);
  });
  it("erzeugt 30 Einträge", () => {
    expect(generateEditorialCalendar(42).entries).toHaveLength(30);
  });
  it("Einträge sind aufsteigend sortiert", () => {
    const cal = generateEditorialCalendar(42);
    for (let i = 1; i < cal.entries.length; i++) {
      expect(cal.entries[i].day).toBeGreaterThan(cal.entries[i - 1].day);
    }
  });
  it("enthält alle Phasen und Kanäle", () => {
    const cal = generateEditorialCalendar(42);
    expect(cal.phases).toHaveLength(4);
    expect(cal.channels).toHaveLength(5);
  });
});

describe("exportCalendarToCsv", () => {
  it("ist deterministisch", () => {
    const cal = generateEditorialCalendar(42);
    expect(exportCalendarToCsv(cal).content).toBe(exportCalendarToCsv(cal).content);
  });
  it("enthält Kopfzeile und 30 Datenzeilen", () => {
    const csv = exportCalendarToCsv(generateEditorialCalendar(42));
    expect(csv.header).toContain("Tag");
    expect(csv.rows).toHaveLength(30);
    expect(csv.content.split("\n")).toHaveLength(31);
  });
  it("escaped Anführungszeichen in Zellen", () => {
    const csv = exportCalendarToCsv(generateEditorialCalendar(42));
    // Jede Zelle ist in Anführungszeichen eingeschlossen
    const firstRow = csv.rows[0];
    expect(firstRow).toMatch(/^".*";".*";".*";".*";".*";".*";".*"$/);
  });
});

describe("exportCalendarToMarkdown", () => {
  it("ist deterministisch", () => {
    const cal = generateEditorialCalendar(42);
    expect(exportCalendarToMarkdown(cal).content).toBe(exportCalendarToMarkdown(cal).content);
  });
  it("enthält Titel und 4 Phasen-Abschnitte", () => {
    const md = exportCalendarToMarkdown(generateEditorialCalendar(42));
    expect(md.title).toContain("30-Tage-Launch-Redaktionskalender");
    expect(md.sections).toHaveLength(4);
  });
  it("enthält alle 30 Tage", () => {
    const md = exportCalendarToMarkdown(generateEditorialCalendar(42));
    for (let d = 1; d <= 30; d++) {
      expect(md.content).toContain(`Tag ${d}`);
    }
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleCalendarEntry liefert Tag 15", () => {
    expect(createSampleCalendarEntry().day).toBe(15);
  });
  it("createSampleEditorialCalendar liefert 30 Einträge", () => {
    expect(createSampleEditorialCalendar().entries).toHaveLength(30);
  });
});
