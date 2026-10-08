// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  ROLE_DEFINITIONS,
  getRoleDefinition,
  hasPermission,
  canEditChapter,
  canDelete,
  presenceColor,
  createGuildSession,
  addSeat,
  removeSeat,
  setSeatOnline,
  updateCursor,
  getOnlineSeats,
  encryptDelta,
  decryptDelta,
  createDelta,
  applyDelta,
  receiveDelta,
  buildRoster,
  createSampleGuildSession,
} from "./writersGuildHub";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("ROLE_DEFINITIONS", () => {
  it("enthält fünf Rollen", () => {
    expect(ROLE_DEFINITIONS).toHaveLength(5);
  });
  it("jede Rolle hat ein Label und Berechtigungen", () => {
    for (const r of ROLE_DEFINITIONS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.permissions.length).toBeGreaterThan(0);
    }
  });
  it("getRoleDefinition findet Hauptautor", () => {
    expect(getRoleDefinition("leadAuthor")?.label).toBe("Hauptautor");
  });
});

describe("hasPermission", () => {
  it("Hauptautor darf alles löschen", () => {
    expect(hasPermission("leadAuthor", "deleteContent")).toBe(true);
  });
  it("Lektor darf nicht löschen", () => {
    expect(hasPermission("editor", "deleteContent")).toBe(false);
  });
  it("Beta-Leser darf kommentieren, aber nicht bearbeiten", () => {
    expect(hasPermission("betaReader", "comment")).toBe(true);
    expect(hasPermission("betaReader", "editAllChapters")).toBe(false);
  });
  it("Sensitivitäts-Leser liest nur markierte Szenen", () => {
    expect(hasPermission("sensitivityReader", "readMarkedScenes")).toBe(true);
    expect(hasPermission("sensitivityReader", "readAll")).toBe(false);
  });
  it("unbekannte Rolle hat keine Rechte", () => {
    expect(hasPermission("xyz" as never, "readAll")).toBe(false);
  });
});

describe("canEditChapter", () => {
  it("Hauptautor darf jedes Kapitel", () => {
    expect(canEditChapter("leadAuthor", [], "akt-9")).toBe(true);
  });
  it("Co-Autor nur zugewiesene Akte", () => {
    expect(canEditChapter("coAuthor", ["akt-1"], "akt-1")).toBe(true);
    expect(canEditChapter("coAuthor", ["akt-1"], "akt-2")).toBe(false);
  });
  it("Lektor darf gar nicht schreiben", () => {
    expect(canEditChapter("editor", ["akt-1"], "akt-1")).toBe(false);
  });
});

describe("canDelete", () => {
  it("nur Hauptautor darf löschen", () => {
    expect(canDelete("leadAuthor")).toBe(true);
    expect(canDelete("coAuthor")).toBe(false);
    expect(canDelete("editor")).toBe(false);
  });
});

describe("presenceColor", () => {
  it("ist deterministisch", () => {
    expect(presenceColor("seat-1")).toBe(presenceColor("seat-1"));
  });
  it("liefert einen Design-Token-Namen, keine Hex-Farbe", () => {
    const c = presenceColor("seat-2");
    expect(c.startsWith("--")).toBe(true);
    expect(c.match(/#[0-9a-fA-F]{3,8}/)).toBeNull();
  });
});

describe("Guild-Sitzungen", () => {
  it("erstellt eine verschlüsselte Sitzung", () => {
    const s = createGuildSession("Projekt");
    expect(s.encrypted).toBe(true);
    expect(s.seats).toHaveLength(0);
  });
  it("addSeat fügt Sitze hinzu", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    s = addSeat(s, "Ben", "editor");
    expect(s.seats).toHaveLength(2);
    expect(s.seats[0].color.startsWith("--")).toBe(true);
  });
  it("removeSeat entfernt Sitz und Cursor", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    s = updateCursor(s, "seat-1", "kap-1", 10);
    s = removeSeat(s, "seat-1");
    expect(s.seats).toHaveLength(0);
    expect(s.cursors).toHaveLength(0);
  });
  it("setSeatOnline schaltet Präsenz um", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    s = setSeatOnline(s, "seat-1", false);
    expect(getOnlineSeats(s)).toHaveLength(0);
  });
  it("updateCursor ersetzt die Position desselben Sitzes", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    s = updateCursor(s, "seat-1", "kap-1", 10);
    s = updateCursor(s, "seat-1", "kap-2", 20);
    expect(s.cursors).toHaveLength(1);
    expect(s.cursors[0].offset).toBe(20);
  });
  it("mutiert die Eingabesitzung nicht", () => {
    const s = createGuildSession("P");
    addSeat(s, "Anna", "leadAuthor");
    expect(s.seats).toHaveLength(0);
  });
});

describe("Delta-Verschlüsselung", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const payload = "insert|5|Lyra trat ein.";
    const enc = encryptDelta(payload, "geheim");
    expect(enc.startsWith("e2e:")).toBe(true);
    expect(enc).not.toContain("Lyra");
    expect(decryptDelta(enc, "geheim")).toBe(payload);
  });
  it("falscher Schlüssel liefert anderen Klartext", () => {
    const enc = encryptDelta("insert|1|abc", "key1");
    expect(decryptDelta(enc, "key2")).not.toBe("insert|1|abc");
  });
  it("ungültiges Format liefert null", () => {
    expect(decryptDelta("plain", "k")).toBeNull();
  });
  it("encryptDelta ist deterministisch", () => {
    expect(encryptDelta("a|b|c", "k")).toBe(encryptDelta("a|b|c", "k"));
  });
});

describe("createDelta / applyDelta", () => {
  it("erzeugt ein Delta mit Ciphertext", () => {
    const d = createDelta("seat-1", "kap-1", "insert", 0, "Hallo", "k");
    expect(d.ciphertext.startsWith("e2e:")).toBe(true);
    expect(d.id.startsWith("delta-")).toBe(true);
  });
  it("wendet Delta bei Schreibrecht an", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    const d = createDelta("seat-1", "kap-1", "insert", 0, "x", "k");
    expect(applyDelta(s, d).applied).toBe(true);
  });
  it("weist Delta ohne Schreibrecht ab", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Lektor", "editor");
    const d = createDelta("seat-1", "kap-1", "insert", 0, "x", "k");
    const res = applyDelta(s, d);
    expect(res.applied).toBe(false);
    expect(res.reason).toContain("darf");
  });
  it("unbekannter Sitz wird abgewiesen", () => {
    const s = createGuildSession("P");
    const d = createDelta("seat-99", "kap-1", "insert", 0, "x", "k");
    expect(applyDelta(s, d).applied).toBe(false);
  });
});

describe("receiveDelta", () => {
  it("verarbeitet ein gültiges verschlüsseltes Delta", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    const enc = encryptDelta("insert|3|Text", "k");
    const d = receiveDelta(s, enc, "k");
    expect(d).not.toBeNull();
    expect(d?.text).toBe("Text");
  });
  it("liefert null bei ungültigem Ciphertext", () => {
    let s = createGuildSession("P");
    s = addSeat(s, "Anna", "leadAuthor");
    expect(receiveDelta(s, "kaputt", "k")).toBeNull();
  });
  it("liefert null ohne Sitze", () => {
    const s = createGuildSession("P");
    expect(receiveDelta(s, encryptDelta("insert|0|x", "k"), "k")).toBeNull();
  });
});

describe("buildRoster", () => {
  it("erstellt Rollen-Einträge mit Label und Farben", () => {
    const roster = buildRoster(createSampleGuildSession());
    expect(roster).toHaveLength(5);
    expect(roster[0].roleLabel).toBe("Hauptautor");
    expect(roster[0].color.startsWith("--")).toBe(true);
  });
});

describe("createSampleGuildSession", () => {
  it("erzeugt fünf Sitze mit allen Rollen", () => {
    const s = createSampleGuildSession();
    expect(s.seats).toHaveLength(5);
    const roles = s.seats.map((x) => x.role);
    expect(roles).toContain("leadAuthor");
    expect(roles).toContain("sensitivityReader");
  });
});
