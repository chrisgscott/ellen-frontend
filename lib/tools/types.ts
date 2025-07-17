import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ToolContext {
  supabase: SupabaseClient;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  session_id: string;
  thread_id: string;
  message: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  streamToClient?: boolean;
  clientPayload?: {
    type: string;
    content: unknown;
  };
  error?: string;
}

// Type for tool function arguments - tools can define their own specific types
export type ToolArgs = Record<string, unknown>;

export interface EllenTool {
  name: string;
  description: string;
  schema: OpenAI.Chat.Completions.ChatCompletionTool;
  handler: (args: ToolArgs, context: ToolContext) => Promise<ToolResult>;
}

export type ToolRegistry = Record<string, EllenTool>;
