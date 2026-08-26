// Domänen-Typen für Projekte / Kapitel + Avantgarde-Features.
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

// --- Avantgarde ---

export interface Fragment {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  tone: string | null;
  speaker: string | null;
  timeRef: string | null;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface Voice {
  id: string;
  name: string;
  description: string | null;
  promptTemplate: string;
  isFavorite: boolean;
  createdAt: number;
}

export interface SemanticNode {
  id: string;
  projectId: string;
  label: string;
  nodeType: string;
  description: string | null;
  x: number | null;
  y: number | null;
  createdAt: number;
}

export interface SemanticEdge {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  label: string | null;
  createdAt: number;
}

export interface ObstructionPreset {
  id: string;
  name: string;
  rules: string; // JSON-Array von Regeln
  createdAt: number;
}

export interface ChapterDialogue {
  id: string;
  chapterId: string;
  role: string;
  message: string;
  response: string;
  createdAt: number;
}

export interface LiteraryVersion {
  id: string;
  chapterId: string;
  label: string;
  content: string;
  versionType: string;
  metrics: string | null; // JSON mit Ton/Verdichtung/Abstraktion/Bildhaftigkeit
  createdAt: number;
}

export interface WhisperTranscription {
  id: string;
  chapterId: string | null;
  audioHash: string | null;
  text: string;
  language: string | null;
  model: string | null;
  createdAt: number;
}
