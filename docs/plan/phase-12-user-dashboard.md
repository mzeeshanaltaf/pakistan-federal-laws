# Phase 12 — User dashboard

See [00-overview.md](00-overview.md) for context. Depends on [phase-10](phase-10-route-protection.md) (`chat_sessions.user_id` populated by enforced auth) and [phase-11](phase-11-message-reactions.md) (bookmarks to list). Needs real usage from those phases to have meaningful data to show — build after them, not before.

## Scope

Total conversations, total questions asked, total tokens, and a list of bookmarked messages — all scoped to the signed-in user.

## Files

| File | Purpose |
|---|---|
| `src/lib/dashboard-queries.ts` | Query helpers, kept out of the page file for reuse/testability. |
| `src/app/dashboard/page.tsx` | Server component (auth guard already established in Phase 10) — stat tiles + bookmarks list. |

## Queries

```sql
-- totals, scoped to $1 = session.user.id
SELECT
  count(DISTINCT cs.id)                     AS conversations,
  count(*) FILTER (WHERE cm.role = 'user')   AS questions_asked,
  COALESCE(SUM(ue.total_tokens), 0)          AS total_tokens
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cm.session_id = cs.id
LEFT JOIN usage_events ue ON ue.session_id = cs.id
WHERE cs.user_id = $1;

-- bookmarked messages, newest first
SELECT cm.id, cm.content, cm.created_at, cs.id AS session_id, cs.title, cs.scope_type, cs.scope_id
FROM message_reactions mr
JOIN chat_messages cm ON cm.id = mr.message_id
JOIN chat_sessions cs ON cs.id = cm.session_id
WHERE mr.user_id = $1 AND mr.reaction_type = 'bookmark'
ORDER BY mr.created_at DESC;
```

## Bookmark deep-link back into `/ask`

Implement this, not a text-only fallback — it's a small change and bookmarks with no way back to the conversation are much less useful. `AskApp` (`src/app/ask/ask-app.tsx`) already accepts an `initialScope` prop built from search params in `src/app/ask/page.tsx`, and `ChatThread` already remounts via `key={scopeKey}` on scope change — no refactor needed there. Add the session id the same way:

1. `src/app/ask/page.tsx` reads an additional `sessionId` search param.
2. Thread it through `AskApp` → `ChatThread` as an `initialSessionId` prop.
3. `useRestoredSession` (in `chat-thread.tsx`) uses it instead of the localStorage-derived id when present, and fetches `/api/chat/history?sessionId=` for it exactly as it already does for a restored localStorage session.

Bookmark rows link to `/ask?scope=<scope_type>&slug=<scope_id>&sessionId=<session_id>` (mirroring the query-param shape `page.tsx` already parses for `scope`/`slug`/`label`).

## Verification

- Ask several questions across 2+ conversations (different scopes) as a signed-in user; dashboard totals match manual counts from `chat_sessions`/`chat_messages`/`usage_events` for that `user_id`.
- Bookmark a message from Phase 11, confirm it appears in the dashboard list with correct content and timestamp.
- Click a bookmark's deep link → lands on `/ask` with the correct scope selected and that exact conversation's history restored (not a fresh session).
- Dashboard is empty-but-not-broken for a brand-new user with zero conversations.

**Next:** [phase-13-admin-dashboard.md](phase-13-admin-dashboard.md)
