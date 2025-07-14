import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSystemPrompt } from './prompt.config';
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

// ----- Database helpers -----
const getOrCreateSession = async (sessionId?: string, userId?: string): Promise<string> => {
  if (sessionId) {
    // Check if session exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();
    
    if (existingSession) {
      return sessionId;
    }
    
    // If session doesn't exist but ID was provided, create with that ID
    const { data: newSessionWithId, error: idError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId, // Use the provided ID
        user_id: userId,
        metadata: { created_by: 'chat_api' }
      })
      .select('id')
      .single();
    
    if (idError) {
      console.error('Error creating session with provided ID:', idError);
      // Fall through to create with auto-generated ID
    } else {
      console.log('Created session with provided ID:', sessionId);
      return newSessionWithId.id;
    }
  }
  
  // Create new session with auto-generated ID (only if no ID provided or error occurred)
  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      metadata: { created_by: 'chat_api' }
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
  
  return newSession.id;
};

const getSessionMessages = async (sessionId: string): Promise<ConversationMessage[]> => {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  
  return messages as ConversationMessage[];
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
    .insert({
      session_id: sessionId,
      role,
      content,
      related_materials: materials,
      suggested_questions: suggestions,
      sources: sources
    });
  
  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
};


// ----- Types -----
// ... (existing types)

// SourceData interface is defined below with the extractSourcesFromResponse function



// ----- Pinecone search function -----
const searchPineconeDocuments = async (query: string): Promise<PineconeDocument[]> => {
  try {
    // Use Pinecone Inference API for indexes with integrated embeddings
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
        fields: ['text', 'filename', 'documentType', 'enhanced_doc_type', 'detectedMaterials', 'detected_materials', 'geographic_focus']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinecone API error details:', errorText);
      throw new Error(`Pinecone API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Transform response to match our PineconeDocument type
    // Handle inference API response format with result.hits
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

// ----- Request/Response schemas -----
const RequestSchema = z.object({
  query: z.string(),
  session_id: z.string().optional(),
  user_id: z.string().optional(), // For development/testing only
});

// ----- Helper functions -----
async function extractMaterialsFromResponse(responseText: string): Promise<MaterialData[]> {
  const materialsSectionMatch = responseText.match(/####(?:\*\*)? Extracted Material Name(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/);
  if (!materialsSectionMatch || !materialsSectionMatch[1]) {
    return [];
  }

  const materialsSection = materialsSectionMatch[1];
  const materialNames: string[] = [];
  const materialRegex = /-\s*\*\*(.*?)\*\*/g;
  let match;
  while ((match = materialRegex.exec(materialsSection)) !== null) {
    materialNames.push(match[1].trim());
  }

  if (materialNames.length === 0) {
    return [];
  }

  console.log('Extracted material names:', materialNames);

  const { data: materials, error } = await supabase
    .from('materials')
    .select('*')
    .in('material', materialNames);

  if (error) {
    console.error('Error fetching materials from DB:', error);
    return [];
  }

  return materials || [];
};

const extractSuggestionsFromResponse = (responseText: string): string[] => {
  const suggestionsSectionMatch = responseText.match(/###(?:\*\*)? Follow-up Questions(?:\*\*)?\s*\n([\s\S]*)/);
  if (!suggestionsSectionMatch || !suggestionsSectionMatch[1]) {
    return [];
  }

  const suggestionsSection = suggestionsSectionMatch[1];
  const suggestions: string[] = [];
  const suggestionRegex = /^\d+\.\s*(.*)$/gm;
  let match;
  while ((match = suggestionRegex.exec(suggestionsSection)) !== null) {
    suggestions.push(match[1].trim());
  }

  return suggestions.slice(0, 3);
};

interface SourceData {
  title: string;
  url: string;
  snippet?: string;
}

const extractSourcesFromResponse = (responseText: string): SourceData[] => {
  const sourcesSectionMatch = responseText.match(/###(?:\*\*)? Sources(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/);
  if (!sourcesSectionMatch || !sourcesSectionMatch[1]) {
    return [];
  }

  const sourcesSection = sourcesSectionMatch[1];
  const sources: SourceData[] = [];
  const sourceRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.*))?/g;
  let match;
  
  while ((match = sourceRegex.exec(sourcesSection)) !== null) {
    sources.push({
      title: match[1].trim(),
      url: match[2].trim(),
      snippet: match[3] ? match[3].trim() : undefined
    });
  }

  console.log('Extracted sources:', sources);
  return sources;
};

// Track recent requests to prevent duplicates
const recentRequests = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 5000; // 5 seconds window for deduplication

// Create a distributed lock table if it doesn't exist
async function ensureLockTableExists() {
  try {
    await supabase.rpc('create_lock_table_if_not_exists', {});
  } catch (error) {
    console.error('Error ensuring lock table exists:', error);
    // Continue anyway, as the table might already exist
  }
}

// Try to acquire a distributed lock
async function acquireLock(lockKey: string, ttlSeconds: number = 30): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('acquire_lock', { 
        p_lock_key: lockKey,
        p_ttl_seconds: ttlSeconds 
      });
    
    if (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Exception acquiring lock:', error);
    return false;
  }
}

// Release a distributed lock
async function releaseLock(lockKey: string): Promise<void> {
  try {
    await supabase.rpc('release_lock', { p_lock_key: lockKey });
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure the lock table exists
    await ensureLockTableExists();
    
    const body = await request.json();
    const { query, session_id } = RequestSchema.parse(body);

    // Extract authenticated user ID from request headers for RLS
    let userId: string | undefined;
    try {
      // Get the authorization header from the request
      const authHeader = request.headers.get('authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // If we have a token, verify it with Supabase
        const token = authHeader.split(' ')[1];
        
        // Add timeout to prevent hanging
        const authPromise = supabase.auth.getUser(token);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );
        
        const result = await Promise.race([authPromise, timeoutPromise]);
        const { data, error } = result as { data: { user: { id: string } } | null; error: any };
        
        if (!error && data?.user) {
          userId = data.user.id;
          console.log('Authenticated user ID:', userId);
        } else {
          console.log('Auth verification failed:', error?.message || 'No user data');
        }
      } else {
        // For development, you might want to extract user ID from the request body
        // This is just for testing and should be removed in production
        userId = body.user_id;
        if (userId) {
          console.log('Using user_id from body:', userId);
        }
      }
    } catch (error) {
      console.error('Error extracting user ID from auth:', error);
      // Continue without user ID if authentication fails
    }
    
    if (!userId) {
      console.log('No authenticated user ID found');
    }

    console.log('Chat request:', { query, session_id, userId });
    
    // Generate a request signature for deduplication
    const requestSignature = `${session_id || ''}:${query}`;
    const lockKey = `chat:${requestSignature}`;
    const now = Date.now();
    
    // First check in-memory cache for very recent duplicates
    const lastRequestTime = recentRequests.get(requestSignature);
    if (lastRequestTime && (now - lastRequestTime) < DEDUPLICATION_WINDOW_MS) {
      console.log('Duplicate request detected in memory cache and skipped:', requestSignature);
      return new Response(
        `data: ${JSON.stringify({ type: 'error', content: 'Duplicate request detected. Please wait for the current request to complete.' })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }
    
    // Try to acquire a distributed lock
    const lockAcquired = await acquireLock(lockKey);
    if (!lockAcquired) {
      console.log('Could not acquire lock, likely duplicate request:', lockKey);
      return new Response(
        `data: ${JSON.stringify({ type: 'error', content: 'Another request with the same query is already in progress. Please wait for it to complete.' })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }
    
    // Record this request to prevent duplicates
    recentRequests.set(requestSignature, now);
    
    // Clean up old entries from the deduplication map
    for (const [key, timestamp] of recentRequests.entries()) {
      if (now - timestamp > DEDUPLICATION_WINDOW_MS) {
        recentRequests.delete(key);
      }
    }

    // Get or create session and load conversation history
    const sessionId = await getOrCreateSession(session_id, userId);
    const history = await getSessionMessages(sessionId);
    
    // Check if the last message is the same as the current query (another deduplication check)
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage && lastMessage.role === 'user' && lastMessage.content === query) {
      console.log('Duplicate message detected in session history, skipping save');
    } else {
      // Save user message to database
      await saveMessage(sessionId, 'user', query);
    }
    
    // Add user message to current history for this request
    const currentHistory = [...history, { role: 'user' as const, content: query }];
    
    // Parallel RAG: Fetch context from multiple sources
    const [supabaseContext, pineconeContext] = await Promise.all([
      // Supabase materials search
      supabase
        .from('materials')
        .select('material, lists, supply_score, ownership_score')
        .textSearch('material', query, { type: 'websearch' })
        .limit(5)
        .then(({ data }) => (data as MaterialData[]) || []),
      
      // Pinecone vector search
      searchPineconeDocuments(query).catch(() => [])
    ]);
    
    // Build enhanced context for AI
    let contextPrompt = '';
    if (supabaseContext.length > 0) {
      contextPrompt += `\n\nRelevant Materials Data:\n${supabaseContext.map((m: MaterialData) => 
        `- ${m.material}: Supply Score ${m.supply_score}/5, Ownership Score ${m.ownership_score}/5, Lists: ${m.lists?.join(', ')}`
      ).join('\n')}`;
    }
    if (pineconeContext.length > 0) {
      contextPrompt += `\n\nRelevant Research Context:\n${pineconeContext.map((doc: PineconeDocument) => 
        `- ${doc.metadata?.title || 'Document'}: ${doc.metadata?.text || doc.text}`
      ).join('\n')}`;
    }
    
    // Prepare input for Responses API (convert history to proper format)
    const input = currentHistory.map((msg: ConversationMessage) => ({
      role: msg.role,
      content: msg.content
    }));

    // System prompt for ELLEN with context
    const systemPrompt = {
      role: 'system' as const,
      content: getSystemPrompt(contextPrompt)
    };
    
    // Combine system prompt with conversation history
    const fullInput = [systemPrompt, ...input];

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Log the full input being sent to OpenAI
          console.log('=== OpenAI API Request ===');
          console.log('Model:', 'gpt-4.1');
          console.log('Session ID:', sessionId);
          console.log('Input length:', fullInput.length);
          console.log('Full input:', fullInput);
          console.log('========================');

          // Define metadata extraction function for the model to call
          const metadataFunction = {
            type: 'function',
            name: 'extract_metadata',
            description: 'Extract metadata from the response including sources, related materials, and suggested questions',
            parameters: {
              type: 'object',
              properties: {
                sources: {
                  type: 'array',
                  description: 'List of sources referenced in the response',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Title of the source' },
                      url: { type: 'string', description: 'URL of the source' },
                      snippet: { type: 'string', description: 'Snippet or description of the source' }
                    },
                    required: ['title', 'url', 'snippet'],
                    additionalProperties: false
                  }
                },
                related_materials: {
                  type: 'array',
                  description: 'List of related materials mentioned in the response',
                  items: { type: 'string', description: 'Name of the material' }
                },
                suggested_questions: {
                  type: 'array',
                  description: 'List of follow-up questions suggested based on the response',
                  items: { type: 'string', description: 'A follow-up question' }
                }
              },
              required: ['sources', 'related_materials', 'suggested_questions'],
              additionalProperties: false
            },
            strict: true
          } as const;

          // Use Responses API with enhanced MCP tools, web search, and metadata extraction
          const response = await openai.responses.create({
            model: 'gpt-4.1',
            tools: [
              {
                type: 'web_search_preview'
              },
              metadataFunction
            ],
            input: fullInput,
            stream: true,
            store: true // Track function call arguments for metadata extraction
          });

          let fullResponse = '';
          let extractedMetadata: {
            sources: SourceData[];
            related_materials: string[];
            suggested_questions: string[];
          } | null = null;
          // Track if we've already streamed metadata to avoid duplicates
          let metadataStreamed = false;

          // Stream the response
          console.log('=== OpenAI API Response Stream Started ===');
          for await (const chunk of response) {
            console.log('\n=== CHUNK DEBUG ===');
            console.log('Chunk type:', chunk.type);
            console.log('Full chunk:', JSON.stringify(chunk, null, 2));
            console.log('==================');
            
            if (chunk.type === 'response.output_text.delta') {
              const content = chunk.delta || '';
              console.log('TEXT DELTA FOUND:', content);
              if (content) {
                fullResponse += content;
                console.log('Streaming text token to frontend:', content);
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'token', 
                    content 
                  })}\n\n`)
                );
              }
            } else if (chunk.type === 'response.output_item.added') {
              // Function call started
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_call_start', 
                  content: chunk.item 
                })}\n\n`)
              );
            } else if (chunk.type === 'response.function_call_arguments.delta') {
              // Function call arguments streaming
              // We're tracking function call progress but don't need to accumulate arguments
              // as we'll get the complete arguments in the response.function_call_arguments.done event
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_call_delta', 
                  content: {
                    item_id: chunk.item_id,
                    delta: chunk.delta
                  }
                })}\n\n`)
              );
            } else if (chunk.type === 'response.function_call_arguments.done') {
              // Function call arguments complete
              console.log('Function call complete:', chunk.item_id, chunk.arguments);
              
              // If this is our metadata extraction function
              if (chunk.item_id && chunk.item_id.includes('extract_metadata')) {
                try {
                  const functionArgs = JSON.parse(chunk.arguments);
                  extractedMetadata = {
                    sources: functionArgs.sources || [],
                    related_materials: functionArgs.related_materials || [],
                    suggested_questions: functionArgs.suggested_questions || []
                  };
                  
                  console.log('Extracted metadata from function call:', extractedMetadata);
                  
                  // Mark that we've streamed metadata to avoid duplicates later
                  metadataStreamed = true;
                  
                  // Immediately stream metadata to frontend
                  if (extractedMetadata.sources && extractedMetadata.sources.length > 0) {
                    console.log('Streaming sources from function call:', extractedMetadata.sources);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ 
                        type: 'sources', 
                        content: extractedMetadata.sources 
                      })}\n\n`)
                    );
                  }
                  
                  if (extractedMetadata.related_materials && extractedMetadata.related_materials.length > 0) {
                    console.log('Processing materials from function call:', extractedMetadata.related_materials);
                    
                    try {
                      // First try to fetch the materials from the database
                      const materialPromises = extractedMetadata.related_materials.map(async (materialName) => {
                        console.log(`Fetching material from database: ${materialName}`);
                        const { data: fetchedMaterials, error } = await supabase
                          .from('materials')
                          .select('*')
                          .ilike('material', materialName);
                        
                        if (error) {
                          console.error(`Error fetching material ${materialName}:`, error);
                        }
                        
                        // If we found materials, use them
                        if (fetchedMaterials && fetchedMaterials.length > 0) {
                          console.log(`Found existing material for ${materialName}:`, fetchedMaterials[0]);
                          return fetchedMaterials[0];
                        } else {
                          // Otherwise, create placeholder material
                          const placeholderMaterial = {
                            id: materialName.toLowerCase().replace(/\s+/g, '-'),
                            material: materialName,
                            created_at: new Date().toISOString()
                          };
                          console.log(`Created placeholder material for ${materialName}:`, placeholderMaterial);
                          return placeholderMaterial;
                        }
                      });
                      
                      // Wait for all material fetching to complete
                      const materials = await Promise.all(materialPromises);
                      
                      console.log('Streaming materials from function call:', materials);
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ 
                          type: 'materials', 
                          content: materials 
                        })}\n\n`)
                      );
                    } catch (error) {
                      console.error('Error processing materials:', error);
                    }
                  }
                  
                  if (extractedMetadata.suggested_questions && extractedMetadata.suggested_questions.length > 0) {
                    console.log('Streaming suggestions from function call:', extractedMetadata.suggested_questions);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ 
                        type: 'suggestions', 
                        content: extractedMetadata.suggested_questions 
                      })}\n\n`)
                    );
                  }
                } catch (error) {
                  console.error('Error parsing function call arguments:', error);
                }
              }
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_call_done', 
                  content: {
                    item_id: chunk.item_id,
                    arguments: chunk.arguments
                  }
                })}\n\n`)
              );
            } else if (chunk.type === 'response.completed') {
              console.log('=== Response Complete ===');
              console.log('Full response length:', fullResponse.length);
              console.log('Full response content:', fullResponse);
              console.log('========================');
              
              // Only process and save metadata if we haven't already streamed it from function call
              if (!metadataStreamed) {
                let materials: MaterialData[] = [];
                let suggestions: string[] = [];
                let sources: SourceData[] = [];
                
                if (extractedMetadata) {
                  // Use the metadata we already extracted from the function call
                  // For materials, we need to fetch the full material data from the database
                  if (extractedMetadata.related_materials.length > 0) {
                    console.log('Processing materials in completion handler:', extractedMetadata.related_materials);
                    
                    // Process each material name
                    const materialPromises = extractedMetadata.related_materials.map(async (materialName) => {
                      console.log(`Fetching material from database: ${materialName}`);
                      const { data: fetchedMaterials, error } = await supabase
                        .from('materials')
                        .select('*')
                        .ilike('material', materialName);
                      
                      if (error) {
                        console.error(`Error fetching material ${materialName}:`, error);
                      }
                      
                      // If we found materials, use them
                      if (fetchedMaterials && fetchedMaterials.length > 0) {
                        console.log(`Found existing material for ${materialName}:`, fetchedMaterials[0]);
                        return fetchedMaterials[0];
                      } else {
                        // Otherwise, create placeholder material
                        const placeholderMaterial = {
                          id: materialName.toLowerCase().replace(/\s+/g, '-'),
                          material: materialName,
                          created_at: new Date().toISOString()
                        };
                        console.log(`Created placeholder material for ${materialName}:`, placeholderMaterial);
                        return placeholderMaterial;
                      }
                    });
                    
                    // Wait for all material fetching to complete
                    materials = await Promise.all(materialPromises);
                    console.log('Materials after processing:', materials);
                  }
                  
                  suggestions = extractedMetadata.suggested_questions;
                  sources = extractedMetadata.sources;
                } else {
                  // Fall back to regex extraction if function calling didn't work
                  materials = await extractMaterialsFromResponse(fullResponse);
                  suggestions = extractSuggestionsFromResponse(fullResponse);
                  sources = extractSourcesFromResponse(fullResponse);
                  
                  // Stream materials to the frontend (only if not already streamed)
                  console.log('=== Streaming Materials ===');
                  console.log('Materials to save:', materials);
                  if (materials.length > 0) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ 
                        type: 'materials', 
                        content: materials 
                      })}\n\n`)
                    );
                  }
                  
                  // Stream suggestions to the frontend (only if not already streamed)
                  console.log('=== Streaming Suggestions ===');
                  console.log('Suggestions to save:', suggestions);
                  if (suggestions.length > 0) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ 
                        type: 'suggestions', 
                        content: suggestions 
                      })}\n\n`)
                    );
                  }
                  
                  // Stream sources (only if not already streamed)
                  let sourcesToStream: SourceData[] = [];
                  
                  if (sources && sources.length > 0) {
                    // Use sources from regex extraction
                    sourcesToStream = sources;
                    console.log('Using sources from regex extraction:', sourcesToStream);
                  } else if (pineconeContext && pineconeContext.length > 0) {
                    // Fall back to Pinecone search results
                    sourcesToStream = pineconeContext.map((doc: PineconeDocument) => ({
                      title: doc.metadata?.title || 'Document',
                      url: doc.metadata?.url || '',
                      snippet: doc.metadata?.text || doc.text || ''
                    }));
                    console.log('Using sources from Pinecone:', sourcesToStream);
                  }
                  
                  if (sourcesToStream.length > 0) {
                    console.log('=== Streaming Sources ===');
                    console.log('Sources to stream:', sourcesToStream);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ 
                        type: 'sources', 
                        content: sourcesToStream 
                      })}\n\n`)
                    );
                  }
                }

                // Save assistant response to database with all metadata
                await saveMessage(sessionId, 'assistant', fullResponse, materials, suggestions, sources);
              }
              
              // The metadata is now saved with the message, so no further action is needed here.
            }
          }
          
        } catch (error) {
          console.error('Responses API error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              content: 'Error generating response with MCP tools' 
            })}\n\n`)
          );
        } finally {
          // Release the distributed lock when done
          await releaseLock(lockKey);
          console.log('Released lock:', lockKey);
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
