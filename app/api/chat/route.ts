import { NextRequest, NextResponse } from 'next/server';
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
    [key: string]: any;
  };
  text?: string;
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

const saveMessage = async (sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata: { timestamp: new Date().toISOString() }
    });
  
  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
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
    return hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score || 0,
      metadata: {
        text: hit.fields?.text || '',
        title: hit.fields?.filename || hit.fields?.title || '',
        documentType: hit.fields?.documentType || hit.fields?.enhanced_doc_type || '',
        detectedMaterials: hit.fields?.detectedMaterials || hit.fields?.detected_materials || [],
        geographic_focus: hit.fields?.geographic_focus || []
      },
      content: hit.fields?.text || ''
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
async function extractMaterialsFromResponse(responseText: string) {
  const commonMaterials = [
    'lithium', 'cobalt', 'nickel', 'copper', 'aluminum', 'magnesium', 'zinc', 'tin', 'lead',
    'rare earth', 'neodymium', 'dysprosium', 'terbium', 'europium', 'yttrium', 'cerium',
    'graphite', 'silicon', 'manganese', 'titanium', 'vanadium', 'chromium', 'molybdenum',
    'tungsten', 'tantalum', 'niobium', 'gallium', 'germanium', 'indium', 'tellurium',
    'palladium', 'platinum', 'rhodium', 'iridium', 'osmium', 'ruthenium'
  ];
  
  const responseTextLower = responseText.toLowerCase();
  const mentionedMaterials = commonMaterials.filter(material => 
    responseTextLower.includes(material) || responseTextLower.includes(material.replace(' ', ''))
  );
  
  if (mentionedMaterials.length === 0) return [];
  
  try {
    const { data: materials } = await supabase
      .from('materials')
      .select('material, short_summary, supply_chain_summary')
      .or(
        mentionedMaterials.map(m => `material.ilike.%${m}%`).join(',')
      )
      .limit(10);
    
    return materials || [];
  } catch (error) {
    console.error('Error fetching materials:', error);
    return [];
  }
}

function extractSuggestionsFromResponse(responseText: string): string[] {
  const lines = responseText.split('\n');
  const suggestions: string[] = [];
  
  let inSuggestionsSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.toLowerCase().includes('follow-up') || 
        trimmed.toLowerCase().includes('questions') ||
        trimmed.toLowerCase().includes('suggestions')) {
      inSuggestionsSection = true;
      continue;
    }
    
    if (inSuggestionsSection) {
      if (trimmed.match(/^\d+\.|^-|^\*/) && trimmed.length > 10) {
        const cleaned = trimmed.replace(/^\d+\.|^-|^\*/, '').trim();
        if (cleaned.endsWith('?')) {
          suggestions.push(cleaned);
        }
      }
      
      if (suggestions.length >= 3) break;
    }
  }
  
  return suggestions.slice(0, 3);
}

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
      content: `You are ELLEN (Enhanced Learning and Logistics Expert Network), a specialized AI assistant focused on critical materials, supply chains, and geopolitical analysis.

Available Tools:
- **Web Search**: Access real-time information, current events, recent developments, and breaking news

Context Sources:
- Critical materials database with supply chain data and geopolitical context
- Vector embeddings of documents, research papers, and reports
- Real-time web information and current events${contextPrompt}

Instructions:
1. Provide comprehensive, analytical responses about critical materials and supply chains
2. Use web search for current events, recent developments, and real-time market information
3. Leverage the provided materials database context for specific material properties and supply chain data
4. Reference research documents and papers from the vector database for technical insights
5. Combine insights from all available sources (database, research, and real-time web) for comprehensive analysis
6. Use specific data, statistics, and examples when available
7. Highlight geopolitical risks and supply chain vulnerabilities
8. Suggest alternatives and mitigation strategies when relevant
9. Be explicit about material names (e.g., "palladium" not "Pd")
10. Include relevant sources and citations when available
11. Always provide 3 relevant follow-up questions at the end

Workflow:
1. Query relevant databases and search for context
2. Analyze the information from multiple sources
3. Provide comprehensive response with citations
4. Extract and highlight mentioned materials
5. Generate contextual follow-up questions`
    };
    
    // Combine system prompt with conversation history
    const fullInput = [systemPrompt, ...input];

    // Create streaming response using Responses API with MCP
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
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
          for await (const chunk of response) {
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
              console.log('Response complete');
              
              // Save assistant response to database
              await saveMessage(sessionId, 'assistant', fullResponse);
              
              // Extract materials from the full response
              const materials = await extractMaterialsFromResponse(fullResponse);
              if (materials.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'materials', 
                    content: materials 
                  })}\n\n`)
                );
              }
              
              // Extract suggestions
              const suggestions = extractSuggestionsFromResponse(fullResponse);
              if (suggestions.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'suggestions', 
                    content: suggestions 
                  })}\n\n`)
                );
              }
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
