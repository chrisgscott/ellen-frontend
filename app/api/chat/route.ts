import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { extractMaterials } from '../../../lib/materials';
import { Thread, Source, Material } from '@/app/(perplexity-layout)/home/chat/types';

// Pinecone types
type PineconeDocument = {
  id: string;
  score: number;
  metadata: {
    text?: string;
    filename?: string;
    documentType?: string;
    enhanced_doc_type?: string;
    detectedMaterials?: string[];
    detected_materials?: string[];
    geographic_focus?: string;
    title?: string;
    url?: string;
    material_name?: string;
    properties?: string;
    applications?: string;
    namespace?: string;
  };
  text: string;
};

type PineconeHit = {
  _id: string;
  _score?: number;
  fields: Record<string, unknown>;
};

type PineconeNamespace = 'documents' | 'materials';

// Define the function schema for structured outputs
const materialExtractorFunction = {
  type: 'function' as const,
  function: {
    name: 'extract_materials_and_suggestions',
    description: 'Extract materials mentioned in the response and suggest follow-up questions',
    parameters: {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          description: 'Array of material names mentioned in the response',
          items: {
            type: 'string',
          },
        },
        sources: {
          type: 'array',
          description: 'Array of sources referenced in the response',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['title'],
          },
        },
        suggested_questions: {
          type: 'array',
          description: 'Array of suggested follow-up questions',
          items: {
            type: 'string',
          },
        },
      },
      required: ['materials', 'suggested_questions'],
    },
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multi-namespace Pinecone search function
const searchPineconeNamespace = async (query: string, namespace: PineconeNamespace): Promise<PineconeDocument[]> => {
  try {
    const response = await fetch(`https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/${namespace}/search`, {
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
          top_k: 3 // Reduced per namespace to balance total results
        },
        fields: ['text', 'filename', 'documentType', 'enhanced_doc_type', 'detectedMaterials', 'detected_materials', 'geographic_focus', 'title', 'url', 'material_name', 'properties', 'applications']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Pinecone API error for ${namespace} namespace:`, errorText);
      return [];
    }

    const data = await response.json();
    const hits = data.result?.hits || [];
    return hits.map((hit: PineconeHit) => ({
      id: hit._id,
      score: hit._score || 0,
      metadata: {
        ...hit.fields,
        namespace // Add namespace info for context
      },
      text: hit.fields?.text || ''
    }));
  } catch (error) {
    console.error(`Pinecone search error for ${namespace} namespace:`, error);
    return [];
  }
};

// Search Supabase materials database for relevant materials
const searchSupabaseMaterials = async (query: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<Material[]> => {
  try {
    console.log('🗄️ RAG: Searching Supabase materials database');
    
    // Extract meaningful search terms, filtering out stop words
    const stopWords = new Set([
      'what', 'are', 'the', 'how', 'why', 'when', 'where', 'which', 'who',
      'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
      'and', 'but', 'for', 'nor', 'yet', 'so', 'or', 'as', 'if', 'than',
      'this', 'that', 'these', 'those', 'with', 'from', 'into', 'onto', 'upon',
      'most', 'more', 'some', 'any', 'all', 'each', 'every', 'many', 'much',
      'current', 'efforts', 'countries', 'materials'
    ]);
    
    const searchTerms = query.toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // Remove special characters
      .split(/\s+/)
      .filter(term => 
        term.length > 2 && // Only terms longer than 2 chars
        !stopWords.has(term) && // Filter out stop words
        !/^\d+$/.test(term) // Filter out pure numbers
      )
      .slice(0, 5); // Limit to first 5 meaningful terms
    
    // If no meaningful search terms found, try to find material names in the original query
    if (searchTerms.length === 0) {
      console.log('🗄️ RAG: No meaningful search terms, trying material name search');
      
      // Try to find any material names mentioned in the query
      const { data: allMaterials, error: allMaterialsError } = await supabase
        .from('materials')
        .select('material')
        .limit(100);
      
      if (!allMaterialsError && allMaterials) {
        const queryLower = query.toLowerCase();
        const mentionedMaterials = allMaterials.filter(m => 
          queryLower.includes(m.material.toLowerCase())
        );
        
        if (mentionedMaterials.length > 0) {
          // Get full data for mentioned materials
          const materialNames = mentionedMaterials.map(m => m.material);
          const { data: materials, error } = await supabase
            .from('materials')
            .select('*')
            .in('material', materialNames)
            .limit(5);
          
          if (!error && materials) {
            console.log('🗄️ RAG: Found materials by name matching:', {
              count: materials.length,
              materials: materials.map(m => m.material)
            });
            return materials;
          }
        }
      }
      
      return [];
    }
    
    // Search materials using individual queries per term (more reliable than complex OR)
    const allResults = new Map<string, Material>(); // Use Map to deduplicate by material ID
    
    // Search for each term individually
    for (const term of searchTerms) {
      const { data: termResults, error: termError } = await supabase
        .from('materials')
        .select('*')
        .or(`material.ilike.%${term}%,short_summary.ilike.%${term}%,summary.ilike.%${term}%`)
        .limit(10); // Get more per term, then dedupe
      
      if (!termError && termResults) {
        termResults.forEach((material: Material) => {
          allResults.set(material.id, material);
        });
      }
    }
    
    const materials = Array.from(allResults.values()).slice(0, 5);
    const error = null; // We handle errors per term above

    if (error) {
      console.error('🗄️ RAG: Supabase materials search error:', error);
      // Fallback: try a simpler search with just the first term
      if (searchTerms.length > 0) {
        const { data: fallbackMaterials, error: fallbackError } = await supabase
          .from('materials')
          .select('*')
          .ilike('material', `%${searchTerms[0]}%`)
          .limit(3);
        
        if (!fallbackError && fallbackMaterials) {
          console.log('🗄️ RAG: Using fallback search results');
          return fallbackMaterials;
        }
      }
      return [];
    }

    console.log('🗄️ RAG: Found Supabase materials:', {
      count: materials?.length || 0,
      searchTerms,
      materials: materials?.map((m: Material) => m.material) || []
    });

    return materials || [];
  } catch (error) {
    console.error('🗄️ RAG: Supabase materials search error:', error);
    return [];
  }
};

// Search multiple Pinecone namespaces and combine results
const searchMultipleNamespaces = async (query: string): Promise<PineconeDocument[]> => {
  try {
    console.log('🔍 RAG: Searching Pinecone namespaces:', ['documents', 'materials']);
    
    // Search both namespaces in parallel
    const [documentsResults, materialsResults] = await Promise.all([
      searchPineconeNamespace(query, 'documents'),
      searchPineconeNamespace(query, 'materials')
    ]);

    // Combine and sort by relevance score
    const allResults = [...documentsResults, ...materialsResults]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 6); // Top 6 results total

    console.log('🔍 RAG: Retrieved context:', {
      documentsCount: documentsResults.length,
      materialsCount: materialsResults.length,
      totalResults: allResults.length,
      topScores: allResults.slice(0, 3).map(r => r.score)
    });

    return allResults;
  } catch (error) {
    console.error('🔍 RAG: Multi-namespace search error:', error);
    return [];
  }
};

export const runtime = 'edge';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { session_id, message } = await req.json();
    
    console.log('🚀 API ROUTE: POST /api/chat called with:', {
      session_id,
      message: message?.substring(0, 100) + (message?.length > 100 ? '...' : ''),
      messageLength: message?.length
    });
    
    // Initialize Supabase client for each request
    const supabase = await createClient();

    if (!session_id || !message) {
      console.error('🚀 API ROUTE: Missing required fields:', { session_id: !!session_id, message: !!message });
      throw new Error('Missing required fields: session_id and message');
    }
    
    console.log('🚀 API ROUTE: Validation passed, proceeding with chat logic');
    
    // Validate session exists
    console.log('🚀 API ROUTE: Validating session exists:', session_id);
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, title')
      .eq('id', session_id)
      .single();
      
    if (sessionError || !sessionData) {
      console.error('🚀 API ROUTE: Session not found:', sessionError?.message);
      throw new Error(`Session not found: ${sessionError?.message}`);
    }
    
    console.log('🚀 API ROUTE: Session validated:', {
      id: sessionData.id,
      title: sessionData.title
    });

    // Create user message
    console.log('🚀 API ROUTE: Creating user message in database');
    const { data: userMessageData, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        session_id,
        role: 'user',
        content: message,
      })
      .select('*')
      .single();

    if (userMsgError) {
      console.error('🚀 API ROUTE: Failed to create user message:', userMsgError?.message);
      throw new Error(`Failed to create user message: ${userMsgError?.message}`);
    }

    console.log('🚀 API ROUTE: User message created:', {
      id: userMessageData.id,
      content: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      role: 'user'
    });

    // Create thread with user message
    const { data: threadData, error: threadError } = await supabase
      .from('threads')
      .insert({
        session_id,
        user_message_id: userMessageData.id,
      })
      .select('id')
      .single();

    if (threadError) {
      console.error('🚀 API ROUTE: Failed to create thread:', threadError?.message);
      throw new Error(`Failed to create thread: ${threadError?.message}`);
    }

    const thread_id = threadData.id;

    // Create a stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get chat history for context
          const { data: historyData, error: historyError } = await supabase
            .from('threads_view')
            .select('*')
            .eq('session_id', session_id)
            .order('created_at', { ascending: true });

          if (historyError) {
            throw new Error(`Failed to fetch chat history: ${historyError.message}`);
          }

          // Format history for OpenAI
          const history = historyData.flatMap((thread: Thread & { user_message_content?: string; assistant_message_content?: string }) => {
            const messages = [];
            if (thread.user_message_content) {
              messages.push({
                role: 'user',
                content: thread.user_message_content,
              });
            }
            if (thread.assistant_message_content) {
              messages.push({
                role: 'assistant',
                content: thread.assistant_message_content,
              });
            }
            return messages;
          });

          // Create assistant message in database first
          console.log('🚀 API ROUTE: Creating assistant message placeholder');
          const { data: assistantMessageData, error: assistantMsgError } = await supabase
            .from('messages')
            .insert({
              session_id,
              role: 'assistant',
              content: '',
            })
            .select('id')
            .single();

          if (assistantMsgError) {
            console.error('🚀 API ROUTE: Failed to create assistant message:', assistantMsgError?.message);
            throw new Error(`Failed to create assistant message: ${assistantMsgError?.message}`);
          }

          const assistantMessageId = assistantMessageData.id;
          console.log('🚀 API ROUTE: Assistant message created:', assistantMessageId);

          // Update thread with assistant message ID
          const { error: updateThreadError } = await supabase
            .from('threads')
            .update({ assistant_message_id: assistantMessageId })
            .eq('id', thread_id);
            
          if (updateThreadError) {
            console.error('🚀 API ROUTE: Error updating thread with assistant message ID:', updateThreadError);
          }

          // RAG: Search both Pinecone and Supabase for relevant context
          console.log('🔍 RAG: Starting hybrid context retrieval for query:', message.substring(0, 100));
          
          // Search Pinecone and Supabase in parallel
          const [pineconeContext, supabaseMaterials] = await Promise.all([
            searchMultipleNamespaces(message),
            searchSupabaseMaterials(message, supabase)
          ]);
          
          // Build context prompt from retrieved documents and materials
          let contextPrompt = '';
          
          if (pineconeContext.length > 0 || supabaseMaterials.length > 0) {
            contextPrompt += '\n\n--- RELEVANT CONTEXT ---';
            
            // Pinecone document sources
            const documentsContext = pineconeContext.filter(doc => doc.metadata.namespace === 'documents');
            if (documentsContext.length > 0) {
              contextPrompt += '\n\nDocument Sources:';
              documentsContext.forEach((doc, idx) => {
                contextPrompt += `\n[DOC-${idx + 1}] ${doc.metadata.title || doc.metadata.filename || 'Document'}:\n${doc.text}`;
              });
            }
            
            // Pinecone materials context
            const pineconeMatContext = pineconeContext.filter(doc => doc.metadata.namespace === 'materials');
            if (pineconeMatContext.length > 0) {
              contextPrompt += '\n\nMaterials Vector Database:';
              pineconeMatContext.forEach((doc, idx) => {
                contextPrompt += `\n[VEC-${idx + 1}] ${doc.metadata.material_name || 'Material'}:\n${doc.text}`;
              });
            }
            
            // Supabase structured materials data
            if (supabaseMaterials.length > 0) {
              contextPrompt += '\n\nMaterials Database (Structured):';
              supabaseMaterials.forEach((material, idx) => {
                contextPrompt += `\n[DB-${idx + 1}] ${material.material}:`;
                if (material.short_summary) {
                  contextPrompt += `\nShort Summary: ${material.short_summary}`;
                }
                if (material.summary) {
                  contextPrompt += `\nSummary: ${material.summary}`;
                }
                if (material.symbol) {
                  contextPrompt += `\nSymbol: ${material.symbol}`;
                }
              });
            }
            
            contextPrompt += '\n--- END CONTEXT ---\n';
          }

          // Start both API calls in parallel
          console.log('🚀 API ROUTE: Starting parallel OpenAI API calls with RAG context');
          // 1. Text completion with streaming for the answer (now with RAG context)
          const textCompletionPromise = openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: `You are an AI assistant for Ellen Materials with access to a comprehensive materials science database.
                
                INSTRUCTIONS:
                - Use the provided context from documents and materials database to answer questions accurately
                - When referencing materials, cite specific properties, applications, and characteristics from the context
                - If context is provided, prioritize information from the context over general knowledge
                - Be specific about material properties, applications, and engineering characteristics
                - If asked about materials not in the context, clearly state the limitation
                
                CONTEXT SOURCES:
                - [DOC-X]: Research documents, reports, and technical literature
                - [VEC-X]: Materials vector database entries with properties and applications
                - [DB-X]: Structured materials database with specifications and summaries`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: `${message}${contextPrompt}` },
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
          });
          
          // 2. Structured data extraction using function calling (non-streaming) - now with RAG context
          const structuredCompletionPromise = openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content: `Extract materials mentioned in the response and suggest follow-up questions.
                Focus on identifying specific materials, alloys, composites, or chemical compounds discussed.
                Use the provided context to identify relevant materials and generate contextual follow-up questions.`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: `${message}${contextPrompt}` },
            ],
            tools: [materialExtractorFunction],
            tool_choice: { type: 'function', function: { name: 'extract_materials_and_suggestions' } },
            temperature: 0.3,
            max_tokens: 1000,
          });
          
          // Process the text completion stream while the structured data is being generated
          console.log('🚀 API ROUTE: Processing text completion stream');
          const textCompletion = await textCompletionPromise;
          let fullResponse = '';
          let tokenCount = 0;
          for await (const chunk of textCompletion) {
            if (chunk.choices[0]?.delta?.content) {
              const content = chunk.choices[0].delta.content;
              fullResponse += content;
              tokenCount++;
              
              // Stream token to client (skip logging individual tokens to avoid spam)
              const tokenPayload = JSON.stringify({
                type: 'token',
                content,
              });
              controller.enqueue(encoder.encode(`${tokenPayload}\n`));
            }
          }
          
          console.log('🚀 API ROUTE: Text streaming complete:', {
            responseLength: fullResponse.length,
            tokenCount
          });
          
          // Update the assistant message with the full response
          console.log('🚀 API ROUTE: Updating assistant message with full response');
          await supabase
            .from('messages')
            .update({ content: fullResponse })
            .eq('id', assistantMessageId);
          
          // Get the structured completion result (which should be ready by now or soon)
          console.log('🚀 API ROUTE: Waiting for structured completion');
          const structuredCompletion = await structuredCompletionPromise;

          // Process the structured completion to extract data
          let functionCallBuffer = '';
          let extractedData: { materials: string[], sources: Source[], suggested_questions: string[] } | null = null;
          
          // Get the function call data from the non-streaming response
          if (structuredCompletion.choices[0]?.message?.tool_calls?.[0]?.function) {
            const toolCall = structuredCompletion.choices[0].message.tool_calls[0];
            functionCallBuffer = toolCall.function.arguments || '';
            
            try {
              extractedData = JSON.parse(functionCallBuffer);
              console.log('🚀 API ROUTE: Successfully parsed function call data:', extractedData);
            } catch (err) {
              console.error('🚀 API ROUTE: Error parsing function call data:', err);
            }
          }

          // Process materials from function call data
          console.log('🚀 API ROUTE: Processing materials extraction');
          if (extractedData && extractedData.materials && extractedData.materials.length > 0) {
            console.log('🚀 API ROUTE: Using structured output material names:', extractedData.materials);
            const materials = await extractMaterials(fullResponse, extractedData.materials);
            
            if (materials.length > 0) {
              console.log('🚀 API ROUTE: Found materials, updating thread:', materials.length);
              // Update thread with materials
              await supabase
                .from('threads')
                .update({ related_materials: materials })
                .eq('id', thread_id);
              
              // Send materials to client
              try {
                console.log('🧪 API ROUTE: Sending materials to client:', materials.length, 'materials');
                const materialsPayload = JSON.stringify({
                  type: 'materials',
                  content: materials,
                });
                console.log('🧪 API ROUTE: Materials payload length:', materialsPayload.length);
                controller.enqueue(encoder.encode(`${materialsPayload}\n`));
              } catch (jsonError) {
                console.error('❌ API ROUTE: Error serializing materials:', jsonError);
                // Send error instead of crashing
                const errorPayload = JSON.stringify({
                  type: 'error',
                  content: 'Failed to serialize materials data'
                });
                controller.enqueue(encoder.encode(`${errorPayload}\n`));
              }
            }
          } else {
            console.log('🚀 API ROUTE: No structured materials, using fallback text extraction');
            // Fallback to text-based material extraction
            const materials = await extractMaterials(fullResponse);
            if (materials.length > 0) {
              console.log('🚀 API ROUTE: Fallback materials found:', materials.length);
              await supabase
                .from('threads')
                .update({ related_materials: materials })
                .eq('id', thread_id);
              
              try {
                console.log('🧪 API ROUTE: Sending fallback materials to client:', materials.length, 'materials');
                const materialsPayload = JSON.stringify({
                  type: 'materials',
                  content: materials,
                });
                console.log('🧪 API ROUTE: Fallback materials payload length:', materialsPayload.length);
                controller.enqueue(encoder.encode(`${materialsPayload}\n`));
              } catch (jsonError) {
                console.error('❌ API ROUTE: Error serializing fallback materials:', jsonError);
                // Send error instead of crashing
                const errorPayload = JSON.stringify({
                  type: 'error',
                  content: 'Failed to serialize materials data'
                });
                controller.enqueue(encoder.encode(`${errorPayload}\n`));
              }
            } else {
              console.log('🚀 API ROUTE: No materials found in fallback extraction');
            }
          }

          // Process sources from function call data
          if (extractedData && extractedData.sources && extractedData.sources.length > 0) {
            try {
              // Update thread with sources
              await supabase
                .from('threads')
                .update({ sources: extractedData.sources })
                .eq('id', thread_id);

              // Send sources to client
              const sourcesPayload = JSON.stringify({
                type: 'sources',
                content: extractedData.sources,
              });
              controller.enqueue(encoder.encode(`${sourcesPayload}\n`));
            } catch (err) {
              console.error('🚀 API ROUTE: Error processing sources:', err);
            }
          }

          // Process suggested questions from function call data
          if (extractedData && extractedData.suggested_questions && extractedData.suggested_questions.length > 0) {
            // Update thread with suggestions
            await supabase
              .from('threads')
              .update({ suggested_questions: extractedData.suggested_questions })
              .eq('id', thread_id);

            // Send suggestions to client
            const suggestionsPayload = JSON.stringify({
              type: 'suggestions',
              content: extractedData.suggested_questions,
            });
            controller.enqueue(encoder.encode(`${suggestionsPayload}\n`));
          } else {
            // Fallback: Generate suggested follow-up questions if not provided in function call
            const suggestionsResponse = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                {
                  role: 'system' as const,
                  content: 'Generate 3 short, relevant follow-up questions based on the conversation and available context. Focus on materials science topics. Return them as a JSON array of strings.',
                },
                { role: 'user' as const, content: `User query: ${message}\nContext available: ${pineconeContext.length > 0 ? 'Yes' : 'No'}\nYour response: ${fullResponse}` },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.7,
            });

            let suggestions: string[] = [];
            try {
              const suggestionsContent = suggestionsResponse.choices[0]?.message?.content || '{"questions":[]}';
              const parsedSuggestions = JSON.parse(suggestionsContent);
              suggestions = parsedSuggestions.questions || [];
            } catch (err) {
              console.error('🚀 API ROUTE: Error parsing suggestions:', err);
              suggestions = [];
            }

            if (suggestions.length > 0) {
              // Update thread with suggestions
              await supabase
                .from('threads')
                .update({ suggested_questions: suggestions })
                .eq('id', thread_id);

              // Send suggestions to client
              const suggestionsPayload = JSON.stringify({
                type: 'suggestions',
                content: suggestions,
              });
              controller.enqueue(encoder.encode(`${suggestionsPayload}\n`));
            }
          }

          // Close the stream
          console.log('🚀 API ROUTE: Request completed, closing stream');
          controller.close();
        } catch (error) {
          console.error('🚀 API ROUTE: Chat API error:', error);
          const errorPayload = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.enqueue(encoder.encode(`${errorPayload}\n`));
          controller.close();
        }
      },
    });

    // Return the stream response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
