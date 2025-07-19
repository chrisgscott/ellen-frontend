import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Ensure route is not cached

// Define TypeScript interfaces for better type safety
interface Session {
  id: string;
  created_at: string;
  title?: string;
  user_id?: string;
}

interface Document {
  id: string;
  session_id: string | null;
  original_filename: string;
  file_size?: number;
  uploaded_at?: string;
  processed_at?: string;
  content_chunks?: Record<string, unknown>[];
}

interface DebugResults {
  sessions: Session[];
  documents: Document[];
  associations: Record<string, Document[]>;
  directQuery?: {
    session_id: string;
    count: number;
    documents: Record<string, unknown>[];
  };
}

export async function GET() {
  console.log('🔎 Starting document-session association debug...');
  const results: DebugResults = {
    sessions: [],
    documents: [],
    associations: {}
  };

  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // 1. Get recent sessions (last 5)
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionError) {
      console.error('Error fetching sessions:', sessionError);
      return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
    }

    const typedSessions = sessions as Session[];
    results.sessions = typedSessions;
    console.log(`📊 Found ${typedSessions.length} recent sessions`);
    typedSessions.forEach((session: Session, index: number) => {
      console.log(`  ${index + 1}. Session ${session.id} (${session.title || 'No title'}) - ${session.created_at}`);
    });

    // 2. Get recent documents (last 10)
    const { data: documents, error: documentError } = await supabase
      .from('session_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(10);

    if (documentError) {
      console.error('Error fetching documents:', documentError);
      return NextResponse.json({ error: 'Error fetching documents' }, { status: 500 });
    }

    // Transform the document data to ensure it matches our interface
    const typedDocuments: Document[] = (documents || []).map((doc: Record<string, unknown>) => {
      // Handle content_chunks specifically to ensure it's the right type
      let processedChunks: Record<string, unknown>[] | undefined = undefined;
      if (Array.isArray(doc.content_chunks)) {
        processedChunks = doc.content_chunks as Record<string, unknown>[];
      }
      
      return {
        id: String(doc.id || ''),
        session_id: doc.session_id ? String(doc.session_id) : null,
        original_filename: String(doc.original_filename || doc.filename || 'unknown'),
        file_size: typeof doc.file_size === 'number' ? doc.file_size : undefined,
        uploaded_at: doc.uploaded_at ? String(doc.uploaded_at) : undefined,
        processed_at: doc.processed_at ? String(doc.processed_at) : undefined,
        content_chunks: processedChunks
      };
    });
    
    results.documents = typedDocuments;
    console.log(`📊 Found ${typedDocuments.length} recent documents`);
    typedDocuments.forEach((doc: Document, index: number) => {
      console.log(`  ${index + 1}. Doc ${doc.id} - ${doc.original_filename} - Session: ${doc.session_id || 'NULL'} - ${doc.uploaded_at || doc.processed_at || 'Unknown date'}`);
    });

    // Try a direct SQL query as a fallback
    console.log('\n📊 Attempting direct query to debug issue...');
    try {
      const { data: directData, error: directError } = await supabase
        .from('session_documents')
        .select('id, filename, session_id, original_filename')
        .order('uploaded_at', { ascending: false })
        .limit(5);

      if (directError) {
        console.error('Direct SQL query error:', directError);
      } else {
        console.log(`Direct SQL query returned ${directData?.length || 0} documents`);
        
        // We'll just log these for debugging purposes
        if (directData && directData.length > 0) {
          directData.forEach((doc: Record<string, unknown>, index: number) => {
            // Type-safe access to properties
            const id = doc.id ? String(doc.id) : 'undefined';
            const sessionId = doc.session_id ? String(doc.session_id) : 'NULL';
            const filename = doc.filename ? String(doc.filename) : 
                            doc.original_filename ? String(doc.original_filename) : 'unknown';
            
            console.log(`  Direct query doc ${index + 1}: ID=${id}, session_id=${sessionId}, filename=${filename}`);
          });
        }
      }
    } catch (directQueryError) {
      console.error('Direct query exception:', directQueryError);
    }

    // 3. Check for matches between recent sessions and documents
    console.log('\n📊 Checking session-document associations...');
    const associations: Record<string, Document[]> = {};
    for (const session of typedSessions) {
      const sessionDocs = typedDocuments.filter((doc: Document) => doc.session_id === session.id);
      console.log(`  Session ${session.id} has ${sessionDocs.length} associated documents`);
      // Will find the session most likely to be associated with each document
      if (sessionDocs.length === 0) {
        // Check if there are documents uploaded around the same time as session creation
        const sessionDate = new Date(session.created_at);
        
        const possibleMatches = typedDocuments.filter((doc: Document) => {
          const docDate = new Date(doc.uploaded_at || doc.processed_at || '');
          // Check for documents uploaded within 5 minutes of session creation
          const timeDiff = Math.abs(docDate.getTime() - sessionDate.getTime());
          const fiveMinutesMs = 5 * 60 * 1000;
          return timeDiff <= fiveMinutesMs;
        });

        if (possibleMatches.length > 0) {
          console.log(`  Found ${possibleMatches.length} documents uploaded around the same time as session creation`);
          possibleMatches.forEach((doc, i) => {
            console.log(`    ${i + 1}. ${doc.original_filename} (${doc.uploaded_at || doc.processed_at || 'Unknown date'})`);
          });
        }
      }
    }
    results.associations = associations;

    // 4. Verify database values for one specific session to check query validity
    if (sessions.length > 0) {
      const latestSessionId = sessions[0].id;
      console.log(`\n📊 Double-checking database query for session ${latestSessionId}...`);
      
      const { data: checkDocs, error: checkError } = await supabase
        .from('session_documents')
        .select('id, original_filename')
        .eq('session_id', latestSessionId);
        
      if (checkError) {
        throw new Error(`Error in verification query: ${checkError.message}`);
      }
      
      results.directQuery = {
        session_id: latestSessionId,
        count: checkDocs.length,
        documents: checkDocs
      };
      console.log(`  Direct query found ${checkDocs.length} documents for session ${latestSessionId}`);
    }

    return NextResponse.json({ success: true, results });

  } catch (error: unknown) {
    console.error('❌ Debug script error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
