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
  let isStreamClosed = false;
  
  try {
    while (!isStreamClosed) {
      let value, done;
      
      try {
        const result = await reader.read();
        value = result.value;
        done = result.done;
      } catch (readError) {
        // Handle stream reading errors gracefully
        console.warn('Stream read error:', readError);
        if (readError instanceof Error && readError.name === 'AbortError') {
          console.log('Stream was aborted');
        } else {
          onError(readError instanceof Error ? readError : new Error('Stream read error'));
        }
        break;
      }
      
      if (done) {
        isStreamClosed = true;
        break;
      }
      
      if (!value) continue;
      
      try {
        const chunk = decoder.decode(value, { stream: true });
        
        // Process SSE chunks
        const lines = chunk.trim().split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            // Skip empty lines
            if (!line.trim()) continue;
            
            const payload: SSEPayload = JSON.parse(line);
            
            switch (payload.type) {
              case 'token':
                currentContent += payload.content as string;
                onToken(currentContent);
                break;
                
              case 'sources':
                onSources(payload.content as Source[]);
                break;
                
              case 'materials':
                onMaterials(payload.content as Material[]);
                break;
                
              case 'suggestions':
                onSuggestions(payload.content as string[]);
                break;
                
              case 'error':
                throw new Error(payload.content as string);
                
              default:
                console.warn('Unknown payload type:', payload.type);
            }
          } catch (parseError) {
            console.warn('Error parsing SSE line:', parseError, 'Line:', line);
            // Continue processing other lines even if one fails
          }
        }
      } catch (decodeError) {
        console.error('Error decoding chunk:', decodeError);
        // Continue reading from the stream even if decoding fails
      }
    }
  } catch (err) {
    console.error('Stream processing error:', err);
    if (err instanceof Error) {
      onError(err);
    } else {
      onError(new Error('Unknown streaming error'));
    }
  } finally {
    // Ensure we properly close the reader if we exit the loop abnormally
    try {
      if (!isStreamClosed) {
        await reader.cancel('Stream processing completed or interrupted');
      }
    } catch (cancelError) {
      console.warn('Error canceling stream reader:', cancelError);
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
  // Use a combination of timestamp and random string to ensure uniqueness
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
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
