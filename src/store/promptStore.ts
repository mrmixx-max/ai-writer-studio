// UI-State für Prompt-Generator.
import { create } from "zustand";
import type { Genre, PromptType, Tone, TargetLength, GeneratedPrompt } from "@/services/prompt/types";

interface PromptUIState {
  tab: "generate" | "favorites";
  genres: Genre[];
  promptType: PromptType;
  tone: Tone;
  targetLength: TargetLength;
  count: number;
  results: GeneratedPrompt[];
  streamingText: string;
  isGenerating: boolean;
  offline: boolean;
  set: <K extends keyof PromptUIState>(k: K, v: PromptUIState[K]) => void;
}

export const usePromptStore = create<PromptUIState>((set) => ({
  tab: "generate",
  genres: ["Fantasy"],
  promptType: "Story-Starter",
  tone: "neutral",
  targetLength: "Kurzgeschichte",
  count: 3,
  results: [],
  streamingText: "",
  isGenerating: false,
  offline: false,
  set: (k, v) => set({ [k]: v } as Partial<PromptUIState>),
}));
