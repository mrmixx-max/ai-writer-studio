// Book Idea Engine Typen (Sprint 29).
export interface BookIdea {
  id: string;
  title: string;
  genre: string;
  targetAudience: string;
  logline: string;
  synopsis: string;
  protagonist: string;
  antagonist: string;
  setting: string;
  conflict: string;
  themes: string[];
  chapters: string[];
}

export interface IdeaEvaluation {
  originality: number;
  marketPotential: number;
  readerAppeal: number;
  writingComplexity: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
}

export interface GenerateIdeasOptions {
  genre?: string;
  theme?: string;
  targetAudience?: string;
  count?: number;
  useLLM?: boolean;
  llmModel?: string;
}

export type GenerationMode = "demo" | "llm" | "hybrid";
