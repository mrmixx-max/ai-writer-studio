// Tests für crashRecovery.ts — Snapshot-Erkennung (WP4.2).
//
// Hintergrund: Die Snapshot-Rotation (pruneSnapshots) und die
// Wiederherstellung (loadWithRecovery) filterten Dateien nach dem
// hartcodierten Präfix "app.db.snapshot-". Der berechnete `prefix` war
// toter Code (void prefix). Eine Umbenennung der DB-Datei hätte die
// Erkennung lautlos gebrochen — die Rotation würde nie greifen.
//
// Diese Tests decken snapshotPrefix ab, damit das nicht erneut passiert.

import { describe, it, expect } from "vitest";
import { snapshotPrefix } from "./crashRecovery";

describe("snapshotPrefix", () => {
  it("leitet das Präfix aus einem Windows-Pfad ab", () => {
    expect(snapshotPrefix("C:\\Users\\test\\AppData\\Roaming\\com.aiwriterstudio.app\\user_data\\app.db")).toBe(
      "app.db.snapshot-",
    );
  });

  it("leitet das Präfix aus einem POSIX-Pfad ab", () => {
    expect(snapshotPrefix("/home/user/.local/share/com.aiwriterstudio.app/user_data/app.db")).toBe(
      "app.db.snapshot-",
    );
  });

  it("funktioniert ohne Verzeichnisanteil", () => {
    expect(snapshotPrefix("app.db")).toBe("app.db.snapshot-");
  });

  it("folgt einer Umbenennung der DB-Datei (Regression)", () => {
    // Das ist der eigentliche Bug: Hartcodiert "app.db.snapshot-" würde hier
    // "manuskript.db.snapshot-" nicht erkennen.
    expect(snapshotPrefix("C:\\Daten\\manuskript.db")).toBe("manuskript.db.snapshot-");
  });

  it("erkennt keine fremden Dateien mit ähnlichem Namen", () => {
    // "app.db.bak" ist die manuelle Sicherung, kein Snapshot.
    const prefix = snapshotPrefix("app.db");
    expect("app.db.bak".startsWith(prefix)).toBe(false);
    expect("app.db.snapshot-20260101-120000-test".startsWith(prefix)).toBe(true);
  });
});
