/**
 * Debug script for document upload and session association
 * 
 * This script directly queries the database to check for document-session associations
 */

import { createClient } from '@/lib/supabase/server';

async function main() {
  console.log('🔎 Starting document-session association debug...');

  try {
    // Create Supabase client
    const supabase = await createClient();

    // 1. Get recent sessions
    console.log('📊 Fetching recent sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, created_at, title')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionsError) {
      throw new Error(`Error fetching sessions: ${sessionsError.message}`);
    }

    console.log(`📊 Found ${sessions.length} recent sessions`);
    sessions.forEach((session, index) => {
      console.log(`  ${index + 1}. Session ${session.id} (${session.title || 'No title'}) - ${session.created_at}`);
    });

    // 2. Get recent documents
    console.log('\n📊 Fetching recent documents...');
    const { data: documents, error: documentsError } = await supabase
      .from('session_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(10);

    if (documentsError) {
      throw new Error(`Error fetching documents: ${documentsError.message}`);
    }

    console.log(`📊 Found ${documents.length} recent documents`);
    documents.forEach((doc, index) => {
      console.log(`  ${index + 1}. Doc ${doc.id} - ${doc.original_filename} - Session: ${doc.session_id || 'NULL'} - ${doc.uploaded_at || doc.processed_at || 'Unknown date'}`);
    });

    // 3. Check for matches between recent sessions and documents
    console.log('\n📊 Checking session-document associations...');
    for (const session of sessions) {
      const sessionDocs = documents.filter(doc => doc.session_id === session.id);
      console.log(`  Session ${session.id} has ${sessionDocs.length} associated documents`);
      
      if (sessionDocs.length === 0) {
        // Check if there are documents uploaded around the same time as session creation
        const sessionDate = new Date(session.created_at);
        const possibleMatches = documents.filter(doc => {
          const docDate = new Date(doc.uploaded_at || doc.processed_at || '');
          // Check for documents uploaded within 5 minutes of session creation
          const timeDiff = Math.abs(docDate.getTime() - sessionDate.getTime());
          return timeDiff < 5 * 60 * 1000; // 5 minutes in milliseconds
        });
        
        if (possibleMatches.length > 0) {
          console.log(`  ⚠️ POTENTIAL MISMATCH: Found ${possibleMatches.length} documents uploaded around the same time as session ${session.id}`);
          possibleMatches.forEach(doc => {
            console.log(`    - Doc ${doc.id} (${doc.original_filename}) has session_id: ${doc.session_id || 'NULL'}`);
          });
        }
      }
    }

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
      
      console.log(`  Direct query found ${checkDocs.length} documents for session ${latestSessionId}`);
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the main function
main().catch(console.error);
