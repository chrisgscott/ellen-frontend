import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import z from 'zod';

// ----- Initialize clients -----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ----- Types -----
interface SourceData {
  id: string;
  title: string;
  url: string;
  snippet?: string;
}

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type MaterialData = {
  material: string;
  lists?: string[];
  supply_score?: number;
  ownership_score?: number;
};

type PineconeDocument = {
  id: string;
  score: number;
  metadata?: {
    title?: string;
    text?: string;
    url?: string;
    [key: string]: unknown;
  };
  text?: string;
};

type PineconeHit = {
  _id: string;
  _score: number;
  fields: {
    text?: string;
    filename?: string;
    documentType?: string;
    enhanced_doc_type?: string;
    detectedMaterials?: string[];
    detected_materials?: string[];
    geographic_focus?: string;
    title?: string;
    url?: string;
  };
};

interface ExtractedMetadata {
  sources: SourceData[];
  related_materials: string[];
  suggested_questions: string[];
}

const RequestSchema = z.object({
  query: z.string(),
  session_id: z.string().optional(),
});

// ----- Database helpers -----
const getOrCreateSession = async (sessionId?: string, userId?: string): Promise<string> => {
  if (sessionId) {
    const { data: existingSession, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();
    if (existingSession && !error) return existingSession.id;
  }
  
  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({ id: sessionId, user_id: userId, metadata: { created_by: 'chat_api' } })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
  return newSession.id;
};

const getSessionMessages = async (sessionId: string): Promise<ConversationMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  return data as ConversationMessage[];
};

const saveMessage = async (
  sessionId: string, 
  role: 'user' | 'assistant', 
  content: string, 
  materials?: MaterialData[], 
  suggestions?: string[],
  sources?: SourceData[]
) => {
  const { error } = await supabase
    .from('messages')
    .insert({ session_id: sessionId, role, content, related_materials: materials, suggested_questions: suggestions, sources });
  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
};

// ----- Pinecone search function -----
const searchPineconeDocuments = async (query: string): Promise<PineconeDocument[]> => {
  try {
    const response = await fetch('https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/documents/search', {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Pinecone-API-Version': 'unstable'
      },
      body: JSON.stringify({
        query: {
          inputs: { text: query },
          top_k: 5
        },
        fields: ['text', 'filename', 'documentType', 'enhanced_doc_type', 'detectedMaterials', 'detected_materials', 'geographic_focus', 'title', 'url']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinecone API error details:', errorText);
      throw new Error(`Pinecone API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const hits = data.result?.hits || [];
    return hits.map((hit: PineconeHit) => ({
      id: hit._id,
      score: hit._score || 0,
      metadata: {
        ...hit.fields
      },
      text: hit.fields?.text || ''
    }));
  } catch (error) {
    console.error('Pinecone search error:', error);
    return [];
  }
};

// ----- Regex Extraction Fallbacks -----
const extractSources = (text: string): SourceData[] => {
  const sourcesSectionMatch = text.match(/###(?:\*\*)? Sources(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/);
  if (!sourcesSectionMatch || !sourcesSectionMatch[1]) return [];

  const sourcesSection = sourcesSectionMatch[1];
  const sources: SourceData[] = [];
  const sourceRegex = /\d+\.\s*\[([^\]]+)\]\(([^\)]+)\)(?:\s*-\s*(.*))?/g;
  let match;
  while ((match = sourceRegex.exec(sourcesSection)) !== null) {
    sources.push({
      id: `regex-${Date.now()}-${sources.length}`,
      title: match[1].trim(),
      url: match[2].trim(),
      snippet: match[3] ? match[3].trim() : undefined,
    });
  }
  return sources;
};
const extractRelatedMaterials = (text: string): string[] => {
  const materialsSectionMatch = text.match(/####(?:\*\*)? Extracted Material Name(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/);
  if (!materialsSectionMatch || !materialsSectionMatch[1]) return [];

  const materialsSection = materialsSectionMatch[1];
  const materialNames: string[] = [];
  const materialRegex = /-\s*\*\*(.*?)\*\*/g;
  let match;
  while ((match = materialRegex.exec(materialsSection)) !== null) {
    materialNames.push(match[1].trim());
  }
  return materialNames;
};
const extractSuggestedQuestions = (text: string): string[] => {
  const suggestionsSectionMatch = text.match(/###(?:\*\*)? Follow-up Questions(?:\*\*)?\s*\n([\s\S]*)/);
  if (!suggestionsSectionMatch || !suggestionsSectionMatch[1]) return [];

  const suggestionsSection = suggestionsSectionMatch[1];
  const suggestions: string[] = [];
  const suggestionRegex = /^\d+\.\s*(.*)$/gm;
  let match;
  while ((match = suggestionRegex.exec(suggestionsSection)) !== null) {
    suggestions.push(match[1].trim());
  }
  return suggestions.slice(0, 3);
};

// ----- Distributed Locking -----
const recentRequests = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 5000;

async function acquireLock(lockKey: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('acquire_lock', { p_lock_key: lockKey });
  if (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
  return data === true;
}

async function releaseLock(lockKey: string): Promise<void> {
  await supabase.rpc('release_lock', { p_lock_key: lockKey });
}

// ----- Main POST Handler -----
export async function POST(request: NextRequest) {
  const streamState = {
    fullResponse: '',
    processedMaterials: [] as MaterialData[],
    suggestions: [] as string[],
    sources: [] as SourceData[],
  };

  let sessionId: string | undefined;
  let lockKey: string | undefined;

  try {
    const body = await request.json();
    const { query, session_id } = RequestSchema.parse(body);

    // 1. Deduplication and Locking
    const requestSignature = `${session_id || ''}:${query}`;
    lockKey = `chat:${requestSignature}`;
    const now = Date.now();
    if (recentRequests.has(lockKey) && (now - recentRequests.get(lockKey)!) < DEDUPLICATION_WINDOW_MS) {
      return new Response('Duplicate request', { status: 429 });
    }
    if (!(await acquireLock(lockKey))) {
      return new Response('Request in progress', { status: 409 });
    }
    recentRequests.set(lockKey, now);

    // 2. Session and History Management
    const userId = (await supabase.auth.getUser()).data.user?.id;
    sessionId = await getOrCreateSession(session_id, userId);
    await saveMessage(sessionId, 'user', query);
    const history = await getSessionMessages(sessionId);

    // 3. Context Retrieval
    const pineconeContext = await searchPineconeDocuments(query);
    let contextPrompt = '';
    if (pineconeContext.length > 0) {
      contextPrompt += `\n\nRelevant Document Excerpts:\n${pineconeContext.map((c: PineconeDocument) => c.text || c.metadata?.text).join('\n\n')}`;
    }
    const fullInput: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...history, { role: 'user' as const, content: `${query}${contextPrompt}` }];

    // 4. OpenAI Stream Initialization
    const metadataFunction = {
      type: 'function' as const,
      function: {
        name: 'extract_metadata',
        description: 'Extracts structured metadata from the conversation.',
        parameters: {
          type: 'object',
          properties: {
            sources: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' }, snippet: { type: 'string' } }, required: ['id', 'title', 'url', 'snippet'] } },
            related_materials: { type: 'array', items: { type: 'string' } },
            suggested_questions: { type: 'array', items: { type: 'string' } }
          },
          required: ['sources', 'related_materials', 'suggested_questions']
        }
      }
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: fullInput,
      tools: [metadataFunction],
      stream: true,
    });

    // 5. Stream Processing
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let toolCallArguments = '';

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            streamState.fullResponse += content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
          }

          const deltaToolCall = chunk.choices[0]?.delta?.tool_calls?.[0]?.function;
          if (deltaToolCall?.arguments) {
            toolCallArguments += deltaToolCall.arguments;
          }

          if (chunk.choices[0]?.finish_reason === 'tool_calls' || chunk.choices[0]?.finish_reason === 'stop') {
            let extractedMetadata: ExtractedMetadata | null = null;
            if (toolCallArguments) {
              try {
                extractedMetadata = JSON.parse(toolCallArguments);
              } catch { /* Ignore parsing errors for partial JSON */ }
            }

            if (!extractedMetadata) {
              extractedMetadata = {
                sources: extractSources(streamState.fullResponse),
                related_materials: extractRelatedMaterials(streamState.fullResponse),
                suggested_questions: extractSuggestedQuestions(streamState.fullResponse),
              };
            }

            streamState.sources = (extractedMetadata.sources || []).map((s, i) => ({ ...s, id: s.id || `s-${now}-${i}` }));
            streamState.suggestions = extractedMetadata.suggested_questions || [];
            
            if (extractedMetadata.related_materials?.length > 0) {
              const { data } = await supabase.from('materials').select('*').in('material', extractedMetadata.related_materials);
              streamState.processedMaterials = data || [];
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', ...streamState })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });

  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), { status: 500 });
  } finally {
    if (lockKey) await releaseLock(lockKey);
    if (sessionId && streamState.fullResponse) {
      console.log(`Saving assistant message for session ${sessionId}`);
      await saveMessage(
        sessionId,
        'assistant',
        streamState.fullResponse,
        streamState.processedMaterials,
        streamState.suggestions,
        streamState.sources
      );
    }
  }
}
