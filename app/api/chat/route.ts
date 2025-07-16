import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { extractMaterials } from '../../../lib/materials';
import { Thread, Source, Material } from '@/app/(perplexity-layout)/home/chat/types';
import { getAllToolSchemas, getToolByName } from '@/lib/tools/registry';

// Request deduplication cache
const requestCache = new Map<string, { timestamp: number; processing: boolean }>();
const CACHE_DURATION = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute

// Cleanup old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

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

// Tool definitions are now managed by the tool registry system
// See /lib/tools/ for individual tool implementations

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to calculate relevance score for web citations
const calculateRelevance = (text: string, queryTerms: string[]): number => {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      score += 1;
    }
  }
  
  // Bonus for exact phrase matches
  const queryPhrase = queryTerms.join(' ');
  if (lowerText.includes(queryPhrase)) {
    score += 2;
  }
  
  return score;
};

// Helper function to classify queries for web search
type QueryClassification = {
  needsWebSearch: boolean;
  searchModel: string | null;
  searchReason: string;
};

const classifyQuery = (query: string): QueryClassification => {
  const queryLower = query.toLowerCase();
  
  // Keywords that indicate need for current/real-time information - check these FIRST
  const currentKeywords = [
    'current', 'latest', 'recent', 'today', 'now', 'this year', '2024', '2025',
    'price', 'cost', 'market', 'trading', 'stock', 'commodity', 'valued', 'worth', 'deal',
    'news', 'announcement', 'breaking', 'update', 'development', 'partnership',
    'investment', 'funding', 'acquisition', 'merger', 'financial', 'revenue', 'earnings', 'quarterly'
  ];
  
  // Check if query contains current/real-time indicators
  const matchedKeywords = currentKeywords.filter(keyword => queryLower.includes(keyword));
  const hasCurrentKeywords = matchedKeywords.length > 0;
  
  // If query asks for current/recent information, use web search even if it's in Ellen's domain
  if (hasCurrentKeywords) {
    // Determine which search model to use based on complexity
    const complexKeywords = ['detailed analysis', 'comprehensive', 'explain why', 'analyze', 'implications', 'impact on', 'compare'];
    const isComplex = complexKeywords.some(keyword => queryLower.includes(keyword));
    
    return {
      needsWebSearch: true,
      searchModel: isComplex ? 'gpt-4o-search-preview' : 'gpt-4o-mini-search-preview',
      searchReason: `Query contains current/recent keywords: [${matchedKeywords.join(', ')}] - ${isComplex ? 'Complex analysis' : 'Simple lookup'} requiring current information`
    };
  }
  
  // Ellen's domain-specific keywords - these should use tools, not web search (only if no current keywords)
  const ellenDomainKeywords = [
    'opportunities', 'portfolio', 'holdings', 'materials', 'risks', 'geopolitical',
    'gallium', 'osmium', 'lithium', 'rare earth', 'copper', 'germanium', 'tungsten',
    'supply chain', 'suppliers', 'customers', 'defense', 'strategic', 'critical',
    'stockpile', 'inventory', 'position', 'exposure', 'vulnerability', 'disruption',
    'sanctions', 'export control', 'china', 'crisis', 'shortage', 'capacity'
  ];
  
  // Check if query is clearly within Ellen's strategic materials domain
  const domainMatches = ellenDomainKeywords.filter(keyword => queryLower.includes(keyword));
  const isEllenDomain = domainMatches.length > 0;
  
  // If it's clearly Ellen's domain (and no current keywords), prioritize tools over web search
  if (isEllenDomain) {
    return {
      needsWebSearch: false,
      searchModel: null,
      searchReason: `Strategic materials query detected: [${domainMatches.join(', ')}] - Using Ellen's specialized tools`
    };
  }
  
  return {
    needsWebSearch: false,
    searchModel: null,
    searchReason: 'Query can be answered with existing knowledge base'
  };
};

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
      .slice(0, 8); // Limit to first 8 meaningful terms
    
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
    
    // First, search for exact material name matches (highest priority)
    for (const term of searchTerms) {
      const { data: exactMatches, error: exactError } = await supabase
        .from('materials')
        .select('*')
        .ilike('material', `%${term}%`)
        .limit(3);
      
      if (!exactError && exactMatches) {
        exactMatches.forEach((material: Material) => {
          allResults.set(material.id, material);
        });
      }
    }
    
    // Then search for broader matches in summaries (if we need more results)
    if (allResults.size < 7) {
      for (const term of searchTerms) {
        const { data: termResults, error: termError } = await supabase
          .from('materials')
          .select('*')
          .or(`short_summary.ilike.%${term}%,summary.ilike.%${term}%`)
          .limit(8); // Get more per term for diversity
        
        if (!termError && termResults) {
          termResults.forEach((material: Material) => {
            allResults.set(material.id, material);
          });
        }
        
        // Stop if we have enough results
        if (allResults.size >= 10) break;
      }
    }
    
    const materials = Array.from(allResults.values()).slice(0, 7);
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
    
    // Request deduplication check
    const requestKey = `${session_id}:${message}`;
    const now = Date.now();
    const existingRequest = requestCache.get(requestKey);
    
    if (existingRequest) {
      if (existingRequest.processing) {
        console.log('🚫 API ROUTE: Duplicate request detected - already processing');
        return new Response('Request already processing', { status: 429 });
      }
      if (now - existingRequest.timestamp < CACHE_DURATION) {
        console.log('🚫 API ROUTE: Duplicate request detected - too recent');
        return new Response('Duplicate request', { status: 429 });
      }
    }
    
    // Mark request as processing
    requestCache.set(requestKey, { timestamp: now, processing: true });
    
    // Initialize Supabase client for each request
    const supabase = await createClient();

    if (!session_id || !message) {
      console.error('🚀 API ROUTE: Missing required fields:', { session_id: !!session_id, message: !!message });
      requestCache.delete(requestKey); // Clean up on error
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
          // Track tools called during this request
          const toolsCalled: Array<{ name: string, success: boolean, timestamp: string }> = [];
          
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

          // Classify query to determine if web search is needed
          const queryClassification = classifyQuery(message);
          console.log('🔍 QUERY CLASSIFICATION:', queryClassification);
          
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
                
                // Core identification
                if (material.symbol) {
                  contextPrompt += `\nSymbol: ${material.symbol}`;
                }
                if (material.short_summary) {
                  contextPrompt += `\nOverview: ${material.short_summary}`;
                }
                
                // Risk scores (critical for supply chain analysis)
                const riskScores = [];
                if (material.supply_score) riskScores.push(`Supply: ${material.supply_score}/5`);
                if (material.ownership_score) riskScores.push(`Ownership: ${material.ownership_score}/5`);
                if (material.processing_score) riskScores.push(`Processing: ${material.processing_score}/5`);
                if (material.chokepoints_score) riskScores.push(`Chokepoints: ${material.chokepoints_score}/5`);
                if (riskScores.length > 0) {
                  contextPrompt += `\nRisk Scores: ${riskScores.join(', ')}`;
                }
                
                // Market structure (better as structured data than semantic)
                if (material.market_concentration_hhi) {
                  contextPrompt += `\nMarket Concentration (HHI): ${material.market_concentration_hhi}`;
                }
                if (material.trading_volume_annual_tonnes) {
                  contextPrompt += `\nAnnual Trading Volume: ${material.trading_volume_annual_tonnes} tonnes`;
                }
                
                // Key industries and customers (structured lists)
                if (material.industries) {
                  contextPrompt += `\nKey Industries:\n${material.industries}`;
                }
                if (material.key_end_customers) {
                  contextPrompt += `\nMajor Customers: ${material.key_end_customers}`;
                }
                
                // Supply chain specifics (geographic and operational)
                if (material.source_locations) {
                  contextPrompt += `\nSource Locations:\n${material.source_locations}`;
                }
                if (material.supply) {
                  contextPrompt += `\nSupply Details:\n${material.supply}`;
                }
                if (material.ownership) {
                  contextPrompt += `\nOwnership Structure:\n${material.ownership}`;
                }
                if (material.processing) {
                  contextPrompt += `\nProcessing Details:\n${material.processing}`;
                }
                
                // Market outlook (structured forecasts)
                if (material.demand_outlook) {
                  contextPrompt += `\nDemand Outlook:\n${material.demand_outlook}`;
                }
                if (material.price_trends) {
                  contextPrompt += `\nPrice Trends:\n${material.price_trends}`;
                }
              });
            }
            
            contextPrompt += '\n--- END CONTEXT ---\n';
          }

          // Start both API calls in parallel
          console.log('🚀 API ROUTE: Starting parallel OpenAI API calls with RAG context');
          
          // Prepare base messages
          const baseMessages = [
            {
              role: 'system' as const,
              content: queryClassification.needsWebSearch 
                ? `You are an AI assistant for Ellen Materials with access to both a comprehensive materials science database and real-time web search.
                
                CRITICAL: Answer the user's specific question directly. Do not provide generic information or go off-topic.
                
                IMPORTANT: If web search results are not relevant to the user's question, IGNORE them completely and focus on the provided context and your knowledge.
                
                INSTRUCTIONS:
                - FIRST: Read the user's question carefully and focus your entire response on answering that specific question
                - SECOND: Evaluate if web search results are actually relevant to the question - if not, ignore them
                - Use both the provided context from documents/materials database AND relevant web information to answer questions accurately
                - When referencing materials, cite specific properties, applications, and characteristics from both sources
                - Prioritize current/real-time information for prices, market conditions, and recent developments
                - Use historical context from the database for technical specifications and established knowledge
                - Be specific about material properties, applications, and engineering characteristics
                - Clearly distinguish between historical context and current information
                - If you cannot find specific information to answer the user's question, say so explicitly
                - DO NOT discuss topics that are unrelated to the user's question, even if they appear in web search results
                
                CONTEXT SOURCES:
                - [DOC-X]: Research documents, reports, and technical literature
                - [VEC-X]: Materials vector database entries with properties and applications
                - [DB-X]: Structured materials database with specifications and summaries
                - [WEB]: Current web search results with real-time information`
                : `You are an AI assistant for Ellen Materials with access to a comprehensive materials science database.
                
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
            { role: 'user' as const, content: queryClassification.needsWebSearch ? message : `${message}${contextPrompt}` },
          ];
          
          // Debug: Log the final user message content
          const finalUserMessage = queryClassification.needsWebSearch ? message : `${message}${contextPrompt}`;
          console.log('🔍 DEBUG: Final user message being sent to OpenAI:', {
            originalMessage: message,
            webSearchMode: queryClassification.needsWebSearch,
            contextLength: queryClassification.needsWebSearch ? 0 : contextPrompt.length,
            finalContent: finalUserMessage.substring(0, 200) + (finalUserMessage.length > 200 ? '...' : '')
          });
          
          // 1. Text completion with streaming for the answer (with optional web search)
          const textCompletionConfig = {
            model: queryClassification.needsWebSearch ? queryClassification.searchModel! : 'gpt-4.1',
            messages: baseMessages,
            stream: true as const,
            // Only add temperature and max_tokens for non-search models
            ...(queryClassification.needsWebSearch ? {} : {
              temperature: 0.7,
              max_tokens: 2000,
            }),
            ...(queryClassification.needsWebSearch && {
              web_search_options: {
                search_context_size: 'medium' as const,
                user_location: {
                  type: 'approximate' as const,
                  approximate: {
                    country: 'US',
                    timezone: 'America/Denver'
                  }
                }
              }
            })
          };
          
          if (queryClassification.needsWebSearch) {
            console.log('🌐 WEB SEARCH: Using', queryClassification.searchModel, 'with web search');
          }
          
          const textCompletionPromise = openai.chat.completions.create(textCompletionConfig);
          
          // 2. Structured data extraction using function calling (non-streaming) - now with RAG context
          const structuredCompletionPromise = openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content: `You are Ellen, an expert AI assistant specializing in strategic materials intelligence. Use your available tools to provide comprehensive analysis.
                
                TOOL USAGE GUIDELINES:
                - For queries about "opportunities", "investments", "deals", or "worth $X million/billion": Call get_high_impact_opportunities
                - For portfolio analysis, holdings summary, positions, or "what do we own": Call get_portfolio_summary
                - For geopolitical risk analysis, supply chain disruptions, or crisis scenarios: Call monitor_geopolitical_risks  
                - Always call extract_materials_and_suggestions to identify materials, sources, and generate follow-up questions
                
                MATERIALS: Focus on identifying specific materials, alloys, composites, or chemical compounds discussed.
                
                SOURCES: Extract sources from the context that were referenced in the response. Create meaningful source titles:
                - For [DOC-X] references: Use the document title/filename if available, or create descriptive titles like "Technical Report on [Topic]" or "Research Study: [Subject]"
                - For [VEC-X] references: Use format "Materials Database - [Material Name] Properties" 
                - For [DB-X] references: Use format "Ellen Materials Database - [Material Name]"
                - For [WEB] references: Use the actual website titles and URLs from web search results
                - Always provide descriptive, user-friendly titles rather than generic references
                - If multiple sources cover the same topic, consolidate them appropriately
                
                QUESTIONS: Generate contextual follow-up questions based on the provided context.`,
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: queryClassification.needsWebSearch ? message : `${message}${contextPrompt}` },
            ],
            tools: getAllToolSchemas(),
            tool_choice: 'auto',
            temperature: 0.3,
            max_tokens: 1000,
          });
          
          let fullResponse = '';
          let tokenCount = 0;
          const webCitations: Array<{ type: string; url?: string; title?: string }> = [];
          
          if (queryClassification.needsWebSearch) {
            // TWO-STAGE PROCESSING FOR WEB SEARCH QUERIES
            
            // STAGE 1: Web Search
            const searchIndicator = JSON.stringify({
              type: 'search_indicator',
              content: '🔍 Searching for up-to-date sources...'
            });
            controller.enqueue(encoder.encode(`${searchIndicator}\n`));
            
            console.log('🌐 STAGE 1: Getting web search results');
            const textCompletion = await textCompletionPromise;
            let webSearchResponse = '';
            
            // Collect web search response without streaming to client
            for await (const chunk of textCompletion) {
              if (chunk.choices[0]?.delta?.content) {
                webSearchResponse += chunk.choices[0].delta.content;
              }
              
              // Capture web search citations
              const chunkWithAnnotations = chunk as { choices: Array<{ delta?: { annotations?: Array<{ type: string; url_citation?: { title?: string; url?: string } }> } }> };
              if (chunkWithAnnotations.choices[0]?.delta?.annotations) {
                const annotations = chunkWithAnnotations.choices[0].delta.annotations;
                console.log('🌐 WEB SEARCH: Raw annotations:', JSON.stringify(annotations, null, 2));
                webCitations.push(...annotations);
              }
            }
            
            console.log('🌐 STAGE 1 COMPLETE: Web search response length:', webSearchResponse.length);
            
            // STAGE 2: Synthesis with RAG Context
            const synthesisIndicator = JSON.stringify({
              type: 'search_indicator',
              content: '📚 Analyzing with knowledge base...'
            });
            controller.enqueue(encoder.encode(`${synthesisIndicator}\n`));
            
            console.log('📚 STAGE 2: Synthesizing with RAG context');
            
            // Create synthesis prompt combining web results with RAG context
            const synthesisMessages = [
              {
                role: 'system' as const,
                content: `You are Ellen, an expert AI assistant specializing in materials science, supply chains, and critical materials analysis.
                
                You have access to both REAL-TIME WEB SEARCH RESULTS and a COMPREHENSIVE MATERIALS KNOWLEDGE BASE.
                
                INSTRUCTIONS:
                - Synthesize information from both web search results and knowledge base to provide comprehensive answers
                - Integrate web sources naturally into your analysis (don't use standalone "[WEB]" headings)
                - Use web sources for current prices, recent developments, market conditions, and breaking news
                - Use knowledge base for technical specifications, historical context, risk assessments, and detailed material properties
                - When citing sources, use inline references like "according to recent reports" or "based on our materials database"
                - Provide analysis that leverages both real-time and curated information seamlessly
                - Focus on the user's specific question and provide actionable insights
                - Create a cohesive narrative that flows naturally between current events and technical context
                
                SOURCE ATTRIBUTION GUIDELINES:
                - Web sources: Integrate naturally ("Recent reports indicate...", "Current market data shows...")
                - Knowledge base: Reference as "our materials database", "technical specifications", "supply chain analysis"
                - Use [DOC-X]/[VEC-X]/[DB-X] tags only when specifically referencing detailed technical data
                - Avoid standalone section headers like "[WEB]" - instead weave sources into the narrative`
              },
              ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              {
                role: 'user' as const,
                content: `${message}

--- WEB SEARCH RESULTS ---
${webSearchResponse}
--- END WEB RESULTS ---

${contextPrompt}`
              }
            ];
            
            // Stage 2: Synthesis completion
            const synthesisCompletion = await openai.chat.completions.create({
              model: 'gpt-4.1',
              messages: synthesisMessages,
              stream: true,
              temperature: 0.7,
              max_tokens: 2000,
            });
            
            // Stream the synthesis response
            for await (const chunk of synthesisCompletion) {
              if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                fullResponse += content;
                tokenCount++;
                
                // Stream token to client
                const tokenPayload = JSON.stringify({
                  type: 'token',
                  content,
                });
                controller.enqueue(encoder.encode(`${tokenPayload}\n`));
              }
            }
            
          } else {
            // SINGLE-STAGE PROCESSING FOR NON-WEB SEARCH QUERIES
            console.log('🚀 API ROUTE: Processing standard completion stream');
            const textCompletion = await textCompletionPromise;
            
            for await (const chunk of textCompletion) {
              if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                fullResponse += content;
                tokenCount++;
                
                // Stream token to client
                const tokenPayload = JSON.stringify({
                  type: 'token',
                  content,
                });
                controller.enqueue(encoder.encode(`${tokenPayload}\n`));
              }
            }
          }
          
          // Log web citations if any were found
          if (webCitations.length > 0) {
            console.log('🌐 WEB SEARCH: Found citations:', webCitations.length);
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
            const toolName = toolCall.function.name;
            functionCallBuffer = toolCall.function.arguments || '';
            
            console.log('🔧 TOOL CALL: Executing tool:', toolName, 'with args:', functionCallBuffer ? JSON.parse(functionCallBuffer) : {});
            const toolStartTime = new Date().toISOString();
            
            // Handle tools using the registry system
            const tool = getToolByName(toolName);
            if (tool) {
              try {
                const args = functionCallBuffer ? JSON.parse(functionCallBuffer) : {};
                const toolContext = {
                  supabase,
                  controller,
                  encoder,
                  session_id,
                  thread_id,
                  message,
                };
                
                const result = await tool.handler(args, toolContext);
                
                if (result.success) {
                  console.log('✅ TOOL SUCCESS:', toolName, 'completed successfully');
                  toolsCalled.push({ name: toolName, success: true, timestamp: toolStartTime });
                  
                  // Stream data to client if requested
                  if (result.streamToClient && result.clientPayload) {
                    const payload = JSON.stringify(result.clientPayload);
                    controller.enqueue(encoder.encode(`${payload}\n`));
                  }
                  
                  // Handle special case for material extraction
                  if (toolName === 'extract_materials_and_suggestions' && result.data) {
                    extractedData = result.data as { materials: string[], sources: Source[], suggested_questions: string[] };
                  }
                } else {
                  console.error('❌ TOOL FAILED:', toolName, 'error:', result.error);
                  toolsCalled.push({ name: toolName, success: false, timestamp: toolStartTime });
                }
              } catch (error) {
                console.error('💥 TOOL ERROR:', toolName, 'threw exception:', error);
                toolsCalled.push({ name: toolName, success: false, timestamp: toolStartTime });
              }
            } else {
              console.warn('⚠️ UNKNOWN TOOL:', toolName, 'not found in registry');
              toolsCalled.push({ name: toolName, success: false, timestamp: new Date().toISOString() });
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
            console.log('🚀 API ROUTE: No structured materials, using fallback extraction');
            // First try to use RAG-found materials, then fall back to text extraction
            let materials: Material[] = [];
            
            if (supabaseMaterials.length > 0) {
              console.log('🚀 API ROUTE: Using RAG-found materials:', supabaseMaterials.length);
              materials = supabaseMaterials;
            } else {
              console.log('🚀 API ROUTE: No RAG materials, falling back to text extraction');
              materials = await extractMaterials(fullResponse);
            }
            
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

          // Process sources from function call data and web citations
          let allSources = extractedData?.sources || [];
          
          // Add web citations as sources if any were found
          if (webCitations.length > 0) {
            // Extract key terms from the original query for relevance filtering
            const queryTerms = message.toLowerCase().split(/\W+/).filter((term: string) => term.length > 2);
            console.log('🔍 WEB SEARCH: Query terms for relevance filtering:', queryTerms);
            
            type WebCitation = {
              type: string;
              url_citation?: { title?: string; url?: string };
              metadata?: { title?: string; url?: string };
              title?: string;
              url?: string;
            };
            
            const webSources = webCitations.map((citation: WebCitation) => {
              // Handle OpenAI's url_citation format
              let title = 'Web Search Result';
              let url = '';
              
              if (citation.type === 'url_citation' && citation.url_citation) {
                // OpenAI's actual format: url_citation object
                title = citation.url_citation.title || 'Web Search Result';
                url = citation.url_citation.url || '';
              } else if (citation.type === 'web_search') {
                // Alternative web search format
                title = citation.metadata?.title || citation.title || 'Web Search Result';
                url = citation.metadata?.url || citation.url || '';
              } else if (citation.url) {
                // Direct URL format
                title = citation.title || citation.metadata?.title || 'Web Search Result';
                url = citation.url;
              } else if (citation.metadata) {
                // Metadata format
                title = citation.metadata.title || 'Web Search Result';
                url = citation.metadata.url || '';
              }
              
              // Clean up title and extract domain if needed
              if (title === 'Web Search Result' && url) {
                try {
                  const domain = new URL(url).hostname.replace('www.', '');
                  title = `${domain} - Web Search Result`;
                } catch {
                  // Keep default title if URL parsing fails
                }
              }
              
              const relevanceScore = calculateRelevance(title + ' ' + url, queryTerms);
              return {
                title,
                url,
                type: 'web' as const,
                relevanceScore
              };
            }).filter(source => {
              // Filter out obviously irrelevant results
              const isRelevant = source.relevanceScore > 0;
              if (!isRelevant) {
                console.log('🚫 WEB SEARCH: Filtered out irrelevant citation:', source.title);
              }
              return isRelevant;
            }).map(source => ({ title: source.title, url: source.url, type: source.type })); // Remove relevanceScore from final object
            
            allSources = [...allSources, ...webSources];
            console.log('🌐 WEB SEARCH: Added', webSources.length, 'web citations to sources');
            console.log('🌐 WEB SEARCH: Processed sources:', webSources);
          }
          
          if (allSources.length > 0) {
            try {
              // Update thread with all sources (RAG + web)
              await supabase
                .from('threads')
                .update({ sources: allSources })
                .eq('id', thread_id);

              // Send sources to client
              const sourcesPayload = JSON.stringify({
                type: 'sources',
                content: allSources,
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
          // Log summary of all tools called
          if (toolsCalled.length > 0) {
            console.log('🔧 TOOLS SUMMARY:', {
              totalCalled: toolsCalled.length,
              successful: toolsCalled.filter(t => t.success).length,
              failed: toolsCalled.filter(t => !t.success).length,
              tools: toolsCalled.map(t => `${t.name}(${t.success ? '✅' : '❌'})`).join(', ')
            });
          } else {
            console.log('🔧 TOOLS SUMMARY: No tools called during this request');
          }
          
          console.log('🚀 API ROUTE: Request completed, closing stream');
          // Mark request as completed (no longer processing)
          requestCache.set(requestKey, { timestamp: now, processing: false });
          controller.close();
        } catch (error) {
          console.error('🚀 API ROUTE: Chat API error:', error);
          // Clean up request cache on error
          requestCache.delete(requestKey);
          const errorPayload = JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : String(error)
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
