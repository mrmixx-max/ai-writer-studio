// AudioDramaMasterDirector (WP 101.1)
// Full-Cast Hörspiel-Master-Regiepult.
// 4-Spur-Master-Zeitleiste, WebAudio-Vorhör-Modell, EDL/Cuesheet-Export.
// Deterministisch & offline. Keine Node-Module.

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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type MasterTrackType = "voice" | "foley" | "ambient" | "music";

export interface MasterTrack {
  id: string;
  name: string;
  type: MasterTrackType;
  gainDb: number;
  cues: MasterCue[];
}

export interface MasterCue {
  id: string;
  startMs: number;
  durationMs: number;
  label: string;
  /** Rollenzuweisung (nur Stimm-Spur). */
  castRole?: string;
  /** Stimmprofil (nur Stimm-Spur). */
  voiceProfile?: string;
  pan: number; // -1..1
}

export interface CastMember {
  id: string;
  characterName: string;
  voiceProfile: string;
  role: string;
}

export interface AudioDramaScene {
  id: string;
  title: string;
  cast: CastMember[];
  tracks: MasterTrack[];
}

/** Standard-Gain je Spur (dB). */
export const TRACK_GAINS: Record<MasterTrackType, number> = {
  voice: 0,
  foley: -6,
  ambient: -14,
  music: -10,
};

export function createCastMember(characterName: string, role: string, seed: number = 42): CastMember {
  const rng = createSeededRandom(hashString("cast:" + characterName + ":" + seed));
  const profile = pick(
    ["warm-bariton", "scharf-sopran", "rau-bass", "hell-alt", "samten-mezzo", "bruechig-tenor"],
    rng
  );
  return {
    id: `cast-${hashString(characterName).toString(16).padStart(6, "0")}`,
    characterName,
    role,
    voiceProfile: profile,
  };
}

export function createMasterTrack(type: MasterTrackType): MasterTrack {
  return {
    id: `track-${type}`,
    name: {
      voice: "Stimm-Spur",
      foley: "Foley-Geräusch-Spur",
      ambient: "Ambient-Schleife",
      music: "Musik-Leitmotiv-Spur",
    }[type],
    type,
    gainDb: TRACK_GAINS[type],
    cues: [],
  };
}

export function addCue(track: MasterTrack, cue: MasterCue): MasterTrack {
  const cues = [...track.cues, cue].sort((a, b) => a.startMs - b.startMs);
  return { ...track, cues };
}

export interface TimelineReport {
  totalDurationMs: number;
  trackCount: number;
  cueCount: number;
  overlaps: number;
}

export function analyzeTimeline(scene: AudioDramaScene): TimelineReport {
  let totalDurationMs = 0;
  let cueCount = 0;
  let overlaps = 0;
  for (const track of scene.tracks) {
    let lastEnd = 0;
    for (const cue of track.cues) {
      cueCount++;
      totalDurationMs = Math.max(totalDurationMs, cue.startMs + cue.durationMs);
      if (cue.startMs < lastEnd) overlaps++;
      lastEnd = Math.max(lastEnd, cue.startMs + cue.durationMs);
    }
  }
  return { totalDurationMs, trackCount: scene.tracks.length, cueCount, overlaps };
}

export interface CueSheetRow {
  cueNumber: number;
  startTimecode: string;
  durationTimecode: string;
  track: string;
  label: string;
  castRole: string;
}

/** Formatiert Millisekunden als Timecode HH:MM:SS:FF (25 fps). */
export function formatTimecode(ms: number, fps: number = 25): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const frames = Math.floor(((safe % 1000) / 1000) * fps);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(frames)}`;
}

export function buildCueSheet(scene: AudioDramaScene): CueSheetRow[] {
  const rows: CueSheetRow[] = [];
  let cueNumber = 1;
  for (const track of scene.tracks) {
    for (const cue of track.cues) {
      rows.push({
        cueNumber: cueNumber++,
        startTimecode: formatTimecode(cue.startMs),
        durationTimecode: formatTimecode(cue.durationMs),
        track: track.name,
        label: cue.label,
        castRole: cue.castRole ?? "",
      });
    }
  }
  return rows;
}

export function exportCueSheetCsv(scene: AudioDramaScene): string {
  const header = "Cue,Start,Dauer,Spur,Label,Rolle";
  const rows = buildCueSheet(scene).map(
    (r) => `${r.cueNumber},${r.startTimecode},${r.durationTimecode},${r.track},${r.label},${r.castRole}`
  );
  return [header, ...rows].join("\n");
}

/** Exportiert eine EDL (Edit Decision List) im CMX-3600-Stil für DAWs. */
export function exportEdl(scene: AudioDramaScene, title: string): string {
  const lines: string[] = [`TITLE: ${title}`, "FCM: NON-DROP FRAME", ""];
  let eventNum = 1;
  for (const track of scene.tracks) {
    for (const cue of track.cues) {
      const reel = track.type.toUpperCase().padEnd(8, " ").slice(0, 8);
      const startTc = formatTimecode(cue.startMs).replace(/:(\d+)$/, (_, f) => ":" + String(f).padStart(2, "0"));
      const endTc = formatTimecode(cue.startMs + cue.durationMs);
      lines.push(
        `${String(eventNum).padStart(3, "0")}  ${reel} V     C        ${startTc} ${endTc} ${startTc} ${endTc}`
      );
      lines.push(`* FROM CLIP NAME: ${cue.label}`);
      if (cue.castRole) lines.push(`* CAST: ${cue.castRole}`);
      eventNum++;
    }
  }
  return lines.join("\n");
}

export interface PreviewMixdown {
  durationMs: number;
  sampleCount: number;
  peakDb: number;
  duckingApplied: boolean;
}

/**
 * Modelliert einen Stereo-Mixdown (Vorhören). Ducking senkt Musik/Ambient um 12 dB,
 * sobald im selben Zeitfenster Sprache aktiv ist; Spitzenwert wird auf -0.5 dB begrenzt.
 */
export function calculatePreviewMixdown(scene: AudioDramaScene, resolutionMs: number = 50): PreviewMixdown {
  const report = analyzeTimeline(scene);
  const durationMs = report.totalDurationMs;
  const sampleCount = Math.max(1, Math.ceil(durationMs / resolutionMs));

  const voice = scene.tracks.find((t) => t.type === "voice");
  const duckTracks = scene.tracks.filter((t) => t.type === "music" || t.type === "ambient");

  let peak = 0;
  let duckingApplied = false;
  const voiceGain = voice ? Math.pow(10, voice.gainDb / 20) : 0;

  for (let i = 0; i < sampleCount; i++) {
    const t = i * resolutionMs;
    const voiceActive = voice ? voice.cues.some((c) => t >= c.startMs && t < c.startMs + c.durationMs) : false;
    let sample = 0;
    if (voiceActive) sample += voiceGain * 0.8;
    for (const dt of duckTracks) {
      const active = dt.cues.some((c) => t >= c.startMs && t < c.startMs + c.durationMs);
      if (active) {
        const duck = voiceActive ? 0.25 : 1; // -12 dB
        if (voiceActive) duckingApplied = true;
        sample += Math.pow(10, dt.gainDb / 20) * 0.6 * duck;
      }
    }
    peak = Math.max(peak, sample);
  }

  // Limiter: -0.5 dB ≈ 0.944 linear
  const limiter = 0.944;
  const limited = Math.min(peak, limiter);
  const peakDb = limited > 0 ? Math.round(20 * Math.log10(limited) * 10) / 10 : -Infinity;

  return {
    durationMs,
    sampleCount,
    peakDb: Number.isFinite(peakDb) ? peakDb : -60,
    duckingApplied,
  };
}

export interface AudioDramaPlan {
  id: string;
  scene: AudioDramaScene;
  cueSheetCsv: string;
  edl: string;
  preview: PreviewMixdown;
  report: TimelineReport;
}

export function createAudioDramaScene(title: string, seed: number = 42): AudioDramaScene {
  const cast: CastMember[] = [
    createCastMember("Lyra", "Protagonistin", seed),
    createCastMember("Bram", "Gefährte", seed + 1),
    createCastMember("Der Erzähler", "Narration", seed + 2),
  ];

  const voice = createMasterTrack("voice");
  const foley = createMasterTrack("foley");
  const ambient = createMasterTrack("ambient");
  const music = createMasterTrack("music");

  let v = voice;
  v = addCue(v, { id: "v1", startMs: 0, durationMs: 4000, label: "Eröffnung", castRole: cast[2].characterName, voiceProfile: cast[2].voiceProfile, pan: 0 });
  v = addCue(v, { id: "v2", startMs: 4500, durationMs: 3500, label: "Lyras Replik", castRole: cast[0].characterName, voiceProfile: cast[0].voiceProfile, pan: -0.3 });
  v = addCue(v, { id: "v3", startMs: 8500, durationMs: 3000, label: "Brams Antwort", castRole: cast[1].characterName, voiceProfile: cast[1].voiceProfile, pan: 0.3 });

  let f = foley;
  f = addCue(f, { id: "f1", startMs: 500, durationMs: 800, label: "Schrittgeräusch auf Kies", pan: 0 });
  f = addCue(f, { id: "f2", startMs: 7000, durationMs: 600, label: "Klingenklirren", pan: 0.4 });
  f = addCue(f, { id: "f3", startMs: 10000, durationMs: 1200, label: "Tür schlägt zu", pan: 0 });

  let a = ambient;
  a = addCue(a, { id: "a1", startMs: 0, durationMs: 13000, label: "Schenkengemurmel", pan: 0 });

  let m = music;
  m = addCue(m, { id: "m1", startMs: 0, durationMs: 5000, label: "Leitmotiv: Aufbruch", pan: 0 });
  m = addCue(m, { id: "m2", startMs: 9000, durationMs: 4500, label: "Akzent: Gefahr", pan: 0 });

  const scene: AudioDramaScene = {
    id: `SCENE-${hashString(title + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    title,
    cast,
    tracks: [v, f, a, m],
  };
  return scene;
}

export function createAudioDramaPlan(title: string, seed: number = 42): AudioDramaPlan {
  const scene = createAudioDramaScene(title, seed);
  return {
    id: `PLAN-${hashString(title + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    scene,
    cueSheetCsv: exportCueSheetCsv(scene),
    edl: exportEdl(scene, title),
    preview: calculatePreviewMixdown(scene),
    report: analyzeTimeline(scene),
  };
}

export function createSampleAudioDramaPlan(): AudioDramaPlan {
  return createAudioDramaPlan("Die Schenke am Nebelpass", 42);
}
