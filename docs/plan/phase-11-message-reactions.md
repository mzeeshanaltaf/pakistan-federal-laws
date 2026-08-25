# Phase 11 — Message reactions (thumbs up/down, copy, bookmark)

See [00-overview.md](00-overview.md) for context. Depends on [phase-10](phase-10-route-protection.md)'s enforced auth on `POST /api/chat` (reactions need a real, verified `session.user.id` to attach to) and the `message_reactions` table already created in [phase-7](phase-7-auth-core.md)'s `db/schema-app.sql`.

## Why this is the most invasive phase in the set

Today the assistant's `chat_messages` row is inserted inside `streamText`'s `onEnd`, *after* the client-visible stream already exists — so a live-streamed message's `useChat` id (an AI-SDK-generated string) never matches the real `chat_messages.id` bigint that reactions need to reference. This phase changes the streaming write order in `src/app/api/chat/route.ts` to fix that, which is why it's isolated as its own phase rather than folded into the dashboard work that actually reads the reactions.

## The fix: placeholder-insert before streaming, update after

Applied to **both** code paths in `src/app/api/chat/route.ts` (the normal retrieval+LLM path and the stored-summary shortcut):

- Insert an assistant placeholder row (empty `content`, `citations` already known at this point) *before* streaming starts — at the same point `data-citations`/`data-source` are currently written — to get the real bigint id immediately.
- Write it into the stream as a new data part: `writer.write({ type: "data-message-id", data: assistantId })`.
- `onEnd` becomes `UPDATE chat_messages SET content = $1 WHERE id = $2` instead of `INSERT ... RETURNING id`.
- The stored-summary shortcut already inserts before streaming — it just needs the same `data-message-id` write added alongside its existing `data-source` write.
- A failed generation now leaves an orphaned empty-content row instead of no row at all — accepted as harmless DB debris for v1 (the empty-content filter below hides it from the UI); do not build error-recovery for this.

## Client-side changes

| File | Purpose |
|---|---|
| `src/lib/chat-types.ts` | Extend `QanoonUIMessage`'s data-parts generic with `"message-id": number`. |
| `src/components/chat/chat-thread.tsx` | `resolveDbMessageId(message)` helper: reads the `data-message-id` part first (live messages), falls back to `Number(message.id)` (history-restored messages, since `rowToUIMessage` already sets `id: String(row.id)`). `rowToUIMessage` / the history-fetch path must skip `role === 'assistant' && content === ''` rows so an in-flight placeholder never renders as a blank bubble if a second tab/refresh hits `/api/chat/history` mid-stream. Fetch `/api/chat/reactions?sessionId=` alongside the existing history fetch (in `useRestoredSession`) to seed initial reaction icon state. |
| `src/components/chat/message-actions.tsx` | New icon-button row (Copy via `navigator.clipboard.writeText`, ThumbsUp, ThumbsDown, Bookmark — all `lucide-react`), inserted below `MessageContent` in the assistant-message branch only of `chat-thread.tsx` (not on user messages). Rendered only once `resolveDbMessageId()` resolves (effectively immediate given the placeholder-insert approach). Copy needs no auth or API call; the other three call the reactions API. |

## Reactions API

| Route | Purpose |
|---|---|
| `POST /api/messages/[id]/reactions` | Body `{ reactionType: "thumbs_up" \| "thumbs_down" \| "bookmark" }` toggles that reaction for the authenticated user on message `id`. For `thumbs_up`/`thumbs_down`, delete the opposite type first — **mutual exclusivity is application-enforced**, not a DB constraint (the `UNIQUE (message_id, user_id, reaction_type)` constraint can't express "at most one of thumbs_up/thumbs_down" against a row-per-reaction shape). Ownership check before any write: `SELECT cs.user_id FROM chat_messages cm JOIN chat_sessions cs ON cs.id = cm.session_id WHERE cm.id = $1` must equal `session.user.id`, else `403`. |
| `GET /api/chat/reactions?sessionId=` | Returns the authenticated user's reactions across that session's messages (`{ [messageId]: reactionType[] }`), used to hydrate icon state on load. |

## Verification

- Ask a question while signed in; once the reply finishes streaming, reaction icons appear (confirm they do **not** appear mid-stream, before `data-message-id` arrives — should be near-instant, not a visible delay).
- Thumbs up then thumbs down on the same message → only thumbs down remains set (`SELECT reaction_type FROM message_reactions WHERE message_id = $1 AND user_id = $2` returns one row).
- Bookmark a message, refresh the page → bookmark icon still shows filled (reaction state survives a history reload, not just the live session).
- Refresh mid-stream (or open the same session in a second tab) → no blank/empty assistant bubble appears.
- Attempt `POST /api/messages/[id]/reactions` for a message belonging to another user's session → `403`.
- `npm run build` (Turbopack) and `npx next build --webpack` both still succeed (this phase touches the core chat streaming route — verify both build paths per project convention).

**Next:** [phase-12-user-dashboard.md](phase-12-user-dashboard.md)
