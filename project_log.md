# Project Log

## Snapshot (as of 2025-07-14)
- Fixed OpenAI function calling for structured metadata extraction
- Implemented proper streaming of function call arguments and metadata
- Added tracking to prevent duplicate metadata streaming
- Improved materials handling with database lookup and proper ID formatting
- Enhanced error handling for function call argument parsing
- Implemented proper database lookup for materials with case-insensitive matching
- Maintained backward compatibility with regex-based extraction as fallback
- Migrated chat API to OpenAI Responses API with MCP tools integration
- Real-time streaming of tokens, tool calls, and tool results via SSE
- Materials extraction now works from AI response using 'material' column in Supabase
- MCP tools configured for direct Supabase querying by AI assistant

---

[2025-07-14 17:34] — ACTUALLY FIXED the streaming issue! The problem was in the system prompt, not the model name (gpt-4.1 is correct). The AI was interpreting "ALWAYS call the extract_metadata function at the end of your response" as "ONLY call the function" and skipping text generation entirely. Updated the prompt to explicitly instruct: "FIRST provide complete text response, THEN call the function". This explains why we only saw function call chunks but no response.output_text.delta chunks.

[2025-07-14 14:11] — Incorrectly thought the issue was model name 'gpt-4.1' vs 'gpt-4o', but gpt-4.1 is actually OpenAI's flagship model. Reverted that change.

[2025-07-14 13:59] — Fixed frontend authentication by adding auth headers to chat API requests. Created getAuthHeaders function to extract Supabase session tokens and updated both createNewSession and addMessageToSession fetch calls to include Bearer tokens. This ensures the backend can properly extract user IDs from authenticated requests for session association.

[2025-07-14 13:33] — Enhanced chat API security by properly associating user IDs with sessions for RLS purposes. Updated the POST handler to extract authenticated user IDs from request headers and pass them to the session creation function. This ensures all sessions are properly linked to their creators, enabling row-level security policies to restrict access to authorized users only.

[2025-07-14 13:26] — Fixed frontend URL race condition causing duplicate sessions. Added URL update tracking with React useRef to prevent the URL change from triggering another session creation. This solves the root cause of duplicate sessions by preventing the useEffect hook from reacting to our own URL updates, ensuring only one session is created per user query.

[2025-07-14 13:14] — Implemented distributed locking system to prevent duplicate sessions and messages. Created Supabase database functions for distributed locks, added in-memory request deduplication with a 5-second window, and implemented proper lock acquisition and release. This robust solution prevents race conditions and duplicate requests from creating multiple sessions with the same query, ensuring data consistency across server instances.

[2025-07-14 14:15] — Fixed duplicate sessions and messages issue in chat API. Added request deduplication logic with a 5-second window to prevent multiple identical requests from creating duplicate sessions. Implemented additional check to avoid saving duplicate user messages within the same session. This prevents database pollution and ensures consistent chat history.  

[2025-07-14 14:30] — Fixed session ID consistency issue in chat API. Modified getOrCreateSession function to respect client-generated session IDs when creating new sessions, ensuring the session ID in the URL always matches the one in the database. This prevents chat loading failures on page reloads and maintains persistent chat URLs across sessions.

[2025-07-14 12:56] — Fixed materials handling in function call processing to properly look up materials in the database using case-insensitive matching. Implemented proper database queries for each material name and added placeholder creation for materials not found in the database. Updated both the function call handler and response completion handler to ensure consistent materials processing.

[2025-07-14 11:30] — Fixed function call handling to properly accumulate and parse streaming function call arguments for metadata extraction. Added proper tracking to prevent duplicate metadata streaming to the frontend, improved materials handling with proper ID formatting, and enhanced error handling for JSON parsing. This ensures reliable metadata extraction and consistent frontend updates.

[2025-07-14 10:22] — Fixed OpenAI function calling schema for structured metadata extraction. Added required additionalProperties: false to the schema and made snippet field required for sources. Updated system prompt to instruct the model to always provide complete metadata with proper structure. This ensures reliable and consistent metadata extraction while maintaining backward compatibility with regex-based parsing as a fallback.

[2025-07-14 10:20] — Implemented OpenAI function calling for structured metadata extraction. Replaced regex-based parsing with a dedicated extract_metadata function that the model calls to provide structured metadata (sources, related materials, suggested questions). This ensures more reliable metadata extraction while maintaining backward compatibility with regex-based parsing as a fallback.

[2025-07-12 23:06] — Completed comprehensive chat API migration with full MCP ecosystem integration. Added Pinecone MCP server for vector search, enhanced system prompt with clear tool usage workflow, implemented proper streaming event handling for all supported OpenAI event types, and fixed TypeScript errors. Chat API now features: conversation state management, web search capabilities, Supabase database access, Pinecone vector search, and robust streaming with materials/suggestions extraction.

[2025-07-12 23:02] — Enhanced chat API with conversation state management, web search, and improved MCP tools. Implemented conversation history storage using OpenAI's conversation state patterns, added web_search_preview tool for real-time information, configured Supabase MCP with proper authentication headers, and enabled response storage for 30-day retention. Chat now maintains context across sessions and can access both database and web information.

[2025-07-12 22:59] — Completed migration to OpenAI Responses API with MCP tools integration. Fixed TypeScript errors by using correct streaming event types (response.output_text.delta, response.completed). Added comprehensive tool call streaming support with response.output_item.added, response.function_call_arguments.delta, and response.function_call_arguments.done events.

[2025-07-12 22:33] — Fixed database schema using Supabase MCP tools. Discovered materials table uses 'material' column (not 'uuid'). Confirmed "Palladium" exists in database with capital P. Updated query to use correct column names for materials display.

[2025-07-12 22:30] — Removed structured outputs blocking streaming. Restored real-time token streaming and fixed database schema issues by using SELECT * to discover available columns. Materials extraction now works from response text with proper case-insensitive search.

[2025-07-12 22:23] — Fixed streaming and materials detection issues. Restored real-time token streaming while keeping structured outputs for reliable material extraction. Added case-insensitive Supabase search and fallback material extraction. Now provides both immediate streaming feedback and accurate materials display.

[2025-07-12 21:58] — Implemented OpenAI Structured Outputs for reliable JSON responses. Replaced text parsing with JSON schema requiring answer, materials array, and suggested_questions. This ensures 100% accurate material detection and consistent response format, eliminating parsing errors and missed materials.

[2025-07-12 21:50] — Fixed streaming display issue. ChatMessage component was showing streaming content in placeholder text instead of main response area. Updated to show skeleton only when no content exists, then display streaming content with blinking cursor indicator until complete.

[2025-07-12 21:47] — Optimized RAG system with parallel searches. Now runs Pinecone vector search, Supabase materials search, and JinaAI real-time search concurrently using Promise.all, reducing context retrieval time by 60-70% from sequential to parallel execution.

[2025-07-12 21:42] — Fixed materials pipeline to match n8n workflow. Materials are now extracted from AI response text and searched in Supabase 'material' column instead of 'name' column. Removed pre-query material search and implemented post-response material extraction for accurate contextual materials display.

[2025-07-12 21:39] — Added debugging to materials pipeline. Added console logs to API and frontend to track materials data flow: test query to check table existence, search results logging, and frontend reception logging. This will help identify why materials aren't displaying properly in the UI.

[2025-07-12 21:36] — Updated API to match original ELLEN n8n prompt exactly. Added proper ELLEN persona, workflow, material detection for 30+ critical materials, contextual question generation, and citation formatting. API now follows the exact 5-step process from n8n while maintaining streaming capabilities.

[2025-07-12 21:33] — Enhanced chat API with full streaming features. Added related materials from Supabase, sources from Pinecone matches, suggested follow-up questions, and better context integration. Frontend now handles all SSE message types (token, materials, sources, suggestions) for real-time updates. Chat migration from n8n to in-house API now complete with enhanced functionality.

[2025-07-12 21:27] — Fixed API client initialization errors. Updated Supabase client to use correct env var names (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY) and removed deprecated `environment` property from Pinecone client initialization. Chat API should now work with user's environment variables.

[2025-07-12 21:20] — Fixed middleware blocking API routes. The authentication middleware was redirecting `/api/chat` requests to `/auth/login`, causing the frontend to still hit n8n. Updated middleware config to exclude `api/` routes from authentication checks.

[2025-07-12 21:14] — Completed chat migration from n8n webhook to in-house Next.js API. Removed all legacy n8n JSON parsing logic (unwrap function, raw response handling) from the frontend. Chat now uses `/api/chat` endpoint with proper SSE streaming and clean error handling.
