# Document Upload & Chat Session Refactor Plan

## Executive Summary

Based on research into how industry-leading AI tools (Claude, ChatGPT) handle document uploads for RAG, we're proposing a simplified architecture that eliminates the complex session-document association issues we've been experiencing.

## Current Problems

1. **Complex Session Management**: Documents are uploaded before sessions exist, causing timing/synchronization issues
2. **Association Bugs**: Documents get associated with wrong sessions or no session at all
3. **Over-Engineering**: Our current flow is more complex than necessary compared to industry standards
4. **Debugging Complexity**: Multiple moving parts make it difficult to trace document-session relationships

## Industry Standard Approach

### How Claude & ChatGPT Handle This:
- **Upload First, Chat Later**: Users upload documents directly in chat interface
- **No Explicit Session Creation**: Documents are implicitly associated with the chat
- **Background Processing**: Chunking and embedding happen transparently
- **Simple Retrieval**: RAG is applied at query time, not during upload
- **Stateful Context**: Documents are part of the chat's context

## Proposed Solution

### New Architecture Flow:
1. User uploads document(s) in chat interface
2. Documents are stored with `session_id = null` (staged state)
3. User sends first message
4. Session is created on first message
5. All staged documents are automatically associated with the new session
6. RAG retrieval works normally from that point forward

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Update Upload API (`/api/chat/upload-document`)
- **Current**: Requires session_id in request
- **New**: Allow uploads without session_id (nullable)
- **Changes**:
  - Make `session_id` optional in request validation
  - Store documents with `session_id = null` when no session provided
  - Add `staged_at` timestamp for cleanup purposes
  - Return document metadata for frontend display

```typescript
// New request schema
const uploadRequestSchema = z.object({
  sessionId: z.string().uuid().optional(), // Now optional
});

// New database insert
await supabase.from('session_documents').insert({
  id: documentId,
  session_id: sessionId || null, // Allow null
  staged_at: sessionId ? null : new Date().toISOString(),
  // ... other fields
});
```

#### 1.2 Update Chat API (`/api/chat/route.ts`)
- **Current**: Assumes session exists and documents are already associated
- **New**: Create session on first message and associate staged documents
- **Changes**:
  - Check for staged documents (where `session_id IS NULL`) on session creation
  - Associate all staged documents with the new session
  - Clear `staged_at` timestamp when associating
  - Enhanced logging for document association

```typescript
// New session creation logic
const sessionId = await createSession(/* params */);

// Associate any staged documents
const { data: stagedDocs } = await supabase
  .from('session_documents')
  .select('id')
  .is('session_id', null)
  .not('staged_at', 'is', null);

if (stagedDocs?.length > 0) {
  await supabase
    .from('session_documents')
    .update({ 
      session_id: sessionId,
      staged_at: null 
    })
    .is('session_id', null);
}
```

#### 1.3 Update Search Tool (`search_uploaded_documents`)
- **Current**: Only searches by session_id
- **New**: Include staged documents in search when no session exists yet
- **Changes**:
  - If session_id provided, search normally
  - If no session_id, include staged documents in search
  - Prioritize session documents over staged documents

```typescript
// Enhanced search logic
let query = supabase.from('session_documents').select('*');

if (sessionId) {
  query = query.eq('session_id', sessionId);
} else {
  // Include staged documents when no session
  query = query.or(`session_id.eq.${sessionId},session_id.is.null`);
}
```

### Phase 2: Frontend Changes

#### 2.1 Update Chat Input Component (`/components/chat-input.tsx`)
- **Current**: Requires session before allowing uploads
- **New**: Allow uploads immediately, show staged state
- **Changes**:
  - Remove session requirement for uploads
  - Add visual indicator for staged documents
  - Update document list to show staged vs. associated state
  - Handle upload without session_id

```typescript
// New upload logic
const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  // Don't include sessionId if not available
  if (sessionId) {
    formData.append('sessionId', sessionId);
  }
  
  const response = await fetch('/api/chat/upload-document', {
    method: 'POST',
    body: formData,
  });
};
```

#### 2.2 Update Chat Page (`/app/(perplexity-layout)/home/chat/page.tsx`)
- **Current**: Creates session before allowing document interaction
- **New**: Allow document uploads immediately, create session on first message
- **Changes**:
  - Remove session creation from component mount
  - Create session only when user sends first message
  - Update document display to handle staged state
  - Refresh document list after session creation

#### 2.3 Update Home Page (`/app/(perplexity-layout)/home/page.tsx`)
- **Current**: Disables document upload (no session context)
- **New**: Allow document upload, redirect to chat with staged documents
- **Changes**:
  - Enable document upload on home page
  - After upload, redirect to `/chat` with staged documents
  - Show upload progress and success states

### Phase 3: Database Schema Updates

#### 3.1 Add Staging Support
```sql
-- Add staging timestamp column
ALTER TABLE session_documents 
ADD COLUMN staged_at TIMESTAMP WITH TIME ZONE;

-- Add index for staged document queries
CREATE INDEX idx_session_documents_staged 
ON session_documents (staged_at) 
WHERE session_id IS NULL;

-- Add cleanup job for old staged documents (optional)
-- Documents staged > 24 hours ago without session association
```

#### 3.2 Update Existing Data
```sql
-- Set staged_at for existing orphaned documents
UPDATE session_documents 
SET staged_at = uploaded_at 
WHERE session_id IS NULL AND staged_at IS NULL;
```

### Phase 4: Cleanup & Optimization

#### 4.1 Remove Deprecated Code
- Remove session synchronization logic from frontend
- Remove complex session-document association debugging
- Simplify error handling around session creation
- Remove unused API endpoints

#### 4.2 Add Monitoring
- Log document staging and association events
- Monitor staged document cleanup
- Track successful document-to-session associations
- Alert on high numbers of orphaned staged documents

#### 4.3 Performance Optimizations
- Add database indexes for common queries
- Implement staged document cleanup job
- Optimize document retrieval queries
- Cache document metadata for faster UI updates

## Migration Strategy

### Step 1: Backward Compatibility
- Implement new logic alongside existing logic
- Use feature flags to control rollout
- Maintain existing API contracts initially

### Step 2: Gradual Rollout
- Test with staged documents in development
- Deploy backend changes first
- Roll out frontend changes incrementally
- Monitor for any regressions

### Step 3: Full Migration
- Switch all traffic to new flow
- Remove deprecated code paths
- Update documentation and tests
- Clean up old debugging endpoints

## Success Metrics

1. **Reliability**: 99%+ document-session association success rate
2. **User Experience**: Upload-to-chat flow completes in <5 seconds
3. **Debugging**: Reduced support tickets related to missing documents
4. **Code Quality**: 50%+ reduction in session-document association code complexity

## Risk Mitigation

1. **Data Loss**: Implement staged document cleanup with sufficient grace period
2. **Performance**: Monitor database query performance with new indexes
3. **User Confusion**: Clear UI indicators for staged vs. associated documents
4. **Rollback Plan**: Maintain ability to revert to current implementation

## Timeline

- **Week 1**: Backend API changes and testing
- **Week 2**: Frontend component updates
- **Week 3**: Integration testing and bug fixes
- **Week 4**: Production deployment and monitoring

## Conclusion

This refactor aligns Ellen's document upload flow with industry standards, eliminates complex session management issues, and provides a more intuitive user experience. The staged document approach provides flexibility while maintaining data integrity and simplifying the overall architecture.
