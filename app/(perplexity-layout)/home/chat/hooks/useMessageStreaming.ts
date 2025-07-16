import { SSEPayload, Thread, Source, Material } from '../types';

/**
 * Process a streaming response from the server
 * @param reader ReadableStreamDefaultReader from fetch response
 * @param onToken Callback for token updates
 * @param onSources Callback for sources updates
 * @param onMaterials Callback for materials updates
 * @param onSuggestions Callback for suggestions updates
 * @param onError Callback for error handling
 */
export async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (content: string) => void,
  onSources: (sources: Source[]) => void,
  onMaterials: (materials: Material[]) => void,
  onSuggestions: (suggestions: string[]) => void,
  onError: (error: Error) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let currentContent = '';
  let buffer = ''; // Buffer to handle incomplete JSON chunks
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          processLine(buffer.trim());
        }
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      // Process complete lines
      lines.forEach(line => {
        if (line.trim()) {
          processLine(line.trim());
        }
      });
    }
  } catch (err) {
    console.error('❌ Stream processing error:', err);
    if (err instanceof Error) {
      onError(err);
    } else {
      onError(new Error('Unknown streaming error'));
    }
  }
  
  function processLine(line: string) {
    try {
      console.log('🔍 Processing SSE line:', line.substring(0, 100) + (line.length > 100 ? '...' : ''));
      const payload: SSEPayload = JSON.parse(line);
      
      switch (payload.type) {
        case 'token':
          currentContent += payload.content as string;
          onToken(currentContent);
          break;
          
        case 'sources':
          console.log('📚 Received sources:', payload.content);
          onSources(payload.content as Source[]);
          break;
          
        case 'materials':
          console.log('🧪 Received materials:', payload.content);
          onMaterials(payload.content as Material[]);
          break;
          
        case 'suggestions':
          console.log('💡 Received suggestions:', payload.content);
          onSuggestions(payload.content as string[]);
          break;
          
        case 'error':
          throw new Error(payload.content as string);
      }
    } catch (err) {
      console.error('❌ Error parsing SSE line:', {
        error: err,
        line: line.substring(0, 200),
        lineLength: line.length
      });
      // Don't throw error for individual line parsing failures
      // This prevents the entire stream from failing due to one bad line
    }
  }
}

/**
 * Create optimistic thread for immediate UI feedback
 */
export function createOptimisticThread(
  sessionId: string,
  content: string
): Thread {
  const tempId = `temp-${Date.now()}`;
  
  return {
    thread_id: tempId,
    session_id: sessionId,
    user_message_id: `${tempId}-user`,
    user_message: {
      id: `${tempId}-user`,
      session_id: sessionId,
      role: 'user',
      content
    },
    assistant_message: {
      id: `${tempId}-assistant`,
      session_id: sessionId,
      role: 'assistant',
      content: ''
    },
    sources: [],
    related_materials: [],
    suggested_questions: []
  };
}
