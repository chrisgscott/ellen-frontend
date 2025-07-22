'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ShieldAlert, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  fileName?: string;
}

export default function DocumentsAdminPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdminStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || 'user');
      } else {
        setUserRole('user');
      }
      setLoading(false);
    };

    checkAdminStatus();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/markdown'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setUploadStatus({
          status: 'error',
          progress: 0,
          message: 'Unsupported file type. Please upload PDF, TXT, DOC, DOCX, or MD files.',
          fileName: file.name
        });
        return;
      }

      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setUploadStatus({
          status: 'error',
          progress: 0,
          message: 'File size too large. Please upload files smaller than 50MB.',
          fileName: file.name
        });
        return;
      }

      setSelectedFile(file);
      setUploadStatus({
        status: 'idle',
        progress: 0,
        message: `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        fileName: file.name
      });
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploadStatus({
      status: 'uploading',
      progress: 10,
      message: 'Preparing upload...',
      fileName: selectedFile.name
    });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('namespace', 'documents');

      setUploadStatus(prev => ({
        ...prev,
        progress: 30,
        message: 'Uploading to Pinecone...'
      }));

      const response = await fetch('/api/admin/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setUploadStatus(prev => ({
        ...prev,
        progress: 70,
        message: 'Processing and embedding...'
      }));

      const result = await response.json();

      setUploadStatus({
        status: 'success',
        progress: 100,
        message: `Successfully uploaded and processed ${result.recordCount || 'multiple'} chunks`,
        fileName: selectedFile.name
      });

      // Reset file selection after successful upload
      setSelectedFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed',
        fileName: selectedFile.name
      });
    }
  }, [selectedFile]);

  const resetUpload = useCallback(() => {
    setUploadStatus({
      status: 'idle',
      progress: 0,
      message: ''
    });
    setSelectedFile(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col justify-center items-center h-full text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin Dashboard
        </Button>
        
        <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
        <p className="text-muted-foreground">
          Upload documents to the Ellen knowledge base. Documents will be automatically chunked and embedded using Pinecone&apos;s integrated inference.
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select Document</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.txt,.doc,.docx,.md"
                onChange={handleFileSelect}
                disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: PDF, TXT, DOC, DOCX, MD (Max 50MB)
              </p>
            </div>

            {uploadStatus.message && (
              <Alert className={
                uploadStatus.status === 'error' ? 'border-red-200 bg-red-50' :
                uploadStatus.status === 'success' ? 'border-green-200 bg-green-50' :
                'border-blue-200 bg-blue-50'
              }>
                <div className="flex items-center">
                  {uploadStatus.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                  {uploadStatus.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {(uploadStatus.status === 'uploading' || uploadStatus.status === 'processing') && 
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {uploadStatus.status === 'idle' && <FileText className="w-4 h-4 text-blue-500" />}
                </div>
                <AlertDescription className="ml-2">
                  {uploadStatus.message}
                </AlertDescription>
              </Alert>
            )}

            {(uploadStatus.status === 'uploading' || uploadStatus.status === 'processing') && (
              <Progress value={uploadStatus.progress} className="w-full" />
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                className="flex-1"
              >
                {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploadStatus.status === 'uploading' ? 'Uploading...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload to Knowledge Base
                  </>
                )}
              </Button>

              {(uploadStatus.status === 'error' || uploadStatus.status === 'success') && (
                <Button variant="outline" onClick={resetUpload}>
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Documents are uploaded to the &quot;documents&quot; namespace in Pinecone</li>
              <li>• Pinecone&apos;s integrated inference automatically chunks and embeds content</li>
              <li>• Processing time depends on document size and complexity</li>
              <li>• Uploaded documents immediately become available for Ellen&apos;s knowledge retrieval</li>
              <li>• Large documents may be split into multiple chunks for optimal search performance</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
