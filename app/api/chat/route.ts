import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { extractMaterials } from '../../../lib/materials';
import { Thread, Source } from '@/app/(perplexity-layout)/home/chat/types';

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

          // Start both API calls in parallel
          console.log('🚀 API ROUTE: Starting parallel OpenAI API calls');
          // 1. Text completion with streaming for the answer
          const textCompletionPromise = openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: `You are an AI assistant for Ellen Materials. Respond to user queries about materials science and engineering.
                When referencing materials, be specific about their properties, applications, and characteristics.
                Provide detailed, informative responses about materials science topics.`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: message },
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
          });
          
          // 2. Structured data extraction using function calling (non-streaming)
          const structuredCompletionPromise = openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: `Extract materials, sources, and suggested follow-up questions from this conversation.
                Always use the extract_materials_and_suggestions function to provide structured data.`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: message },
            ],
            tools: [materialExtractorFunction],
            tool_choice: { type: "function" as const, function: { name: "extract_materials_and_suggestions" } },
            temperature: 0.7,
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
              const materialsPayload = JSON.stringify({
                type: 'materials',
                content: materials,
              });
              controller.enqueue(encoder.encode(`${materialsPayload}\n`));
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
              
              const materialsPayload = JSON.stringify({
                type: 'materials',
                content: materials,
              });
              controller.enqueue(encoder.encode(`${materialsPayload}\n`));
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
                  content: 'Generate 3 short, relevant follow-up questions based on the conversation. Return them as a JSON array of strings.',
                },
                { role: 'user' as const, content: `User query: ${message}\nYour response: ${fullResponse}` },
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
