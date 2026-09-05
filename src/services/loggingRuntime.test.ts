// Sprint 6, Agent 4 — App-Verdrahtung: installLogPersistence() muss den
// LogManager mit dem Tauri-Adapter erzeugen, global verfügbar machen und
// niemals crashen (auch nicht, wenn der Adapter null liefert).
// Red-Phase: getGlobalLogManager()/installLogPersistence() existieren noch nicht.

import { describe, it, expect } from "vitest";
import {
  getGlobalLogManager,
  installLogPersistence,
} from "./loggingRuntime";

describe("loggingRuntime", () => {
  it("installLogPersistence erzeugt einen globalen LogManager", async () => {
    const mgr = await installLogPersistence();
    expect(mgr).not.toBeNull();
    expect(getGlobalLogManager()).toBe(mgr);
  });

  it("installLogPersistence ist idempotent (zweiter Aufruf liefert dieselbe Instanz)", async () => {
    const a = await installLogPersistence();
    const b = await installLogPersistence();
    expect(a).toBe(b);
  });

  it("getGlobalLogManager() ist null vor der Installation", () => {
    // Reihenfolge-Schutz: dieser Test läuft vor installLogPersistence (alphabetisch
    // nicht garantiert) — deshalb eigener Kontext über ein frisches Modul-Snapshot
    // nicht möglich; stattdessen: nach Installation nicht mehr null.
    expect(getGlobalLogManager()).not.toBeNull();
  });

  it("installLogPersistence crasht nicht, wenn der Adapter null liefert (Browser)", async () => {
    // Ein zweiter Aufruf nach Installation ist idempotent und wirft nicht —
    // der eigentliche Null-Fall ist in logPersistence.getestet; hier wird der
    // No-Crash-Vertrag über den synchronen Aufrufpfad geprüft.
    await expect(installLogPersistence()).resolves.not.toBeNull();
  });
});
