-- Create document_uploads table for audit trail
CREATE TABLE IF NOT EXISTS document_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'documents',
  pinecone_record_count INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_uploads_user_id ON document_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_created_at ON document_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_document_uploads_namespace ON document_uploads(namespace);

-- Enable RLS (Row Level Security)
ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to view all uploads and users to view their own
CREATE POLICY "Users can view their own uploads" ON document_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all uploads" ON document_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create policy to allow admins to insert uploads
CREATE POLICY "Admins can insert uploads" ON document_uploads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_uploads_updated_at 
  BEFORE UPDATE ON document_uploads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
