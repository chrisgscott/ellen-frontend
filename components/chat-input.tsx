'use client';

import { useState, useRef } from 'react';
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
  onCreateSession
}: ChatInputProps) {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    let currentSessionId = sessionId;

    if (!currentSessionId && onCreateSession) {
      try {
        console.log('📄 ChatInput: No session, creating one...');
        currentSessionId = await onCreateSession();
        console.log('📄 ChatInput: New session created:', currentSessionId);
      } catch (error) {
        console.error('📄 ChatInput: Could not create session', error);
        setUploadError('Could not create a session. Please try again.');
        setIsUploading(false);
        return;
      }
    }

    if (!currentSessionId) {
      setUploadError('No active session. Please start a conversation first.');
      setIsUploading(false);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('text/')) {
      setUploadError('Only text files are currently supported (.txt)');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', currentSessionId);

      const response = await fetch('/api/chat/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      // Add to uploaded documents list
      setUploadedDocuments(prev => [...prev, {
        name: file.name,
        size: file.size,
        uploadedAt: new Date()
      }]);

      // Clear any previous errors
      setUploadError(null);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
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
            {showDocumentUpload && (sessionId || onCreateSession) && (
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
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </form>

      {/* Upload Status */}
      {isUploading && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Uploading and processing document...
        </p>
      )}
    </div>
  );
}
