// Stimmen-Labor (Stilprofile): CRUD gegen echte Test-DB (sql.js, kein Netz).
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createVoice, listVoices, deleteVoice, toggleFavoriteVoice } from "@/services/voice";

describe("voice service", () => {
  beforeEach(async () => {
    await initDb();
    // DB ist Singleton (cached) → zwischen Tests aufräumen
    const db = (globalThis as any).__aws_db;
    db.run("DELETE FROM voices");
  });

  it("erstellt eine Stimme und listet sie", async () => {
    const v = await createVoice("Erzähler", "Warm und ruhig", "Schreibe {{text}} im Stil …");
    expect(v.id).toMatch(/^voice_/);
    expect(v.isFavorite).toBe(false);
    const all = listVoices();
    expect(all.some((x) => x.id === v.id && x.name === "Erzähler")).toBe(true);
  });

  it("toggleFavoriteVoice markiert Favorit", async () => {
    const v = await createVoice("Dialog", "Knackig", "Tmpl");
    await toggleFavoriteVoice(v.id, true);
    expect(listVoices().find((x) => x.id === v.id)?.isFavorite).toBe(true);
    await toggleFavoriteVoice(v.id, false);
    expect(listVoices().find((x) => x.id === v.id)?.isFavorite).toBe(false);
  });

  it("deleteVoice entfernt die Stimme", async () => {
    const v = await createVoice("Temp", "x", "Tmpl");
    await deleteVoice(v.id);
    expect(listVoices().some((x) => x.id === v.id)).toBe(false);
  });

  it("listVoices startet leer", () => {
    expect(listVoices()).toEqual([]);
  });
});
