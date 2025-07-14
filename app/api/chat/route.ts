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
  }
  
  // Create new session
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
  suggestions?: string[]
) => {
  const { error } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      related_materials: materials,
      suggested_questions: suggestions
    });
  
  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
};


// ----- Types -----
// ... (existing types)

type Source = {
  title: string;
  url: string;
  text: string;
};



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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, session_id } = RequestSchema.parse(body);

    console.log('Chat request:', { query, session_id });

    // Get or create session and load conversation history
    const sessionId = await getOrCreateSession(session_id);
    const history = await getSessionMessages(sessionId);
    
    // Save user message to database
    await saveMessage(sessionId, 'user', query);
    
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

    // Create streaming response using Responses API with MCP
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

          // Use Responses API with enhanced MCP tools and web search
          const response = await openai.responses.create({
            model: 'gpt-4.1',
            tools: [
              {
                type: 'web_search_preview'
              }
            ],
            input: fullInput,
            stream: true,
            store: true // Enable conversation state storage
          });

          let fullResponse = '';

          // Stream the response
          console.log('=== OpenAI API Response Stream Started ===');
          for await (const chunk of response) {
            console.log('Chunk type:', chunk.type, 'Data:', JSON.stringify(chunk, null, 2));
            
            if (chunk.type === 'response.output_text.delta') {
              const content = chunk.delta || '';
              if (content) {
                fullResponse += content;
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
              
              // Extract materials and suggestions from the full response
              const materials = await extractMaterialsFromResponse(fullResponse);
              const suggestions = extractSuggestionsFromResponse(fullResponse);

              // Save assistant response to database with metadata
              await saveMessage(sessionId, 'assistant', fullResponse, materials, suggestions);
              
              // Stream materials to the frontend
              console.log('=== Streaming Materials ===');
              console.log('Extracted materials:', materials);
              if (materials.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'materials', 
                    content: materials 
                  })}\n\n`)
                );
              }
              
              // Stream suggestions to the frontend
              console.log('=== Streaming Suggestions ===');
              console.log('Extracted suggestions:', suggestions);
              if (suggestions.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'suggestions', 
                    content: suggestions 
                  })}\n\n`)
                );
              }
              
              // Stream sources (Pinecone search results)
              if (pineconeContext.length > 0) {
                const sources: Source[] = pineconeContext.map((doc: PineconeDocument) => ({
                  title: doc.metadata?.title || 'Document',
                  url: doc.metadata?.url || '',
                  text: doc.metadata?.text || doc.text || ''
                }));
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'sources', 
                    content: sources 
                  })}\n\n`)
                );
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
