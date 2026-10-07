// @vitest-environment jsdom
/** Tests: CloudlessP2pMesh (WP 91.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createMeshConfig,
  createSampleStatus,
  createSampleDelta,
  type MeshConfig as _MeshConfig,
  type MeshStatus as _MeshStatus,
  type SyncDelta as _SyncDelta,
} from "./cloudlessP2pMesh";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("createMeshConfig", () => {
  it("erzeugt Standard-Konfiguration", () => {
    const config = createMeshConfig();
    expect(config.iceServers.length).toBeGreaterThan(0);
    expect(config.maxPeers).toBe(8);
    expect(config.syncIntervalMs).toBe(5000);
  });

  it("akzeptiert benutzerdefinierte ICE-Server", () => {
    const custom = [{ urls: "stun:custom.example.com" }];
    const config = createMeshConfig(custom);
    expect(config.iceServers).toEqual(custom);
  });
});

describe("CloudlessP2pMesh (Klasse)", () => {
  it("kann instanziiert werden", async () => {
    const config = createMeshConfig();
    const { CloudlessP2pMesh } = await import("./cloudlessP2pMesh");
    const mesh = new CloudlessP2pMesh(config);
    expect(mesh).toBeDefined();
  });
});

describe("createSampleStatus", () => {
  it("erzeugt Beispiel-Status", () => {
    const status = createSampleStatus();
    expect(status.deviceId).toContain("DEV-");
    expect(status.deviceName).toBe("Laptop-Autor");
    expect(status.state).toBe("connected");
    expect(status.connectedPeers).toBe(1);
    expect(status.maxPeers).toBe(8);
  });
});

describe("createSampleDelta", () => {
  it("erzeugt Beispiel-Delta", () => {
    const delta = createSampleDelta();
    expect(delta.id).toContain("DELTA-");
    expect(delta.chapterId).toBe("ch-1");
    expect(delta.operation).toBe("insert");
    expect(delta.vectorClock).toBeDefined();
  });
});

// Device-Erstellung ist async, wird in Integrationstests geprüft
describe("Device-Erstellung (Integration)", () => {
  it("erzeugt Device mit Key-Pair (async)", async () => {
    const { createDevice } = await import("./cloudlessP2pMesh");
    const device = await createDevice("Test-Gerät", 42);
    expect(device.id).toContain("DEV-");
    expect(device.name).toBe("Test-Gerät");
    expect(device.publicKey).toBeTruthy();
    expect(device.role).toBe("initiator");
  });
});