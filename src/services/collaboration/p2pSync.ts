// P2P-Sync-Service (WP 14.2): Zero-Cloud Co-Authoring.
//
// Rein lokaler, deterministischer Service fuer Peer-to-Peer-Textsynchronisation
// ohne Cloud-Backend. Es findet KEIN LLM-Aufruf und KEIN ungefragter
// Netzwerkzugriff statt: Die eigentliche WebRTC-Transport-Schicht wird ueber
// die injizierbare `DeltaTransport`-Schnittstelle abstrahiert. Der
// Default-Transport ist ein lokaler No-op (Zero-Cloud); in Tests wird ein Mock
// injiziert (siehe p2pSync.test.ts).
//
// Alle oeffentlichen Funktionen sind defensiv: fehlende, unvollstaendige oder
// ungueltige Daten fuehren zu einem neutralen No-op bzw. zu sicheren Defaults
// statt zu einer Exception. Das haelt den Sync robust gegen abgebrochene
// Peers, halb empfangene Nachrichten und Reconnect-Situationen.

export type SessionStatus = "connected" | "disconnected";

/** Ein Teilnehmer der Session. */
export interface Peer {
  id: string;
  name: string;
  /** Anzeigefarbe im Editor (Hex). */
  color: string;
  /** Aktuelle Cursor-Position (Text-Offset), 0 wenn unbekannt. */
  cursorPosition: number;
}

/** Eine P2P-Synchronisations-Session. */
export interface P2PSession {
  id: string;
  peers: Peer[];
  status: SessionStatus;
  /** Zeitstempel (ms) der letzten erfolgreichen Synchronisation. */
  lastSync: number;
}

/** Ein Text-Delta: ersetzt den Bereich [from, to) durch `insert`. */
export interface TextDelta {
  from: number;
  to: number;
  insert: string;
  delete: string;
}

/**
 * Transport-Abstraktion fuer den Versand eines Deltas an einen Peer.
 * Die konkrete WebRTC-Implementierung (RTCDataChannel) wird ausserhalb dieses
 * Moduls bereitgestellt; hier genuegt ein Mock bzw. der lokale No-op.
 */
export interface DeltaTransport {
  send(peerId: string, delta: TextDelta): void;
  close?(): void;
}

/** Protokoll-Eintrag eines Broadcasts (fuer Tests/Observability). */
export interface BroadcastRecord {
  delta: TextDelta;
  peerIds: string[];
  at: number;
}

/** Optionen fuer `createP2PSession`. Alle Felder sind optional (defensiv). */
export interface CreateSessionOptions {
  transport?: DeltaTransport;
  peers?: (Partial<Peer> | null)[];
  now?: number;
}

// ---------------------------------------------------------------------------
// Modul-Store (In-Memory, Single-User-Desktop-App)
// ---------------------------------------------------------------------------

const sessions = new Map<string, P2PSession>();
const transports = new Map<string, DeltaTransport>();
const outbox = new Map<string, BroadcastRecord[]>();
const inbox = new Map<string, TextDelta[]>();
const pending = new Map<string, TextDelta[]>();
const listeners = new Map<string, Set<(delta: TextDelta) => void>>();
const disconnectedAt = new Map<string, number>();

let idCounter = 0;
let nowFn: () => number = () => Date.now();

const PEER_COLORS = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
];

/** Lokaler Zero-Cloud-Transport: versendet nichts an das Netz. */
const localTransport: DeltaTransport = {
  send() {
    /* bewusst leer — Zero-Cloud, kein Netzwerkzugriff */
  },
};

function clock(): number {
  const t = nowFn();
  return Number.isFinite(t) ? t : 0;
}

function ensureState(id: string): void {
  if (!outbox.has(id)) outbox.set(id, []);
  if (!inbox.has(id)) inbox.set(id, []);
  if (!pending.has(id)) pending.set(id, []);
  if (!listeners.has(id)) listeners.set(id, new Set());
  if (!transports.has(id)) transports.set(id, localTransport);
}

function uniqueId(prefix: string, taken: Set<string>): string {
  let candidate = "";
  do {
    idCounter += 1;
    candidate = `${prefix}-${idCounter.toString(36)}`;
  } while (taken.has(candidate));
  return candidate;
}

/**
 * Loest eine Session defensiv gegen den Store auf. Fehlende Sessions werden
 * bei gueltiger ID registriert; ungueltige Eingaben liefern `null`.
 */
function resolve(session: P2PSession | null | undefined): P2PSession | null {
  if (!session || typeof session !== "object") return null;
  const id = typeof session.id === "string" ? session.id.trim() : "";
  if (!id) return null;
  let known = sessions.get(id);
  if (!known) {
    known = {
      id,
      peers: Array.isArray(session.peers) ? session.peers : [],
      status: session.status === "disconnected" ? "disconnected" : "connected",
      lastSync:
        typeof session.lastSync === "number" && Number.isFinite(session.lastSync)
          ? session.lastSync
          : clock(),
    };
    sessions.set(id, known);
  }
  ensureState(id);
  return known;
}

/**
 * Validiert und normalisiert ein Delta. Ungueltige Eingaben liefern `null`
 * (Aufrufer behandelt das als No-op). Negative Positionen werden auf 0
 * geklemmt, `to < from` wird auf `from` angehoben.
 */
function normalizeDelta(delta: TextDelta | null | undefined): TextDelta | null {
  if (!delta || typeof delta !== "object") return null;
  const rawFrom = Number(delta.from);
  const rawTo = Number(delta.to);
  if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) return null;
  const from = Math.max(0, Math.floor(rawFrom));
  const to = Math.max(from, Math.floor(rawTo));
  return {
    from,
    to,
    insert: typeof delta.insert === "string" ? delta.insert : "",
    delete: typeof delta.delete === "string" ? delta.delete : "",
  };
}

// ---------------------------------------------------------------------------
// Oeffentliche API
// ---------------------------------------------------------------------------

/**
 * Erstellt eine P2P-Session. Bei leerer/ungueltiger `sessionId` wird eine
 * deterministische Fallback-ID vergeben (defensiv, kein Throw). Eine bereits
 * existierende Session wird unveraendert zurueckgegeben (idempotent).
 */
export function createP2PSession(
  sessionId: string,
  options: CreateSessionOptions = {},
): P2PSession {
  const requested = typeof sessionId === "string" ? sessionId.trim() : "";
  if (requested) {
    const existing = sessions.get(requested);
    if (existing) return existing;
  }
  const id = requested || uniqueId("sess", new Set(sessions.keys()));
  const session: P2PSession = {
    id,
    peers: [],
    status: "connected",
    lastSync: typeof options.now === "number" && Number.isFinite(options.now) ? options.now : clock(),
  };
  sessions.set(id, session);
  transports.set(id, options.transport ?? localTransport);
  outbox.set(id, []);
  inbox.set(id, []);
  pending.set(id, []);
  listeners.set(id, new Set());
  disconnectedAt.delete(id);
  if (Array.isArray(options.peers)) {
    for (const peer of options.peers) addPeer(session, peer);
  }
  return session;
}

/**
 * Fuegt der Session einen Peer hinzu. Fehlende Felder werden mit sicheren
 * Defaults gefuellt (Name, Farbe aus der Palette, Cursor 0). Doppelte IDs
 * werden durch eine eindeutige ID ersetzt. Liefert eine Kopie des Peers oder
 * `null` bei ungueltiger Session.
 */
export function addPeer(
  session: P2PSession,
  peer?: Partial<Peer> | null,
): Peer | null {
  const s = resolve(session);
  if (!s) return null;
  const source = peer && typeof peer === "object" ? peer : {};
  const taken = new Set((s.peers ?? []).map((p) => (p && typeof p.id === "string" ? p.id : "")));
  const requestedId = typeof source.id === "string" ? source.id.trim() : "";
  const id = requestedId && !taken.has(requestedId) ? requestedId : uniqueId("peer", taken);
  const index = s.peers.length;
  const cursor =
    typeof source.cursorPosition === "number" &&
    Number.isFinite(source.cursorPosition) &&
    source.cursorPosition >= 0
      ? Math.floor(source.cursorPosition)
      : 0;
  const created: Peer = {
    id,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : `Peer ${index + 1}`,
    color:
      typeof source.color === "string" && source.color.trim()
        ? source.color.trim()
        : PEER_COLORS[index % PEER_COLORS.length],
    cursorPosition: cursor,
  };
  s.peers.push(created);
  return { ...created };
}

/** Entfernt einen Peer per ID. Liefert `true`, wenn ein Peer entfernt wurde. */
export function removePeer(session: P2PSession, peerId: string): boolean {
  const s = resolve(session);
  if (!s || typeof peerId !== "string") return false;
  const before = s.peers.length;
  s.peers = s.peers.filter((p) => !p || p.id !== peerId);
  return s.peers.length < before;
}

/** Liefert eine Kopie der Peer-Liste (leeres Array bei ungueltiger Session). */
export function getPeers(session: P2PSession): Peer[] {
  const s = resolve(session);
  if (!s) return [];
  return (s.peers ?? []).filter((p) => p && typeof p === "object").map((p) => ({ ...p }));
}

/** `true`, wenn die Session verbunden ist. */
export function isConnected(session: P2PSession): boolean {
  const s = resolve(session);
  return !!s && s.status === "connected";
}

/**
 * Sendet ein Text-Delta an alle Peers. Bei getrennter Session wird das Delta
 * in eine Offline-Warteschlange gelegt (Flush beim Reconnect). Ungueltige
 * Deltas und fehlende Sessions sind ein No-op.
 */
export function broadcastDelta(session: P2PSession, delta: TextDelta): void {
  const s = resolve(session);
  if (!s) return;
  const normalized = normalizeDelta(delta);
  if (!normalized) return;

  if (s.status !== "connected") {
    pending.get(s.id)?.push(normalized);
    return;
  }

  const peers = Array.isArray(s.peers) ? s.peers.filter((p) => p && typeof p.id === "string") : [];
  const transport = transports.get(s.id) ?? localTransport;
  for (const peer of peers) {
    try {
      transport.send(peer.id, normalized);
    } catch {
      /* Ein defekter Peer-Transport darf den Broadcast nicht abbrechen. */
    }
  }
  outbox.get(s.id)?.push({
    delta: normalized,
    peerIds: peers.map((p) => p.id),
    at: clock(),
  });
  s.lastSync = clock();
}

/**
 * Wendet einen empfangenen (entfernten) Delta an. Das Delta wird protokolliert,
 * `lastSync` aktualisiert und registrierte Listener benachrichtigt. Ungueltige
 * Deltas und fehlende Sessions sind ein No-op.
 */
export function applyRemoteDelta(session: P2PSession, delta: TextDelta): void {
  const s = resolve(session);
  if (!s) return;
  const normalized = normalizeDelta(delta);
  if (!normalized) return;
  inbox.get(s.id)?.push(normalized);
  s.lastSync = clock();
  const set = listeners.get(s.id);
  if (set) {
    for (const cb of set) {
      try {
        cb(normalized);
      } catch {
        /* Ein defekter Listener darf andere nicht blockieren. */
      }
    }
  }
}

/**
 * Faellt bei Verbindungsabbruch in den Offline-Modus zurueck. Die Session wird
 * auf `disconnected` gesetzt; die Peer-Liste bleibt fuer einen spaeteren
 * Reconnect erhalten. Idempotent und No-op bei ungueltiger Session.
 */
export function handleDisconnect(session: P2PSession): void {
  const s = resolve(session);
  if (!s) return;
  if (s.status === "disconnected") return;
  s.status = "disconnected";
  disconnectedAt.set(s.id, clock());
}

/**
 * Stellt die Verbindung wieder her und versendet alle offline gepufferten
 * Deltas. No-op bei ungueltiger Session.
 */
export function reconnectSession(session: P2PSession): void {
  const s = resolve(session);
  if (!s) return;
  s.status = "connected";
  disconnectedAt.delete(s.id);
  const queued = pending.get(s.id) ?? [];
  pending.set(s.id, []);
  for (const delta of queued) broadcastDelta(s, delta);
}

/** Zeitpunkt des letzten Disconnects (ms) oder `null`. */
export function getDisconnectedAt(session: P2PSession): number | null {
  const s = resolve(session);
  if (!s) return null;
  return disconnectedAt.has(s.id) ? (disconnectedAt.get(s.id) as number) : null;
}

/** Registriert einen Transport fuer die Session (z. B. WebRTC-Mock im Test). */
export function setTransport(session: P2PSession, transport: DeltaTransport | null): void {
  const s = resolve(session);
  if (!s) return;
  transports.set(s.id, transport ?? localTransport);
}

/** Abonniert angewandte Remote-Deltas. Liefert eine Unsubscribe-Funktion. */
export function subscribe(
  session: P2PSession,
  listener: (delta: TextDelta) => void,
): () => void {
  const s = resolve(session);
  if (!s || typeof listener !== "function") return () => undefined;
  ensureState(s.id);
  const set = listeners.get(s.id) as Set<(delta: TextDelta) => void>;
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Protokoll der lokal gebroadcasteten Deltas (Kopien). */
export function getBroadcasts(session: P2PSession): BroadcastRecord[] {
  const s = resolve(session);
  if (!s) return [];
  return (outbox.get(s.id) ?? []).map((r) => ({ delta: { ...r.delta }, peerIds: [...r.peerIds], at: r.at }));
}

/** Protokoll der angewandten Remote-Deltas (Kopien). */
export function getAppliedDeltas(session: P2PSession): TextDelta[] {
  const s = resolve(session);
  if (!s) return [];
  return (inbox.get(s.id) ?? []).map((d) => ({ ...d }));
}

/** Offline gepufferte Deltas (Kopien). */
export function getPendingDeltas(session: P2PSession): TextDelta[] {
  const s = resolve(session);
  if (!s) return [];
  return (pending.get(s.id) ?? []).map((d) => ({ ...d }));
}

/** `true`, wenn die Laufzeitumgebung WebRTC (RTCPeerConnection) bereitstellt. */
export function isWebRTCSupported(): boolean {
  const g = globalThis as unknown as { RTCPeerConnection?: unknown };
  return typeof g.RTCPeerConnection === "function";
}

/** Test-Helfer: setzt den kompletten In-Memory-Store zurueck. */
export function __resetP2PStore(): void {
  sessions.clear();
  transports.clear();
  outbox.clear();
  inbox.clear();
  pending.clear();
  listeners.clear();
  disconnectedAt.clear();
  idCounter = 0;
  nowFn = () => Date.now();
}

/** Test-Helfer: ueberschreibt die Uhr (deterministische Zeitstempel). */
export function __setClock(fn?: (() => number) | null): void {
  nowFn = typeof fn === "function" ? fn : () => Date.now();
}
