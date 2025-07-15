// Shared type definitions for the chat feature.
// Keeping these in one place reduces circular-import risk and keeps page components lean.

export interface Material {
  material: string;
  supply_score: number;
  ownership_score: number;
  material_card_color?: string;
}

export interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
}

// ----- Projects ----------------------------------------------------
export interface Project {
  id: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  related_materials?: Material[];
  suggested_questions?: string[];
  sources?: Source[]; // optional – filled once assistant responds
}

export interface ChatSession {
  id: string;
  projectId?: string;
  threads: ChatThread[];
  /** legacy support – present only for sessions created before threads table */
  messages?: Message[];
  isLoading: boolean;
}

export interface ChatThread {
  id: string;
  userMessage: Message | null;
  assistantMessage: Message | null;
  sources: Source[];
  materials: Material[];
  suggestions: string[];
}

export interface SSEPayload {
  type: 'token' | 'materials' | 'sources' | 'suggestions';
  content: string | Material[] | Source[] | string[];
}
