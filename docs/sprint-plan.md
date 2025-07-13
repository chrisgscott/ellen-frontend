# Sprint Plan – **Chat Migration & Foundations**

## Timeline
_Two-week sprint (10 working days)_

| Phase | Goal | Key Deliverables | Owner | Est. (days) |
|-------|------|------------------|-------|-------------|
| 0. Prep | Repo ready | • `apps/chat-api` folder<br>• `.env.example` with OpenAI, Supabase, Pinecone keys | Dev A | 0.5 |
| 1. Migrate off n8n | Serve streaming JSON via `/api/chat` | 1. Zod types<br>2. Parallel `pinecone.search`, `supabase.select`, `jiraSearch()` helpers<br>3. OpenAI call (`stream=true`)<br>4. SSE streaming<br>5. Front-end `WEBHOOK_URL` switch<br>6. Remove placeholder loading hacks | Dev A | 2 |
| 2. Edge deploy | Lower latency further | • Supabase Edge Function variant<br>• Env toggle `USE_EDGE` | Dev B | 1 |
| 3. Persistence MVP | Resume chats | a. SQL migrations (`sessions`, `messages`)<br>b. Insert on first request; stream writes<br>c. Sidebar listing past sessions | Dev B | 2 |
| 4. Sources tab | Show citations | • Ensure `sources[]` streams; UI already renders | Dev A | 0.5 |
| 5. Memory | Long-context | • Retrieve last N messages<br>• Summarise >50 msgs into `session_summary` | Dev A | 1 |
| 6. Thread schema | Branching ready | • Add `threads` table (`parent_thread_id`)<br>• Adjust FK in `messages` | Dev B | 0.5 |
| 7. Spaces foundation | Thematic grouping | • `spaces`, `space_members` tables<br>• `space_id` FK in `sessions`<br>• RLS policies | Dev B | 1 |
| 8. Vector spike | Pinecone vs pgvector | • Load 50k vectors into pgvector<br>• Benchmark vs Pinecone<br>• Recommendation doc | Dev A | 1 |

### Buffer / Code-review / Retro
**1 day**

---

## Acceptance Criteria
1. `/api/chat` streams first token < **2 s**, full answer < **10 s**.
2. Front-end shows **one** loading placeholder; no duplicate threads.
3. New session auto-appears in sidebar; clicking reloads history.
4. Sources tab displays citations from response.
5. Unit tests cover validation, parallel tool calls, DB inserts.
6. Benchmark document produced with go/no-go on pgvector.

---

## Nice-to-Haves (stretch)
* Redis cache for material look-ups
* Rate-limit middleware
* Edge deploy behind `/chat` path for zero-config switch

---

## Kick-off Checklist
- [ ] Create sprint board with tasks
- [ ] Share env keys (1Password)
- [ ] Schedule demo on Day 10
