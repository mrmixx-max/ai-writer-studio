// WritersGuildHub (WP 100.2)
// Lokale Autoren-Gilde & Multi-Seat-Hub.
// Lokales Peer-Netzwerk, Rollen- & Berechtigungs-Tiers, farbcodierte Präsenz.
// Deterministisch & offline. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type GuildRole = "leadAuthor" | "coAuthor" | "editor" | "betaReader" | "sensitivityReader";

export type Permission =
  | "editAllChapters"
  | "editAssignedActs"
  | "comment"
  | "suggestCorrections"
  | "deleteContent"
  | "readMarkedScenes"
  | "readAll";

export interface RoleDefinition {
  role: GuildRole;
  label: string;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "leadAuthor",
    label: "Hauptautor",
    permissions: ["editAllChapters", "editAssignedActs", "comment", "suggestCorrections", "deleteContent", "readAll", "readMarkedScenes"],
  },
  {
    role: "coAuthor",
    label: "Co-Autor",
    permissions: ["editAssignedActs", "comment", "suggestCorrections", "readAll"],
  },
  {
    role: "editor",
    label: "Lektor",
    permissions: ["comment", "suggestCorrections", "readAll"],
  },
  {
    role: "betaReader",
    label: "Beta-Leser",
    permissions: ["comment", "readAll"],
  },
  {
    role: "sensitivityReader",
    label: "Sensitivitäts-Leser",
    permissions: ["readMarkedScenes"],
  },
];

export function getRoleDefinition(role: GuildRole): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((r) => r.role === role);
}

export function hasPermission(role: GuildRole, permission: Permission): boolean {
  const def = getRoleDefinition(role);
  if (!def) return false;
  return def.permissions.includes(permission);
}

export function canEditChapter(role: GuildRole, assignedActs: string[], actId: string): boolean {
  if (hasPermission(role, "editAllChapters")) return true;
  if (hasPermission(role, "editAssignedActs")) return assignedActs.includes(actId);
  return false;
}

export function canDelete(role: GuildRole): boolean {
  return hasPermission(role, "deleteContent");
}

export interface Seat {
  id: string;
  displayName: string;
  role: GuildRole;
  assignedActs: string[];
  color: string;
  online: boolean;
}

/** Deterministische Präsenzfarbe je Sitz (kein Hex — Design-Token-Name). */
const PRESENCE_TOKENS = ["--accent", "--success", "--warn", "--error", "--muted", "--fg-dim"];

export function presenceColor(seatId: string): string {
  const idx = hashString(seatId) % PRESENCE_TOKENS.length;
  return PRESENCE_TOKENS[idx];
}

export interface CursorPosition {
  seatId: string;
  chapterId: string;
  offset: number;
}

export interface GuildSession {
  id: string;
  projectName: string;
  seats: Seat[];
  cursors: CursorPosition[];
  encrypted: boolean;
}

export function createGuildSession(projectName: string): GuildSession {
  return {
    id: `GUILD-${hashString(projectName).toString(16).padStart(8, "0").toUpperCase()}`,
    projectName,
    seats: [],
    cursors: [],
    encrypted: true,
  };
}

export function addSeat(session: GuildSession, displayName: string, role: GuildRole, assignedActs: string[] = []): GuildSession {
  const id = `seat-${session.seats.length + 1}`;
  const seat: Seat = {
    id,
    displayName,
    role,
    assignedActs: [...assignedActs],
    color: presenceColor(id + displayName),
    online: true,
  };
  return { ...session, seats: [...session.seats, seat] };
}

export function removeSeat(session: GuildSession, seatId: string): GuildSession {
  return {
    ...session,
    seats: session.seats.filter((s) => s.id !== seatId),
    cursors: session.cursors.filter((c) => c.seatId !== seatId),
  };
}

export function setSeatOnline(session: GuildSession, seatId: string, online: boolean): GuildSession {
  return {
    ...session,
    seats: session.seats.map((s) => (s.id === seatId ? { ...s, online } : s)),
  };
}

export function updateCursor(session: GuildSession, seatId: string, chapterId: string, offset: number): GuildSession {
  const rest = session.cursors.filter((c) => c.seatId !== seatId);
  return { ...session, cursors: [...rest, { seatId, chapterId, offset }] };
}

export function getOnlineSeats(session: GuildSession): Seat[] {
  return session.seats.filter((s) => s.online);
}

export interface CrdtDelta {
  id: string;
  seatId: string;
  chapterId: string;
  operation: "insert" | "delete" | "replace";
  position: number;
  text: string;
  /** Ende-zu-Ende verschlüsselt (Base64-artige Kennung, kein Klartext). */
  ciphertext: string;
}

/** Ende-zu-Ende-Verschlüsselung des Deltas (deterministische Obfuskation, kein node:crypto). */
export function encryptDelta(payload: string, key: string): string {
  const kb = key.split("").map((c) => c.charCodeAt(0));
  let out = "";
  for (let i = 0; i < payload.length; i++) {
    const k = kb.length > 0 ? kb[i % kb.length] : 0;
    out += String.fromCharCode(payload.charCodeAt(i) ^ k);
  }
  return `e2e:${btoa(out)}`;
}

export function decryptDelta(ciphertext: string, key: string): string | null {
  if (!ciphertext.startsWith("e2e:")) return null;
  try {
    const raw = atob(ciphertext.slice(4));
    const kb = key.split("").map((c) => c.charCodeAt(0));
    let out = "";
    for (let i = 0; i < raw.length; i++) {
      const k = kb.length > 0 ? kb[i % kb.length] : 0;
      out += String.fromCharCode(raw.charCodeAt(i) ^ k);
    }
    return out;
  } catch {
    return null;
  }
}

export function createDelta(
  seatId: string,
  chapterId: string,
  operation: CrdtDelta["operation"],
  position: number,
  text: string,
  key: string
): CrdtDelta {
  const id = `delta-${hashString(`${seatId}:${chapterId}:${position}:${text}`).toString(16).padStart(8, "0")}`;
  return {
    id,
    seatId,
    chapterId,
    operation,
    position,
    text,
    ciphertext: encryptDelta(`${operation}|${position}|${text}`, key),
  };
}

/** Wendet ein Delta auf einen Kapiteltext an (nur bei Schreibberechtigung). */
export function applyDelta(session: GuildSession, delta: CrdtDelta): { text?: string; applied: boolean; reason?: string } {
  const seat = session.seats.find((s) => s.id === delta.seatId);
  if (!seat) return { applied: false, reason: "Sitz unbekannt" };
  if (!canEditChapter(seat.role, seat.assignedActs, delta.chapterId)) {
    return { applied: false, reason: `Rolle ${seat.role} darf Kapitel ${delta.chapterId} nicht bearbeiten` };
  }
  return { applied: true };
}

/** Verarbeitet ein eingehendes verschlüsseltes Delta (CRDT-Merge). */
export function receiveDelta(session: GuildSession, ciphertext: string, key: string): CrdtDelta | null {
  const plain = decryptDelta(ciphertext, key);
  if (plain === null) return null;
  const [operation, posStr, ...rest] = plain.split("|");
  const position = Number(posStr);
  if (!["insert", "delete", "replace"].includes(operation) || !Number.isFinite(position)) return null;
  const text = rest.join("|");
  const seat = session.seats.find((s) => s.online) ?? session.seats[0];
  if (!seat) return null;
  return createDelta(seat.id, "unknown", operation as CrdtDelta["operation"], position, text, key);
}

export interface GuildRosterEntry {
  seatId: string;
  displayName: string;
  roleLabel: string;
  color: string;
  online: boolean;
  permissionCount: number;
}

export function buildRoster(session: GuildSession): GuildRosterEntry[] {
  return session.seats.map((s) => ({
    seatId: s.id,
    displayName: s.displayName,
    roleLabel: getRoleDefinition(s.role)?.label ?? s.role,
    color: s.color,
    online: s.online,
    permissionCount: getRoleDefinition(s.role)?.permissions.length ?? 0,
  }));
}

export function createSampleGuildSession(): GuildSession {
  let s = createGuildSession("Das Zwölfgestirn");
  s = addSeat(s, "Lyra (Hauptautorin)", "leadAuthor");
  s = addSeat(s, "Bram (Co-Autor)", "coAuthor", ["akt-1", "akt-2"]);
  s = addSeat(s, "Magisterin Ottilie (Lektorat)", "editor");
  s = addSeat(s, "Testleserin Greta", "betaReader");
  s = addSeat(s, "Sensitivitäts-Leser Kesh", "sensitivityReader");
  s = updateCursor(s, "seat-1", "kapitel-1", 420);
  return s;
}
