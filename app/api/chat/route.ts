import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { extractMaterials } from '../../../lib/materials';
import { Thread } from '@/app/(perplexity-layout)/home/chat/types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { session_id, message } = await req.json();
    
    // Initialize Supabase client for each request
    const supabase = await createClient();

    if (!session_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create user message
    const { data: userMessageData, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        session_id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single();

    if (userMsgError) {
      console.error('Error creating user message:', userMsgError);
      return NextResponse.json(
        { error: 'Failed to create user message' },
        { status: 500 }
      );
    }

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
      console.error('Error creating thread:', threadError);
      return NextResponse.json(
        { error: 'Failed to create thread' },
        { status: 500 }
      );
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

          // Call OpenAI with streaming
          const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [
              {
                role: 'system',
                content: `You are an AI assistant for Ellen Materials. Respond to user queries about materials science and engineering.
                When referencing materials, be specific about their properties, applications, and characteristics.
                If you mention specific materials, they will be highlighted in the UI if they exist in our database.`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user' as const, content: message },
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
          });

          let fullResponse = '';
          let assistantMessageId: string | null = null;

          // Process the streaming response
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;

              // Send token to client
              const payload = JSON.stringify({
                type: 'token',
                content,
              });
              controller.enqueue(encoder.encode(`${payload}\n`));

              // If this is the first chunk, create the assistant message in the database
              if (!assistantMessageId) {
                const { data: assistantData, error: assistantError } = await supabase
                  .from('messages')
                  .insert({
                    session_id,
                    role: 'assistant',
                    content: content, // Initial content
                  })
                  .select('id')
                  .single();

                if (assistantError) {
                  console.error('Error creating assistant message:', assistantError);
                  throw new Error(`Failed to create assistant message: ${assistantError.message}`);
                }

                assistantMessageId = assistantData.id;
                
                // Update thread with assistant message ID
                const { error: updateThreadError } = await supabase
                  .from('threads')
                  .update({ assistant_message_id: assistantMessageId })
                  .eq('id', thread_id);
                  
                if (updateThreadError) {
                  console.error('Error updating thread with assistant message ID:', updateThreadError);
                }
              }
            }
          }

          // Update the assistant message with the full response
          if (assistantMessageId) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({ content: fullResponse })
              .eq('id', assistantMessageId);

            if (updateError) {
              console.error('Error updating assistant message:', updateError);
            }
          }

          // Extract and process materials mentioned in the response
          const materials = await extractMaterials(fullResponse);
          if (materials && materials.length > 0) {
            // Update thread with materials
            const { error: materialsError } = await supabase
              .from('threads')
              .update({ related_materials: materials })
              .eq('id', thread_id);

            if (materialsError) {
              console.error('Error updating thread with materials:', materialsError);
            }

            // Send materials to client
            const materialsPayload = JSON.stringify({
              type: 'materials',
              content: materials,
            });
            controller.enqueue(encoder.encode(`${materialsPayload}\n`));
          }

          // Generate suggested follow-up questions
          const suggestionsResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
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
          } catch (error) {
            console.error('Error parsing suggestions:', error);
            suggestions = [];
          }

          if (suggestions.length > 0) {
            // Update thread with suggestions
            const { error: suggestionsError } = await supabase
              .from('threads')
              .update({ suggested_questions: suggestions })
              .eq('id', thread_id);

            if (suggestionsError) {
              console.error('Error updating thread with suggestions:', suggestionsError);
            }

            // Send suggestions to client
            const suggestionsPayload = JSON.stringify({
              type: 'suggestions',
              content: suggestions,
            });
            controller.enqueue(encoder.encode(`${suggestionsPayload}\n`));
          }

          // Close the stream
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorPayload = JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : String(error),
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
