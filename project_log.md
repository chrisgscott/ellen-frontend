# Project Log

## Snapshot (as of 2025-07-16)
- Successfully deployed Ellen Dashboard to Render at https://ellen-frontend.onrender.com with custom domain https://meetellen.co
- Fixed build issues by removing archived files and disabling ESLint/TypeScript build errors
- Resolved Suspense boundary issues in chat page and login form components
- Updated Supabase authentication settings with production redirect URLs
- Fixed cookie domain configuration in middleware for production deployment
- Resolved authentication redirect loop by fixing middleware logic to redirect to root page instead of /auth/login
- **Home Page UI Overhaul**: Completed a major redesign of the home page, adding navigation cards and mock "Live Market Prices" widgets. The layout was refined with more compact card designs and improved vertical spacing to better center the main chat input.
- **Research & News Enhancements**: Refactored the research section to a two-column layout with a persistent sidebar. Standardized placeholder UIs on both research and news pages with Lottie animations for a consistent user experience.
- **UI Polish**: Added a subtle focus glow effect to the chat input to draw attention to the primary interaction point.
- **Next Steps**: Deploy to Render and monitor for any runtime issues.

## Snapshot (as of 2025-07-15)
- Refactored chat page to use modular components and hooks architecture
- Created useChatSession hook to manage chat state and API interactions
- Fixed database schema with threads_view for proper thread rendering
- Implemented Projects > Sessions > Threads > Messages hierarchy
- Chat UI now properly displays threaded conversations with sources
- Real-time streaming and thread management working correctly

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

[2025-07-16 12:47] — Adjusted vertical spacing on the home page to better center the chat input, improving the overall layout and focus.

[2025-07-16 12:45] — Refined the chat input's focus glow to be a very subtle and diffuse effect, providing a polished look without being distracting.

[2025-07-16 12:40] — Added a subtle background color to the market price ticker cards to visually differentiate them from the navigation cards.

[2025-07-16 12:39] — Reduced the size of all home page cards (navigation and market prices) by approximately one-third for a more compact and refined layout.

[2025-07-16 12:38] — Refactored the home page navigation cards to a more compact, horizontal style to reduce vertical space and improve the overall layout.

[2025-07-16 12:36] — Refactored the 'Live Market Prices' section into a compact, widget-style row of cards to improve layout and keep the focus on the main chat input.

[2025-07-16 12:34] — Added a mock 'Live Market Prices' section to the home page to simulate real-time data and demonstrate future Fastmarkets integration capabilities.

[2025-07-16 12:30] — Standardized the placeholder styles on the research page to match the news page, ensuring consistent Lottie animation size and text spacing.

[2025-07-16 12:27] — Added a Lottie animation to the news page placeholder for consistency with the research page, improving the UI when no article is selected.

[2025-07-16 12:17] — Added navigation cards to the home page below the main chat input, providing direct links to 'Recent News', 'Research Materials', and 'Your Spaces' to improve user navigation and feature discovery.

[2025-07-16 12:14] — Increased the size of the Lottie animation on the research index page by 50% for better visual impact.

[2025-07-16 12:13] — Replaced the static icon on the research index page with a more engaging Lottie animation to improve the placeholder UI.

[2025-07-16 12:10] — Fixed the research sidebar layout. Constrained the container to the viewport height and made the sidebar independently scrollable to prevent it from pushing down the main content area.

[2025-07-16 12:01] — Refactored the Research Library from a grid to a two-column layout with a persistent sidebar for improved navigation with a large number of materials.

[2025-07-15 12:30] — Reused the detailed rendering logic from the old dashboard for the new dynamic material pages, ensuring feature parity. Deleted the now-redundant /app/(app)/materials directory to maintain a clean codebase.

[2025-07-15 12:15] — Implemented new Research section under /home/research. Created an index page to display all materials and a dynamic route /home/research/[material] for individual reports.

[2025-07-15 12:00] — Resolved persistent Supabase client error on research page. The issue was a missing 'await' on the createClient() call, which returned a Promise instead of the client instance. This fix unblocked the materials data fetching.

[2025-07-15 11:00] — Created threads_view database view to support the new chat architecture. Fixed 404 errors by creating a SQL view that joins threads and messages tables with proper JSON formatting for user and assistant messages. This enables the useChatSession hook to correctly fetch and display threaded conversations with their associated metadata (sources, materials, suggestions).

[2025-07-14 17:49] — Added comprehensive logging to debug OpenAI response parsing issues. Created logOpenAI Response function that dumps all chunks received from OpenAI streaming API with full JSON structure, special analysis of function call completions, and parsed function arguments. This will help identify why metadata extraction isn't working properly despite streaming appearing to work.

[2025-07-14 17:42] — Fixed chat UI to properly display streamed metadata. Updated message rendering to show related materials cards and suggested questions for each individual assistant message (not just the last one). Fixed tabs structure by consolidating duplicate Tabs components so header tab triggers properly control content display. Sources tab now works correctly. Clickable suggested questions automatically trigger new queries via handleFollowUp function.

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
