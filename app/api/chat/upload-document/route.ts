import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DocumentProcessor } from '@/lib/services/documentProcessor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    
    console.log('📄 UPLOAD DOCUMENT API: Received upload request', {
      filename: file?.name,
      fileSize: file?.size,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    if (!file || !sessionId) {
      console.error('📄 UPLOAD DOCUMENT API: Missing required parameters', { file: !!file, sessionId });
      return NextResponse.json({ error: 'Missing file or session ID' }, { status: 400 });
    }
    
    // Validate file (size, type)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    
    const allowedTypes = [
      'text/plain',
      // 'application/pdf', // TODO: Enable when PDF processing is implemented
      // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // TODO: Enable when DOCX processing is implemented
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Currently only text files (.txt) are supported.' 
      }, { status: 400 });
    }
    
    const supabase = await createClient();
    const processor = new DocumentProcessor();
    
    // Get all session headers for debugging
    const sessionIdFromHeader = request.headers.get('X-Session-ID');
    
    console.log('📄 UPLOAD DOCUMENT API: Session ID details:', {
      formDataSessionId: sessionId,
      headerSessionId: sessionIdFromHeader,
      timestamp: new Date().toISOString()
    });
    
    // Verify the session exists and belongs to the current user
    console.log('📄 UPLOAD DOCUMENT API: Verifying session exists:', sessionId);
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, created_at')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) {
      console.error('📄 UPLOAD DOCUMENT API: Session verification error:', sessionError);
      return NextResponse.json({ error: `Invalid session: ${sessionError.message}` }, { status: 400 });
    }
    
    if (!session) {
      console.error('📄 UPLOAD DOCUMENT API: Session not found:', sessionId);
      return NextResponse.json({ error: 'Session not found' }, { status: 400 });
    }
    
    console.log('📄 UPLOAD DOCUMENT API: Session verified successfully:', sessionId);
    
    // 1. Store file in Supabase Storage
    const fileName = `${sessionId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('session-documents')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to store file' }, { status: 500 });
    }
    
    // 2. Extract and process text content
    const chunks = await processor.processDocument(file);
    
    // 3. Store in session_documents table
    const { data: documentData, error: dbError } = await supabase
      .from('session_documents')
      .insert({
        session_id: sessionId,
        filename: fileName,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        content_chunks: chunks,
        processed_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up the uploaded file if database insert fails
      await supabase.storage
        .from('session-documents')
        .remove([fileName]);
      return NextResponse.json({ error: 'Failed to save document metadata' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      documentId: documentData.id,
      filename: file.name,
      chunks: chunks.length,
      message: `Successfully processed ${file.name} into ${chunks.length} chunks`
    });
    
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}
