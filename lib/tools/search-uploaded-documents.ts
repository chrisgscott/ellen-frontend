import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

interface DocumentChunk {
  id: string;
  content: string;
  chunk_index: number;
  metadata?: Record<string, unknown>;
}

interface SearchResult {
  document_name: string;
  chunk_id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
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
  handler: async (args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      const { query, document_name } = args as { query: string; document_name?: string };
      const { supabase, session_id, controller, encoder } = context;
      
      console.log('🔧 DOCUMENT_SEARCH: Searching documents for session:', session_id, 'query:', query);
      
      // Stream status to client
      const streamData = (data: { type: string; content: string }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      streamData({
        type: 'tool_status',
        content: `🔍 Searching uploaded documents for: "${query}"`
      });
      
      // First look for documents in the current session
      let queryBuilder = supabase
        .from('session_documents')
        .select('*')
        .eq('session_id', session_id);
      
      if (document_name) {
        queryBuilder = queryBuilder.ilike('original_filename', `%${document_name}%`);
      }
      
      const { data: sessionDocuments, error: sessionError } = await queryBuilder;
      
      if (sessionError) {
        console.error('🔧 DOCUMENT_SEARCH: Database error searching session:', sessionError);
        throw sessionError;
      }
      
      // If no documents in this session, try to find recent documents by filename (RFI)
      // Determine which documents to use - either from current session or fallback to recent uploads
      let documentsToUse;
      
      if (!sessionDocuments || sessionDocuments.length === 0) {
        console.log('🔧 DOCUMENT_SEARCH: No documents in current session, searching recent uploads...');
        
        // Look for any document with a filename matching common RFI patterns
        let fallbackQuery = supabase
          .from('session_documents')
          .select('*');
          
        if (document_name) {
          // If user specified a document name, use that
          fallbackQuery = fallbackQuery.ilike('original_filename', `%${document_name}%`);
        } else {
          // Otherwise, look for common document patterns in the query or filename
          const isRfiQuery = query.toLowerCase().includes('rfi');
          
          if (isRfiQuery) {
            fallbackQuery = fallbackQuery.ilike('original_filename', '%rfi%');
          }
        }
        
        // Order by most recently uploaded
        fallbackQuery = fallbackQuery.order('uploaded_at', { ascending: false }).limit(5);
        
        const { data: recentDocuments, error: recentError } = await fallbackQuery;
        
        if (recentError) {
          console.error('🔧 DOCUMENT_SEARCH: Error searching for recent documents:', recentError);
          throw recentError;
        }
        
        if (!recentDocuments || recentDocuments.length === 0) {
          console.log('🔧 DOCUMENT_SEARCH: No documents found in any session');
          return {
            success: true,
            data: {
              message: 'No documents found. Please upload a document first.',
              results: []
            }
          };
        }
        
        console.log('🔧 DOCUMENT_SEARCH: Found recent documents from other sessions:', recentDocuments.length);
        documentsToUse = recentDocuments;
      } else {
        // Use documents from the current session if found
        documentsToUse = sessionDocuments;
      }
      
      console.log('🔧 DOCUMENT_SEARCH: Found', documentsToUse.length, 'documents');
      
      // Search through content chunks
      const searchResults: SearchResult[] = [];
      const searchQuery = query.toLowerCase();
      
      for (const doc of documentsToUse) {
        const chunks = doc.content_chunks as DocumentChunk[];
        
        for (const chunk of chunks) {
          const content = chunk.content.toLowerCase();
          if (content.includes(searchQuery)) {
            // Calculate relevance score (simple keyword matching)
            const matches = (content.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
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
      
      console.log('🔧 DOCUMENT_SEARCH: Found', searchResults.length, 'total results,', topResults.length, 'top results');
      
      streamData({
        type: 'tool_result',
        content: `Found ${topResults.length} relevant sections in ${documentsToUse.length} uploaded document(s)`
      });
      
      return {
        success: true,
        data: {
          query,
          total_documents: documentsToUse.length,
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
      console.error('🔧 DOCUMENT_SEARCH: Error searching documents:', error);
      return {
        success: false,
        error: `Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
};

export default searchUploadedDocumentsTool;
