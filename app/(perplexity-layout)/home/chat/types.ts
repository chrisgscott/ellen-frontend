/**
 * Chat data model types following Projects > Sessions > Threads > Messages paradigm
 * Aligned with the existing database schema
 */

// User or assistant message
export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  sources?: Source[];
  related_materials?: Material[];
  suggested_questions?: string[];
  created_at?: string;
}

// Source reference from assistant responses
export interface Source {
  title: string;
  url: string;
  snippet?: string;
}

// Material reference from assistant responses - matches database structure
export interface Material {
  id: string;
  material: string; // Name of the material
  short_summary?: string;
  summary?: string; // Full summary from database
  symbol?: string; // Chemical symbol (e.g. "Ce", "Co")
  material_card_color?: string; // Hex color for the card
  url?: string;
}

// A thread contains a user message and assistant response pair
export interface Thread {
  thread_id: string;
  session_id: string;
  user_message_id: string;
  assistant_message_id?: string;
  user_message: Message;
  assistant_message: Message | null;
  sources: Source[];
  related_materials: Material[];
  suggested_questions: string[];
  created_at?: string;
}

// A session contains multiple threads and belongs to a project
export interface Session {
  id: string;
  user_id?: string;
  project_id: string | null;
  title?: string;
  metadata?: Record<string, unknown>;
  threads: Thread[];
  is_loading?: boolean;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
}

// A project can contain multiple sessions
export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Server-sent event payload types
export interface SSEPayload {
  type: 'token' | 'sources' | 'materials' | 'suggestions' | 'error';
  content: string | Source[] | Material[] | string[] | Error;
}
