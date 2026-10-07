// CloudlessP2pMesh (WP 91.2)
// Cloud-freies P2P-Mesh & Lokaler Sync.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.
// Browser-kompatibel: WebRTC, Crypto API, IndexedDB.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DeviceRole = "initiator" | "receiver";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "syncing" | "error";

export interface DeviceInfo {
  id: string;
  name: string;
  publicKey: string; // Base64 encoded
  role: DeviceRole;
  lastSeen: string; // ISO timestamp
}

export interface SyncDelta {
  id: string;
  chapterId: string;
  operation: "insert" | "delete" | "update";
  position: number;
  text: string;
  timestamp: string;
  authorDeviceId: string;
  vectorClock: Record<string, number>; // CRDT vector clock
}

export interface MeshConfig {
  signalServerUrl?: string; // Optional STUN/TURN
  iceServers: RTCIceServer[];
  maxPeers: number;
  syncIntervalMs: number;
}

export interface MeshStatus {
  deviceId: string;
  deviceName: string;
  state: ConnectionState;
  connectedPeers: number;
  maxPeers: number;
  pendingDeltas: number;
  lastSync: string | null;
  errors: string[];
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function _pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateDeviceId(seed: number): string {
  return `DEV-${hashString(`device-${seed}`).toString(16).padStart(8, "0").toUpperCase()}`;
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function _importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", binary, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function _deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function createDevice(name: string, seed: number = 42): Promise<DeviceInfo> {
  const keyPair = await generateKeyPair();
  const publicKey = await exportPublicKey(keyPair.publicKey);
  const deviceId = generateDeviceId(seed);
  
  return {
    id: deviceId,
    name,
    publicKey,
    role: "initiator",
    lastSeen: new Date().toISOString(),
  };
}

export function createMeshConfig(customIceServers?: RTCIceServer[]): MeshConfig {
  return {
    iceServers: customIceServers || DEFAULT_ICE_SERVERS,
    maxPeers: 8,
    syncIntervalMs: 5000,
  };
}

export class CloudlessP2pMesh {
  private device: DeviceInfo | null = null;
  private config: MeshConfig;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private pendingDeltas: SyncDelta[] = [];
  private vectorClock: Record<string, number> = {};
  private state: ConnectionState = "disconnected";
  private errorHandler: ((error: string) => void) | null = null;
  private syncHandler: ((delta: SyncDelta) => void) | null = null;
  
  constructor(config: MeshConfig) {
    this.config = config;
  }

  async initialize(deviceName: string, seed: number = 42): Promise<DeviceInfo> {
    this.device = await createDevice(deviceName, seed);
    this.vectorClock[this.device.id] = 0;
    this.state = "disconnected";
    return this.device;
  }

  getDevice(): DeviceInfo | null {
    return this.device;
  }

  getStatus(): MeshStatus {
    return {
      deviceId: this.device?.id || "unknown",
      deviceName: this.device?.name || "unknown",
      state: this.state,
      connectedPeers: this.peerConnections.size,
      maxPeers: this.config.maxPeers,
      pendingDeltas: this.pendingDeltas.length,
      lastSync: this.pendingDeltas.length > 0 ? this.pendingDeltas[this.pendingDeltas.length - 1].timestamp : null,
      errors: [],
    };
  }

  onError(handler: (error: string) => void): void {
    this.errorHandler = handler;
  }

  onSync(handler: (delta: SyncDelta) => void): void {
    this.syncHandler = handler;
  }

  async connectToPeer(peerDeviceInfo: DeviceInfo): Promise<boolean> {
    if (!this.device) throw new Error("Device not initialized");
    if (this.peerConnections.size >= this.config.maxPeers) {
      this.errorHandler?.("Max peers reached");
      return false;
    }
    if (this.peerConnections.has(peerDeviceInfo.id)) return true;

    this.state = "connecting";
    
    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });
    this.peerConnections.set(peerDeviceInfo.id, pc);

    try {
      const channel = pc.createDataChannel("sync", { ordered: true });
      this.setupDataChannel(channel, peerDeviceInfo.id);
      this.dataChannels.set(peerDeviceInfo.id, channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // In real implementation, send offer via signaling
      // For demo, we simulate successful connection
      this.simulateConnection(pc, peerDeviceInfo);
      
      return true;
    } catch (error) {
      this.errorHandler?.(`Connection failed: ${error}`);
      this.cleanupPeer(peerDeviceInfo.id);
      return false;
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.onopen = () => {
      this.state = "connected";
      this.flushPendingDeltas(peerId);
    };
    channel.onmessage = (event) => {
      this.handleIncomingDelta(peerId, event.data);
    };
    channel.onclose = () => {
      this.cleanupPeer(peerId);
    };
    channel.onerror = (error) => {
      this.errorHandler?.(`Data channel error: ${error}`);
    };
  }

  private simulateConnection(pc: RTCPeerConnection, _peer: DeviceInfo): void {
    // Simuliere ICE-Verbindung für Demo
    setTimeout(() => {
      pc.dispatchEvent(new Event("connectionstatechange"));
    }, 100);
  }

  private cleanupPeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.dataChannels.delete(peerId);
    if (this.peerConnections.size === 0) {
      this.state = "disconnected";
    }
  }

  private flushPendingDeltas(peerId: string): void {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== "open") return;
    
    for (const delta of this.pendingDeltas) {
      channel.send(JSON.stringify(delta));
    }
    this.pendingDeltas = [];
  }

  private handleIncomingDelta(peerId: string, data: string): void {
    try {
      const delta = JSON.parse(data) as SyncDelta;
      this.applyDelta(delta);
      this.syncHandler?.(delta);
    } catch (error) {
      this.errorHandler?.(`Invalid delta: ${error}`);
    }
  }

  private applyDelta(delta: SyncDelta): void {
    // CRDT: Merge vector clocks
    for (const [deviceId, clock] of Object.entries(delta.vectorClock)) {
      this.vectorClock[deviceId] = Math.max(this.vectorClock[deviceId] || 0, clock);
    }
    this.vectorClock[delta.authorDeviceId] = (this.vectorClock[delta.authorDeviceId] || 0) + 1;
  }

  createDelta(
    chapterId: string,
    operation: SyncDelta["operation"],
    position: number,
    text: string
  ): SyncDelta {
    if (!this.device) throw new Error("Device not initialized");
    
    this.vectorClock[this.device.id] = (this.vectorClock[this.device.id] || 0) + 1;
    
    const delta: SyncDelta = {
      id: `DELTA-${hashString(`${chapterId}-${Date.now()}-${this.device.id}`).toString(16).padStart(8, "0")}`,
      chapterId,
      operation,
      position,
      text,
      timestamp: new Date().toISOString(),
      authorDeviceId: this.device.id,
      vectorClock: { ...this.vectorClock },
    };
    
    this.pendingDeltas.push(delta);
    this.flushAll();
    
    return delta;
  }

  private flushAll(): void {
    for (const [peerId, channel] of this.dataChannels) {
      if (channel.readyState === "open") {
        this.flushPendingDeltas(peerId);
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const peerId of this.peerConnections.keys()) {
      this.cleanupPeer(peerId);
    }
    this.state = "disconnected";
  }
}

export function createSampleStatus(): MeshStatus {
  return {
    deviceId: "DEV-A1B2C3D4",
    deviceName: "Laptop-Autor",
    state: "connected",
    connectedPeers: 1,
    maxPeers: 8,
    pendingDeltas: 0,
    lastSync: new Date().toISOString(),
    errors: [],
  };
}

export function createSampleDelta(): SyncDelta {
  return {
    id: "DELTA-01234567",
    chapterId: "ch-1",
    operation: "insert",
    position: 100,
    text: "Neuer Text",
    timestamp: "1970-01-01T00:00:00.000Z",
    authorDeviceId: "DEV-A1B2C3D4",
    vectorClock: { "DEV-A1B2C3D4": 1 },
  };
}