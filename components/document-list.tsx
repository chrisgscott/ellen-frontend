'use client';

import { useState, useEffect, useCallback } from 'react';
import { File, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  content_chunks: Array<{
    content: string;
    chunk_index: number;
  }>;
}

interface DocumentListProps {
  sessionId: string;
  onDocumentDeleted?: (documentId: string) => void;
}

export function DocumentList({ sessionId, onDocumentDeleted }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('session_documents')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load documents.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      loadDocuments();
    }
  }, [sessionId, loadDocuments]);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const supabase = createClient();
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('session_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw deleteError;
      }

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      onDocumentDeleted?.(documentId);

    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error}</p>
          <Button variant="outline" size="sm" onClick={loadDocuments} className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload a document to enable Ellen to search through it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Uploaded Documents ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.original_filename}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(doc.file_size)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {doc.content_chunks?.length || 0} chunks
                  </Badge>
                  <span className="text-xs text-gray-500 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(doc.created_at)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(doc.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
