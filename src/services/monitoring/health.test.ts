// Health-Regressionstests (Agent a3-sec): Platten-Berechnung (bavail*bsize)
// und kein Down-Fehlalarm ohne Node-FS (Browser/Tauri-Webview).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  statfs: vi.fn(),
}));
vi.mock("node:os", () => ({
  homedir: () => "/tmp",
}));

import { statfs } from "node:fs/promises";
import { checkDiskSpace } from "./health";

const mockStatfs = statfs as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockStatfs.mockReset();
});

describe("checkDiskSpace (a3-sec)", () => {
  it("rechnet frei = bavail * bsize (nicht bavail * bfree)", async () => {
    // bfree riesig (alter Code: 100*10_000_000 = 1 GB → fälschlich ok),
    // real frei: 100 * 4096 = 409_600 B < 500 MB → degraded.
    mockStatfs.mockResolvedValue({ bavail: 100, bfree: 10_000_000, bsize: 4096 });
    const r = await checkDiskSpace();
    expect(r.name).toBe("disk");
    expect(r.status).toBe("degraded");
    expect(r.message).toContain("Low space");
  });

  it("meldet ok bei ausreichend Platz", async () => {
    mockStatfs.mockResolvedValue({ bavail: 200_000_000, bfree: 190_000_000, bsize: 4096 });
    const r = await checkDiskSpace();
    expect(r.status).toBe("ok");
  });

  it("meldet degraded statt down ohne Node-FS (Fehlalarm-Schutz)", async () => {
    mockStatfs.mockRejectedValue(new Error("Cannot find module 'node:fs/promises'"));
    const r = await checkDiskSpace();
    expect(r.status).toBe("degraded");
    expect(r.message).toContain("nicht verfügbar");
  });
});
