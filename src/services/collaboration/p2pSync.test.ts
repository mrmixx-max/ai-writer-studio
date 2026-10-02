// Tests: P2P-Sync-Service (WP 14.2, Zero-Cloud Co-Authoring).
//
// Rein lokale, deterministische Tests — kein LLM, kein Netzwerk. WebRTC wird
// ueber die injizierbare DeltaTransport-Schnittstelle gemockt (MockTransport).
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetP2PStore,
  __setClock,
  addPeer,
  applyRemoteDelta,
  broadcastDelta,
  createP2PSession,
  getAppliedDeltas,
  getBroadcasts,
  getDisconnectedAt,
  getPeers,
  getPendingDeltas,
  handleDisconnect,
  isConnected,
  isWebRTCSupported,
  reconnectSession,
  removePeer,
  setTransport,
  subscribe,
  type DeltaTransport,
  type P2PSession,
  type TextDelta,
} from "./p2pSync";

/** Mock-Transport: protokolliert alle send()-Aufrufe (ersetzt WebRTC). */
class MockTransport implements DeltaTransport {
  readonly sent: { peerId: string; delta: TextDelta }[] = [];
  closed = false;
  send(peerId: string, delta: TextDelta): void {
    this.sent.push({ peerId, delta: { ...delta } });
  }
  close(): void {
    this.closed = true;
  }
}

const delta = (from: number, to: number, insert: string, del = ""): TextDelta => ({
  from,
  to,
  insert,
  delete: del,
});

beforeEach(() => {
  __resetP2PStore();
});

describe("createP2PSession", () => {
  it("erstellt eine Session mit Default-Status, leerer Peer-Liste und lastSync", () => {
    __setClock(() => 1000);
    const session = createP2PSession("s1");
    expect(session.id).toBe("s1");
    expect(session.status).toBe("connected");
    expect(session.peers).toEqual([]);
    expect(session.lastSync).toBe(1000);
  });

  it("ist idempotent — dieselbe ID liefert dieselbe Session-Instanz", () => {
    const a = createP2PSession("dup");
    const b = createP2PSession("dup");
    expect(b).toBe(a);
  });

  it("vergibt eine deterministische Fallback-ID bei leerer sessionId (kein Throw)", () => {
    const a = createP2PSession("");
    const b = createP2PSession("   ");
    expect(a.id).toMatch(/^sess-/);
    expect(b.id).toMatch(/^sess-/);
    expect(a.id).not.toBe(b.id);
  });

  it("uebernimmt optionale Peers und fuellt fehlende Felder defensiv", () => {
    const session = createP2PSession("s-peers", {
      peers: [{ id: "p1", name: "Anna", color: "#fff", cursorPosition: 5 }, {}, null],
    });
    const peers = getPeers(session);
    expect(peers).toHaveLength(3);
    expect(peers[0]).toEqual({ id: "p1", name: "Anna", color: "#fff", cursorPosition: 5 });
    expect(peers[1].id).toMatch(/^peer-/);
    expect(peers[1].name).toBe("Peer 2");
    expect(peers[1].cursorPosition).toBe(0);
    expect(peers[2].id).toMatch(/^peer-/);
  });
});

describe("addPeer / removePeer / getPeers", () => {
  it("ergaenzt einen Peer mit sicheren Defaults", () => {
    const session = createP2PSession("s-add");
    const peer = addPeer(session, { id: "pA" });
    expect(peer).not.toBeNull();
    expect(peer!.id).toBe("pA");
    expect(peer!.name).toBe("Peer 1");
    expect(peer!.color).toMatch(/^#/);
    expect(peer!.cursorPosition).toBe(0);
  });

  it("vergibt bei doppelter Peer-ID eine neue eindeutige ID", () => {
    const session = createP2PSession("s-dup");
    addPeer(session, { id: "same" });
    const second = addPeer(session, { id: "same" });
    expect(second!.id).not.toBe("same");
    expect(getPeers(session)).toHaveLength(2);
  });

  it("removePeer entfernt genau den Peer und meldet den Erfolg", () => {
    const session = createP2PSession("s-rm");
    addPeer(session, { id: "x" });
    addPeer(session, { id: "y" });
    expect(removePeer(session, "x")).toBe(true);
    expect(removePeer(session, "gibts-nicht")).toBe(false);
    expect(getPeers(session).map((p) => p.id)).toEqual(["y"]);
  });

  it("liefert leere Ergebnisse bei ungueltiger Session statt zu werfen", () => {
    expect(getPeers(null as unknown as P2PSession)).toEqual([]);
    expect(addPeer(undefined as unknown as P2PSession, { id: "p" })).toBeNull();
    expect(removePeer({} as P2PSession, "p")).toBe(false);
  });
});

describe("broadcastDelta", () => {
  it("sendet ein Delta an alle Peers und aktualisiert lastSync", () => {
    const transport = new MockTransport();
    __setClock(() => 500);
    const session = createP2PSession("s-bc", {
      transport,
      peers: [{ id: "p1" }, { id: "p2" }],
    });
    broadcastDelta(session, delta(0, 0, "Hallo"));
    expect(transport.sent).toHaveLength(2);
    expect(transport.sent.map((s) => s.peerId).sort()).toEqual(["p1", "p2"]);
    expect(transport.sent[0].delta).toEqual({ from: 0, to: 0, insert: "Hallo", delete: "" });
    expect(session.lastSync).toBe(500);
    expect(getBroadcasts(session)).toHaveLength(1);
  });

  it("klemmt ungueltige Delta-Positionen defensiv (negativ, to<from)", () => {
    const transport = new MockTransport();
    const session = createP2PSession("s-clamp", { transport, peers: [{ id: "p1" }] });
    broadcastDelta(session, { from: -5, to: -1, insert: "x", delete: "" });
    expect(transport.sent[0].delta).toEqual({ from: 0, to: 0, insert: "x", delete: "" });
  });

  it("ist ein No-op bei ungueltigem Delta oder fehlender Session", () => {
    const transport = new MockTransport();
    const session = createP2PSession("s-noop", { transport, peers: [{ id: "p1" }] });
    broadcastDelta(session, { from: NaN, to: 0, insert: "x", delete: "" });
    broadcastDelta(session, null as unknown as TextDelta);
    broadcastDelta(null as unknown as P2PSession, delta(0, 0, "x"));
    expect(transport.sent).toHaveLength(0);
    expect(getBroadcasts(session)).toHaveLength(0);
  });

  it("bricht den Broadcast nicht ab, wenn ein Peer-Transport wirft", () => {
    const transport: DeltaTransport = {
      send: vi.fn(() => {
        throw new Error("channel closed");
      }),
    };
    const session = createP2PSession("s-throw", { transport, peers: [{ id: "p1" }] });
    expect(() => broadcastDelta(session, delta(0, 0, "x"))).not.toThrow();
    expect(getBroadcasts(session)).toHaveLength(1);
  });
});

describe("applyRemoteDelta", () => {
  it("protokolliert das Delta und aktualisiert lastSync", () => {
    __setClock(() => 777);
    const session = createP2PSession("s-apply");
    applyRemoteDelta(session, delta(3, 5, "neu", "alt"));
    expect(getAppliedDeltas(session)).toEqual([{ from: 3, to: 5, insert: "neu", delete: "alt" }]);
    expect(session.lastSync).toBe(777);
  });

  it("benachrichtigt registrierte Listener", () => {
    const session = createP2PSession("s-sub");
    const received: TextDelta[] = [];
    const unsub = subscribe(session, (d) => received.push(d));
    applyRemoteDelta(session, delta(0, 0, "a"));
    applyRemoteDelta(session, delta(1, 1, "b"));
    expect(received.map((d) => d.insert)).toEqual(["a", "b"]);
    unsub();
    applyRemoteDelta(session, delta(2, 2, "c"));
    expect(received).toHaveLength(2);
  });

  it("ignoriert ungueltige Deltas und fehlende Sessions", () => {
    const session = createP2PSession("s-bad");
    applyRemoteDelta(session, { from: "x" as unknown as number, to: 1, insert: "", delete: "" });
    applyRemoteDelta(session, undefined as unknown as TextDelta);
    applyRemoteDelta(undefined as unknown as P2PSession, delta(0, 0, "x"));
    expect(getAppliedDeltas(session)).toEqual([]);
  });

  it("ein werfender Listener blockiert andere Listener nicht", () => {
    const session = createP2PSession("s-listeners");
    const ok = vi.fn();
    subscribe(session, () => {
      throw new Error("kaputt");
    });
    subscribe(session, ok);
    expect(() => applyRemoteDelta(session, delta(0, 0, "x"))).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe("handleDisconnect", () => {
  it("setzt die Session auf disconnected und merkt sich den Zeitpunkt", () => {
    __setClock(() => 9000);
    const session = createP2PSession("s-off");
    handleDisconnect(session);
    expect(session.status).toBe("disconnected");
    expect(isConnected(session)).toBe(false);
    expect(getDisconnectedAt(session)).toBe(9000);
  });

  it("ist idempotent — mehrfacher Disconnect aendert nichts", () => {
    __setClock(() => 100);
    const session = createP2PSession("s-off2");
    handleDisconnect(session);
    __setClock(() => 200);
    handleDisconnect(session);
    expect(getDisconnectedAt(session)).toBe(100);
  });

  it("ist ein No-op bei ungueltiger Session", () => {
    expect(() => handleDisconnect(null as unknown as P2PSession)).not.toThrow();
    expect(() => handleDisconnect({} as P2PSession)).not.toThrow();
  });

  it("puffert Broadcasts offline und flusht sie beim Reconnect", () => {
    const transport = new MockTransport();
    const session = createP2PSession("s-buffer", { transport, peers: [{ id: "p1" }] });
    handleDisconnect(session);
    broadcastDelta(session, delta(0, 0, "offline-1"));
    broadcastDelta(session, delta(1, 1, "offline-2"));
    expect(transport.sent).toHaveLength(0);
    expect(getPendingDeltas(session)).toHaveLength(2);

    reconnectSession(session);
    expect(session.status).toBe("connected");
    expect(getDisconnectedAt(session)).toBeNull();
    expect(getPendingDeltas(session)).toHaveLength(0);
    expect(transport.sent.map((s) => s.delta.insert)).toEqual(["offline-1", "offline-2"]);
  });
});

describe("Transport & Umgebung", () => {
  it("setTransport ersetzt den lokalen No-op-Transport", () => {
    const session = createP2PSession("s-transport", { peers: [{ id: "p1" }] });
    const transport = new MockTransport();
    setTransport(session, transport);
    broadcastDelta(session, delta(0, 0, "x"));
    expect(transport.sent).toHaveLength(1);
    // null faellt auf den lokalen No-op zurueck (kein Crash, kein Versand)
    setTransport(session, null);
    expect(() => broadcastDelta(session, delta(0, 0, "y"))).not.toThrow();
    expect(transport.sent).toHaveLength(1);
  });

  it("isWebRTCSupported liefert einen booleschen Wert ohne zu werfen", () => {
    expect(typeof isWebRTCSupported()).toBe("boolean");
  });
});
