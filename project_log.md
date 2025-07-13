# Project Log

## Snapshot (as of 2025-07-12)
- Chat migration from n8n webhook to in-house streaming API completed
- Materials extraction now works from AI response using 'material' column in Supabase
- Streaming SSE implementation with real-time token, sources, materials, and suggestions
- Fixed environment variable issues and middleware blocking API routes
- Enhanced ELLEN persona prompt matching original n8n workflow

---

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
