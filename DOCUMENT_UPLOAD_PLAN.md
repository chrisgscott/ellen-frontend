# Document Upload Implementation Plan

## Overview

This document outlines the implementation plan for adding session-scoped document upload functionality to Ellen, allowing users to upload documents that can be analyzed by Ellen within the context of a specific chat session.

## Architecture Decision

**Hybrid Approach: UI Upload + Search Tool**

- **Document Upload**: UI feature that allows users to upload files to a chat session
- **Document Search**: Tool that Ellen can call to search through uploaded documents
- **Rationale**: Document upload is a user action, document search is an Ellen capability

## Implementation Phases

### Phase 1: Document Upload Infrastructure (1-2 days)

#### 1.1 Database Schema

Add to your existing Supabase schema:

```sql
-- Add to your existing Supabase schema
CREATE TABLE session_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  content_chunks JSONB NOT NULL, -- Processed text chunks
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Index for fast session-based queries
CREATE INDEX idx_session_documents_session_id ON session_documents(session_id);
```

#### 1.2 Upload API Endpoint

Create `app/api/chat/upload-document/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DocumentProcessor } from '@/lib/services/documentProcessor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    
    if (!file || !sessionId) {
      return NextResponse.json({ error: 'Missing file or session ID' }, { status: 400 });
    }
    
    // Validate file (size, type)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }
    
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    
    const supabase = createClient();
    const processor = new DocumentProcessor();
    
    // 1. Store file in Supabase Storage
    const fileName = `${sessionId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('session-documents')
      .upload(fileName, file);
    
    if (uploadError) {
      throw uploadError;
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
      throw dbError;
    }
    
    return NextResponse.json({ 
      success: true, 
      documentId: documentData.id,
      filename: file.name,
      chunks: chunks.length
    });
    
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

#### 1.3 Document Processing Service

Create `lib/services/documentProcessor.ts`:

```typescript
export interface DocumentChunk {
  id: string;
  content: string;
  page?: number;
  section?: string;
  metadata?: Record<string, any>;
}

export class DocumentProcessor {
  async processDocument(file: File): Promise<DocumentChunk[]> {
    const text = await this.extractText(file);
    return this.chunkText(text, file.name);
  }
  
  private async extractText(file: File): Promise<string> {
    if (file.type === 'text/plain') {
      return await file.text();
    }
    
    if (file.type === 'application/pdf') {
      // TODO: Implement PDF text extraction
      // Could use pdf-parse or similar library
      throw new Error('PDF processing not yet implemented');
    }
    
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // TODO: Implement DOCX text extraction
      // Could use mammoth or similar library
      throw new Error('DOCX processing not yet implemented');
    }
    
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  
  private chunkText(text: string, filename: string): DocumentChunk[] {
    // Simple chunking strategy - split by paragraphs and limit size
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;
    
    const maxChunkSize = 1000; // characters
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `${filename}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: { source: filename, chunkIndex }
        });
        currentChunk = paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${filename}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: { source: filename, chunkIndex }
      });
    }
    
    return chunks;
  }
}
```

### Phase 2: Document Search Tool (1 day)

#### 2.1 Create the Tool

Create `lib/tools/search-uploaded-documents.ts`:

```typescript
import { EllenTool, ToolContext, ToolResult } from './types';

interface SearchArgs {
  query: string;
  document_name?: string;
}

const searchUploadedDocumentsTool: EllenTool = {
  name: 'search_uploaded_documents',
  description: 'Search through documents uploaded by the user in this chat session',
  schema: {
    type: 'function' as const,
    function: {
      name: 'search_uploaded_documents',
      description: 'Search for information in documents uploaded by the user. Use this when the user asks about content from their uploaded files or references "my document", "the file I uploaded", etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant content in uploaded documents',
          },
          document_name: {
            type: 'string',
            description: 'Optional: specific document filename to search in',
          },
        },
        required: ['query'],
      },
    },
  },
  handler: async (args: SearchArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      const { query, document_name } = args;
      const { supabase, session_id, controller, encoder } = context;
      
      // Stream status to client
      const streamData = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      streamData({
        type: 'tool_status',
        content: `🔍 Searching uploaded documents for: "${query}"`
      });
      
      // Query session_documents table for this session
      let query_builder = supabase
        .from('session_documents')
        .select('*')
        .eq('session_id', session_id);
      
      if (document_name) {
        query_builder = query_builder.ilike('original_filename', `%${document_name}%`);
      }
      
      const { data: documents, error } = await query_builder;
      
      if (error) {
        throw error;
      }
      
      if (!documents || documents.length === 0) {
        return {
          success: true,
          data: {
            message: 'No documents found in this session. Please upload a document first.',
            results: []
          }
        };
      }
      
      // Search through content chunks
      const searchResults: any[] = [];
      const searchQuery = query.toLowerCase();
      
      for (const doc of documents) {
        const chunks = doc.content_chunks as any[];
        
        for (const chunk of chunks) {
          const content = chunk.content.toLowerCase();
          if (content.includes(searchQuery)) {
            // Calculate relevance score (simple keyword matching)
            const matches = (content.match(new RegExp(searchQuery, 'g')) || []).length;
            const score = matches / content.length * 1000; // Normalize by content length
            
            searchResults.push({
              document_name: doc.original_filename,
              chunk_id: chunk.id,
              content: chunk.content,
              score,
              metadata: chunk.metadata
            });
          }
        }
      }
      
      // Sort by relevance score
      searchResults.sort((a, b) => b.score - a.score);
      
      // Take top 5 results
      const topResults = searchResults.slice(0, 5);
      
      streamData({
        type: 'tool_result',
        content: `Found ${topResults.length} relevant sections in ${documents.length} uploaded document(s)`
      });
      
      return {
        success: true,
        data: {
          query,
          total_documents: documents.length,
          total_results: searchResults.length,
          top_results: topResults
        },
        streamToClient: true,
        clientPayload: {
          type: 'document_search_results',
          content: topResults
        }
      };
      
    } catch (error) {
      console.error('Document search error:', error);
      return {
        success: false,
        error: `Failed to search documents: ${error.message}`
      };
    }
  },
};

export default searchUploadedDocumentsTool;
```

#### 2.2 Register the Tool

Update `lib/tools/registry.ts`:

```typescript
import { ToolRegistry } from './types';
import materialExtractorTool from './materialExtractor';
import opportunitiesTool from './opportunities';
import monitorGeopoliticalRisksTool from './monitor-geopolitical-risks';
import portfolioSummaryTool from './portfolio';
import searchUploadedDocumentsTool from './search-uploaded-documents';

// Tool registry - add new tools here
export const toolRegistry: ToolRegistry = {
  [materialExtractorTool.name]: materialExtractorTool,
  [opportunitiesTool.name]: opportunitiesTool,
  [monitorGeopoliticalRisksTool.name]: monitorGeopoliticalRisksTool,
  [portfolioSummaryTool.name]: portfolioSummaryTool,
  [searchUploadedDocumentsTool.name]: searchUploadedDocumentsTool,
};

// ... rest of the file remains the same
```

### Phase 3: UI Integration (1-2 days)

#### 3.1 Document Upload Component

Create `components/document-upload.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadedDocument {
  id: string;
  filename: string;
  size: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface DocumentUploadProps {
  sessionId: string;
  onDocumentUploaded?: (document: UploadedDocument) => void;
}

export function DocumentUpload({ sessionId, onDocumentUploaded }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadDocument = async (file: File) => {
    const tempDoc: UploadedDocument = {
      id: `temp-${Date.now()}`,
      filename: file.name,
      size: file.size,
      status: 'uploading'
    };

    setDocuments(prev => [...prev, tempDoc]);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/chat/upload-document', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const successDoc: UploadedDocument = {
          id: result.documentId,
          filename: file.name,
          size: file.size,
          status: 'success'
        };

        setDocuments(prev => prev.map(doc => 
          doc.id === tempDoc.id ? successDoc : doc
        ));

        onDocumentUploaded?.(successDoc);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      setDocuments(prev => prev.map(doc => 
        doc.id === tempDoc.id 
          ? { ...doc, status: 'error' as const, error: error.message }
          : doc
      ));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(uploadDocument);
  }, [sessionId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        {isDragActive ? (
          <p className="text-primary">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-gray-600">Drag & drop files here, or click to select</p>
            <p className="text-sm text-gray-500 mt-1">
              Supports PDF, TXT, DOCX (max 10MB each)
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Documents</h4>
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-500">
                  {(doc.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex items-center gap-2">
                {doc.status === 'uploading' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                )}
                {doc.status === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {doc.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-500" title={doc.error} />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDocument(doc.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 3.2 Chat Interface Integration

Update your chat page to include the document upload component:

```typescript
// In your chat page component
import { DocumentUpload } from '@/components/document-upload';

// Add this to your chat interface, perhaps in a collapsible section
<div className="border-t border-gray-200 p-4">
  <details className="group">
    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
      <Upload className="h-4 w-4" />
      Upload Documents
      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
    </summary>
    <div className="mt-3">
      <DocumentUpload 
        sessionId={session?.id || ''} 
        onDocumentUploaded={(doc) => {
          // Optional: Show success message or refresh document list
          console.log('Document uploaded:', doc);
        }}
      />
    </div>
  </details>
</div>
```

### Phase 4: Advanced Features (Future Enhancements)

#### 4.1 Vector Search Enhancement
- Implement semantic search using embeddings
- Store document vectors in Pinecone for better search quality

#### 4.2 Document Management
- Document preview functionality
- Bulk document operations
- Document versioning

#### 4.3 Enhanced Processing
- Better text extraction for PDFs and DOCX
- Support for more file types (Excel, PowerPoint, etc.)
- OCR for scanned documents

#### 4.4 UI/UX Improvements
- Progress indicators for large file uploads
- Document thumbnails and previews
- Better error handling and user feedback

## Example User Flow

1. **User uploads document**: Drags `supply_chain_report.pdf` into chat
2. **System processes**: Extracts text, chunks content, stores in session
3. **User asks question**: "What are the main risks in my supply chain report?"
4. **Ellen searches**: Calls `search_uploaded_documents` tool with query "risks"
5. **Ellen responds**: "Based on your supply chain report, the main risks identified are..."

## Dependencies

### New Dependencies to Add
```bash
npm install react-dropzone
# For PDF processing (Phase 4):
npm install pdf-parse
# For DOCX processing (Phase 4):
npm install mammoth
```

### Supabase Storage Setup
1. Create a new storage bucket called `session-documents`
2. Set appropriate RLS policies for user access
3. Configure file size limits and allowed types

## Testing Strategy

1. **Unit Tests**: Test document processing and search functions
2. **Integration Tests**: Test upload API and tool integration
3. **E2E Tests**: Test complete user workflow
4. **Performance Tests**: Test with large documents and multiple uploads

## Security Considerations

1. **File Validation**: Strict file type and size validation
2. **Session Isolation**: Ensure documents are only accessible within their session
3. **Content Scanning**: Consider malware scanning for uploaded files
4. **Rate Limiting**: Prevent abuse of upload endpoints

## Monitoring and Logging

1. **Upload Metrics**: Track upload success rates and file sizes
2. **Search Performance**: Monitor search query performance
3. **Error Tracking**: Log and alert on processing failures
4. **Usage Analytics**: Track feature adoption and usage patterns

---

This implementation plan provides a solid foundation for document upload functionality while maintaining the existing architecture patterns and ensuring scalability for future enhancements.
