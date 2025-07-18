export interface DocumentChunk {
  id: string;
  content: string;
  page?: number;
  section?: string;
  metadata?: Record<string, unknown>;
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
      // For now, throw an error - we'll implement this in a future phase
      throw new Error('PDF processing not yet implemented. Please use text files for now.');
    }
    
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // TODO: Implement DOCX text extraction
      // For now, throw an error - we'll implement this in a future phase
      throw new Error('DOCX processing not yet implemented. Please use text files for now.');
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
          metadata: { 
            source: filename, 
            chunkIndex,
            charCount: currentChunk.trim().length
          }
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
        metadata: { 
          source: filename, 
          chunkIndex,
          charCount: currentChunk.trim().length
        }
      });
    }
    
    return chunks;
  }
}
