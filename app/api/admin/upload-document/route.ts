import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const namespace = formData.get('namespace') as string || 'documents';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, TXT, DOC, DOCX, or MD files.' 
      }, { status: 400 });
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size too large. Please upload files smaller than 50MB.' 
      }, { status: 400 });
    }

    // Convert file to text content based on type
    let textContent: string;
    
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      textContent = await file.text();
    } else if (file.type === 'application/pdf') {
      // For PDF files, we'll need to extract text
      // For now, return an error suggesting text format
      return NextResponse.json({ 
        error: 'PDF processing not yet implemented. Please convert to TXT or MD format.' 
      }, { status: 400 });
    } else {
      // For DOC/DOCX files
      return NextResponse.json({ 
        error: 'DOC/DOCX processing not yet implemented. Please convert to TXT or MD format.' 
      }, { status: 400 });
    }

    if (!textContent.trim()) {
      return NextResponse.json({ 
        error: 'File appears to be empty or unreadable.' 
      }, { status: 400 });
    }

    // Prepare document metadata
    const documentMetadata = {
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      namespace: namespace
    };

    // Upload to Pinecone using their upsert-records endpoint with integrated inference
    const pineconeResponse = await fetch(
      `https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/${namespace}/upsert`,
      {
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY!,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': 'unstable'
        },
        body: JSON.stringify({
          records: [
            {
              id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              text: textContent,
              ...documentMetadata
            }
          ]
        })
      }
    );

    if (!pineconeResponse.ok) {
      const errorText = await pineconeResponse.text();
      console.error('Pinecone upload error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to upload to Pinecone knowledge base' 
      }, { status: 500 });
    }

    const pineconeResult = await pineconeResponse.json();
    
    // Log the upload to Supabase for audit trail
    try {
      await supabase
        .from('document_uploads')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          namespace: namespace,
          pinecone_record_count: pineconeResult.recordCount || 1,
          metadata: documentMetadata
        });
    } catch (logError) {
      console.error('Failed to log upload to Supabase:', logError);
      // Don't fail the upload if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      recordCount: pineconeResult.recordCount || 1,
      filename: file.name,
      namespace: namespace
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during upload' 
    }, { status: 500 });
  }
}
