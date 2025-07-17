import { createClient } from '@/lib/supabase/server';
import { Thread, Session, Material } from '@/app/(perplexity-layout)/home/chat/types';

// Re-export types for convenience
export type { Thread, Session, Material };

/**
 * Retrieves a session by its ID, or creates a new one if the ID is null.
 * @param sessionId The ID of the session to retrieve, or null to create a new one.
 * @param title The title for the new session if one is created.
 * @returns The session object.
 */
export async function getOrCreateSession(sessionId: string | null, title: string): Promise<Session> {
  const supabase = createClient();
  if (sessionId) {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('DB_SERVICE: Error fetching session:', error);
      throw new Error(`Session not found: ${error.message}`);
    }
    if (!session) {
        throw new Error('Session not found');
    }
    return session as Session;
  } else {
    const { data: user } = await supabase.auth.getUser();
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({ title, user_id: user?.user?.id })
      .select()
      .single();

    if (error) {
      console.error('DB_SERVICE: Error creating session:', error);
      throw new Error(`Could not create session: ${error.message}`);
    }
    return newSession as Session;
  }
}

/**
 * Fetches the conversation history (all threads) for a given session.
 * @param sessionId The ID of the session.
 * @returns An array of thread objects.
 */
export async function getConversationHistory(sessionId: string): Promise<Thread[]> {
  const supabase = createClient();
  const { data: threads, error } = await supabase
    .from('threads')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB_SERVICE: Error fetching conversation history:', error);
    return [];
  }
  return (threads as Thread[]) || [];
}

/**
 * Saves a user's message to the database.
 * @param sessionId The ID of the session.
 * @param message The user's message content.
 * @returns The newly created thread object for the user message.
 */
export async function saveUserMessage(sessionId: string, message: string): Promise<Thread> {
    const supabase = createClient();
    const { data: userThread, error } = await supabase
        .from('threads')
        .insert({ session_id: sessionId, user_message: message, role: 'user' })
        .select()
        .single();

    if (error) {
        console.error('DB_SERVICE: Error saving user message:', error);
        throw new Error('Failed to save user message.');
    }
    return userThread as Thread;
}

/**
 * Creates a new placeholder thread for the assistant's response.
 * @param sessionId The ID of the session.
 * @param metadata Optional metadata to include.
 * @returns The newly created thread object for the assistant.
 */
export async function createAssistantThread(sessionId: string, metadata: Record<string, any> = {}): Promise<Thread> {
    const supabase = createClient();
    const { data: assistantThread, error } = await supabase
        .from('threads')
        .insert({ session_id: sessionId, role: 'assistant', metadata })
        .select()
        .single();

    if (error) {
        console.error('DB_SERVICE: Error creating assistant thread:', error);
        throw new Error('Failed to create assistant thread.');
    }
    return assistantThread as Thread;
}

/**
 * Updates an existing assistant thread with new data.
 * @param threadId The ID of the thread to update.
 * @param updates An object containing the fields to update.
 */
export async function updateAssistantThread(threadId: string, updates: Partial<Thread>): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from('threads')
        .update(updates)
        .eq('id', threadId);

    if (error) {
        console.error(`DB_SERVICE: Error updating thread ${threadId}:`, error);
        // We don't throw here to avoid crashing the stream, but we log the error.
    }
}

/**
 * Searches the Supabase materials database for relevant materials based on a query.
 * This function was moved from the original route.ts file.
 * @param query The user's search query.
 * @returns A promise that resolves to an array of Material objects.
 */
export async function searchMaterials(query: string): Promise<Material[]> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase.rpc('search_materials', { query_text: query });

        if (error) {
            console.error('DB_SERVICE: Supabase material search error:', error);
            return [];
        }

        return data as Material[];
    } catch (err) {
        console.error('DB_SERVICE: Unexpected error in searchMaterials:', err);
        return [];
    }
}
