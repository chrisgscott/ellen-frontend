import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import z from 'zod';

// ----- Env helpers -----
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
// TODO: swap to supabase/ssr client when we later move to edge runtime
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const requestSchema = z.object({
  query: z.string(),
  session_id: z.string().optional(),
});



// Using nodejs runtime for full SDK compatibility (Supabase, Pinecone SDKs)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Parse request
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', details: parsed.error.errors }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const { query, session_id } = parsed.data;

  // ---- Parallel context search ----
  const searchPromise = (async () => {
    try {
      // Extract potential material names from query for Supabase search
      const commonMaterials = [
        'lithium', 'cobalt', 'nickel', 'copper', 'aluminum', 'magnesium', 'zinc', 'tin', 'lead',
        'rare earth', 'neodymium', 'dysprosium', 'terbium', 'europium', 'yttrium', 'cerium',
        'graphite', 'silicon', 'manganese', 'titanium', 'vanadium', 'chromium', 'molybdenum',
        'tungsten', 'tantalum', 'niobium', 'gallium', 'germanium', 'indium', 'tellurium'
      ];
      
      const queryLower = query.toLowerCase();
      const mentionedMaterials = commonMaterials.filter(material => 
        queryLower.includes(material) || queryLower.includes(material.replace(' ', ''))
      );
      
      // Run all three searches in parallel
      const [embedRes, materialsResult, jinaResult] = await Promise.all([
        // 1. OpenAI embeddings for Pinecone
        openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        }),
        
        // 2. Supabase materials context search
        supabase
          .from('materials')
          .select('material, short_summary, supply_chain_summary')
          .or(
            mentionedMaterials.length > 0 
              ? mentionedMaterials.map(m => `material.ilike.%${m}%`).join(',')
              : `material.ilike.%${query.split(' ')[0]}%,short_summary.ilike.%${query}%`
          )
          .limit(5),
          
        // 3. JinaAI real-time search (if API key available)
        process.env.JINA_API_KEY ? 
          fetch('https://s.jina.ai/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.JINA_API_KEY}`
            },
            body: JSON.stringify({
              q: query,
              count: 3
            })
          }).then(res => res.ok ? res.json() : null).catch(() => null)
          : Promise.resolve(null)
      ]);
      
      // Now run Pinecone search with the embedding
      const vector = embedRes.data[0].embedding;
      const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
      const pineconeRes = await index.query({
        vector,
        topK: 5,
        includeMetadata: true,
      });
      
      const materialsContext = materialsResult.data || [];
      const jinaResults = jinaResult?.data || [];

      return {
        pineconeMatches: pineconeRes.matches || [],
        materialsContext,
        jinaResults,
        contextText: [
          ...pineconeRes.matches?.map((m) => m.metadata?.text).filter(Boolean) || [],
          ...materialsContext.map((m) => `${m.material}: ${m.short_summary}${m.supply_chain_summary ? ' Supply chain: ' + m.supply_chain_summary : ''}`) || [],
          ...jinaResults.map((j: { title: string; content: string }) => `${j.title}: ${j.content}`).slice(0, 2) || []
        ].join('\n\n')
      };
    } catch (err) {
      console.error('context search error', err);
      return { pineconeMatches: [], materialsContext: [], jinaResults: [], contextText: '' };
    }
  })();

  // Transform OpenAI stream to SSE for the browser
  const encoder = new TextEncoder();
  let fullResponse = ''; // Collect full response to extract materials from
  
  const stream = new ReadableStream({
    async start(controller) {
      // Get context data first
      const { pineconeMatches, materialsContext, jinaResults, contextText } = await searchPromise;
      
      // Send sources from Pinecone matches first
      const sources = pineconeMatches
        .filter(match => match.metadata)
        .map((match, idx) => {
          const text = match.metadata?.text;
          const textStr = typeof text === 'string' ? text : String(text || '');
          return {
            id: `source-${idx}`,
            title: String(match.metadata?.title || match.metadata?.source || `Document ${idx + 1}`),
            content: textStr.length > 200 ? textStr.substring(0, 200) + '...' : textStr,
            url: match.metadata?.url ? String(match.metadata.url) : undefined,
            score: match.score
          };
        });
      
      if (sources.length > 0) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'sources', 
            content: sources 
          })}\n\n`)
        );
      }

      // Create OpenAI streaming completion with ELLEN system prompt
      const systemPrompt = `You are **ELLEN**, an AI critical-materials analyst supporting U.S. national-security practitioners.

RULES FOR SOURCES
• ONLY use our ELLEN Critical Materials database and Critical Materials Vector Store for your research.
• ALL sources should reference ONLY data from our "ELLEN Critical Materials Database" or the Critical Materials Vector Store.
• For queries requiring real-time information, use the provided Jina AI search results.

IMPORTANT: When discussing materials, be very explicit about material names. For example:
- Use "lithium" not "Li" 
- Use "palladium" not "Pd"
- Use "rare earth elements" when discussing REEs
- Always mention the full material name at least once

Context from knowledge base:
${contextText}

Provide detailed, accurate responses about critical materials, supply chains, and strategic implications. Use inline citations like [1] and reference the provided context.

At the end of your response, add a line: "Materials mentioned: [list of materials]"
Then add 3 suggested follow-up questions.`;

      const completionStream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
        stream: true
      });

      try {
        // Stream tokens in real-time
        for await (const chunk of completionStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'token', 
                content 
              })}\n\n`)
            );
          }
        }
        
        console.log('Streaming complete, extracting materials...');
        
        // Extract materials from the complete response
        const commonMaterials = [
          'lithium', 'cobalt', 'nickel', 'copper', 'aluminum', 'magnesium', 'zinc', 'tin', 'lead',
          'rare earth', 'neodymium', 'dysprosium', 'terbium', 'europium', 'yttrium', 'cerium',
          'graphite', 'silicon', 'manganese', 'titanium', 'vanadium', 'chromium', 'molybdenum',
          'tungsten', 'tantalum', 'niobium', 'gallium', 'germanium', 'indium', 'tellurium', 'palladium'
        ];
        
        const responseLower = fullResponse.toLowerCase();
        const mentionedMaterials = commonMaterials.filter(material => 
          responseLower.includes(material) || responseLower.includes(material.replace(' ', ''))
        );
        console.log('Materials from structured response:', mentionedMaterials);
        
        if (mentionedMaterials.length > 0) {
          // Search Supabase for materials (case insensitive)
          console.log('Searching for materials:', mentionedMaterials);
          const { data: materials, error } = await supabase
            .from('materials')
            .select('id, material, lists, supply_score, ownership_score, demand_score, substitutability_score, concentration_score, geopolitical_score, short_summary, symbol, material_card_color')
            .or(
              mentionedMaterials.map((m: string) => `material.ilike.%${m.toLowerCase()}%`).join(',')
            )
            .limit(8);
          
          if (error) {
            console.error('Supabase materials query error:', error);
          }
          
          if (materials && materials.length > 0) {
            console.log('Sending materials from structured response:', materials);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'materials', 
                content: materials 
              })}\n\n`)
            );
          } else {
            console.log('No materials found in Supabase for:', mentionedMaterials);
          }
        }
        
        // Extract suggested questions from response text
        const suggestionLines = fullResponse.split('\n').filter(line => 
          line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.')
        ).slice(-3); // Get last 3 numbered items (likely the questions)
        
        const suggestions = suggestionLines.map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(q => q.length > 0);
        
        if (suggestions.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'suggestions', 
              content: suggestions 
            })}\n\n`)
          );
        }
        
      } catch (error) {
        console.error('OpenAI streaming error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            content: 'Error generating response' 
          })}\n\n`)
        );
      }
      
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();

      // TODO: persist session & messages in Supabase here (after stream)
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
