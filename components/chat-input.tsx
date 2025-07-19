'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Paperclip, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  sessionId?: string;
  className?: string;
  showDocumentUpload?: boolean;
  onCreateSession?: () => Promise<string>;
  // Document staging props
  onDocumentStaged?: (file: File) => void;
  stagedDocuments?: Array<{name: string; size: number; uploadedAt: Date}>;
}

interface UploadedDocument {
  name: string;
  size: number;
  uploadedAt: Date;
}

export function ChatInput({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "Ask anything...",
  disabled = false,
  sessionId,
  className = "",
  showDocumentUpload = true,
  onCreateSession,
  onDocumentStaged,
  stagedDocuments = []
}: ChatInputProps) {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingDocuments, setIsFetchingDocuments] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Effect to handle displaying either session documents or staged documents
  useEffect(() => {
    if (sessionId) {
      // When we have a session ID, fetch real documents from the database
      fetchSessionDocuments(sessionId);
    } else {
      // No session - show staged documents from props
      setUploadedDocuments(stagedDocuments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Only depend on sessionId to prevent infinite loops
  
  // Update documents when stagedDocuments changes (but only if no session)
  useEffect(() => {
    if (!sessionId) {
      setUploadedDocuments(stagedDocuments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedDocuments.length, sessionId]); // Use length to prevent infinite loops
  
  // Function to fetch documents associated with a session from the server
  async function fetchSessionDocuments(sessionId: string) {
    if (!sessionId) return;
    
    try {
      setIsFetchingDocuments(true);
      console.log('📄 SESSION_DOCS: Fetching documents for session:', sessionId);
      const response = await fetch(`/api/chat/session-documents?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch session documents');
      }
      
      const data = await response.json();
      console.log('📄 SESSION_DOCS: Found', data.documents.length, 'documents');
      
      setUploadedDocuments(data.documents.map((doc: any) => ({
        name: doc.original_filename,
        size: doc.file_size || 0,
        uploadedAt: new Date(doc.uploaded_at)
      })));
    } catch (error) {
      console.error('Error fetching session documents:', error);
    } finally {
      setIsFetchingDocuments(false);
    }
  }

  // Handle file selection for staging (not immediate upload)
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type and size
    if (file.type !== 'text/plain') {
      setUploadError('Only .txt files are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Instead of uploading immediately, we stage the document
      const newDocument = {
        name: file.name,
        size: file.size,
        uploadedAt: new Date()
      };
      
      setUploadedDocuments(prev => [...prev, newDocument]);
      
      // Notify parent about staged document
      if (onDocumentStaged) {
        onDocumentStaged(file);
      }
    } catch (error) {
      console.error('Error staging file:', error);
      setUploadError('Failed to stage document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset the input so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    // In the new design, we only allow removing staged documents
    // Once documents are associated with a session, they can't be removed from the UI
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Chat Input Form */}
      <form onSubmit={onSubmit} className="relative">
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder}
            className="pl-10 pr-20 py-6 text-base rounded-full border border-input bg-background shadow-xl"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isUploading}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {showDocumentUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  title="Upload document"
                >
                  <Paperclip className={`h-4 w-4 ${isUploading ? 'animate-spin' : ''}`} />
                </Button>
              </>
            )}
            <Button 
              type="submit" 
              variant="default"
              size="sm" 
              className="h-8 w-8 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={disabled || isUploading || !value.trim()}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upload Error */}
        {uploadError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription className="text-sm">
              {uploadError}
            </AlertDescription>
          </Alert>
        )}

        {/* Uploaded Documents */}
        {uploadedDocuments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {uploadedDocuments.map((doc, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
                <File className="h-3 w-3" />
                <span className="text-xs">{doc.name}</span>
                <span className="text-xs text-muted-foreground">({formatFileSize(doc.size)})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeDocument(index)}
                  disabled={!!sessionId} // Only allow removal for staged documents (no session yet)
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        
        {/* Loading indicator for documents */}
        {isFetchingDocuments && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Loading documents...
          </p>
        )}
      </form>

      {/* Upload Status */}
      {isUploading && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Processing document...
        </p>
      )}
    </div>
  );
}
