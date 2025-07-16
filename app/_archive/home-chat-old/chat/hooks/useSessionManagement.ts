import { createClient } from '@/lib/supabase/client';
import { Session } from '../types';
import { fetchThreads } from './useThreads';

const supabase = createClient();

/**
 * Fetch a session by ID, including its threads
 */
export async function fetchSession(id: string): Promise<Session> {
  try {
    // Fetch session data
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();
      
    if (sessionError) throw new Error(sessionError.message);
    if (!sessionData) throw new Error('Session not found');
    
    // Fetch threads for this session
    const threads = await fetchThreads(id);
    
    // Return session with threads
    return {
      id: sessionData.id,
      user_id: sessionData.user_id,
      project_id: sessionData.project_id,
      title: sessionData.title,
      metadata: sessionData.metadata,
      threads,
      created_at: sessionData.created_at,
      updated_at: sessionData.updated_at,
      expires_at: sessionData.expires_at
    };
  } catch (err) {
    console.error('Error fetching session:', err);
    throw err;
  }
}

/**
 * Create a new session
 */
export async function createNewSession(
  title?: string,
  projectId?: string | null
): Promise<Session> {
  try {
    // Create session in database
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .insert({ 
        project_id: projectId || null,
        title: title || 'New Chat',
        metadata: {}
      })
      .select('*')
      .single();
      
    if (sessionError) throw new Error(sessionError.message);
    if (!sessionData) throw new Error('Failed to create session');
    
    // Return new session with empty threads array
    return {
      id: sessionData.id,
      user_id: sessionData.user_id,
      project_id: sessionData.project_id,
      title: sessionData.title,
      metadata: sessionData.metadata,
      threads: [],
      created_at: sessionData.created_at,
      updated_at: sessionData.updated_at,
      expires_at: sessionData.expires_at
    };
  } catch (err) {
    console.error('Error creating session:', err);
    throw err;
  }
}
