# Phase 10 — Route protection and chat gating

See [00-overview.md](00-overview.md) for context. Depends on Phases [7](phase-7-auth-core.md)–[9](phase-9-forgot-reset-password.md) (a working, fully testable sign-in/up/verify/reset flow) being in place first.

## Why this comes before reactions/dashboards, not after

[Phase 11](phase-11-message-reactions.md) (reactions) and [Phases 12](phase-12-user-dashboard.md)–[13](phase-13-admin-dashboard.md) (dashboards) all assume `POST /api/chat` is actually enforcing authentication and that `chat_sessions.user_id` is reliably populated for new sessions. Building this gate now, rather than retrofitting it after reactions/dashboards exist, avoids a rework pass on those features.

## Confirmed decision this phase implements

`/ask` stays fully public for browsing (scope picker, suggested questions, categories) — but the message input is disabled until sign-in, and submitting (including clicking a suggested question) while signed out must prompt sign-in rather than fail silently or 401 with no explanation.

## Files

| File | Purpose |
|---|---|
| `src/app/api/chat/route.ts` | **The real enforcement point.** Add a session check (`auth.api.getSession({ headers })`) at the top of `POST`; return `401` if absent. The client-side disabled input below is UX only — this is the actual security boundary. |
| `src/app/ask/ask-app.tsx`, `src/components/chat/chat-thread.tsx` | Read `authClient.useSession()`. When signed out: replace the `<Textarea>`+send `<Button>` form with an inline "Sign in to ask a question" prompt linking to `/sign-in`. `ChatThreadHandle.ask()` (used by suggested-question pills) checks session state before calling `submit()` — if signed out, redirect to `/sign-in` instead of silently no-op'ing. |
| `middleware.ts` (project root) | Optimistic cookie-presence check — Better Auth issues a session cookie readable without a DB round trip. Redirect `/dashboard/*` and `/admin/*` to `/sign-in` when the cookie is absent. This is a fast UX-level redirect, not the security boundary (see below). |
| `src/app/dashboard/page.tsx`, `src/app/admin/page.tsx` | Real server-side `auth.api.getSession()` check (redirect to `/sign-in` if null) — these pages don't exist with real content until Phases 12–13, but their auth guard shape is established here so those phases build on an already-correct pattern. `/admin` additionally checks `session.user.role === "admin"`, redirecting or 404'ing otherwise. |

## Rate limiting

The existing `checkRateLimit` (Upstash-backed, `src/lib/rate-limit.ts`) currently only guards `/api/chat` (by IP) and the contact form. Better Auth's own `emailOTP.rateLimit` (Phase 7) only covers OTP *sends*, not raw sign-in/sign-up attempts. Apply `checkRateLimit` to `/api/auth/sign-in/*` and `/api/auth/sign-up/*` as well, so credential-stuffing/spam-account attempts get the same IP throttling chat already has.

## Verification

- Signed out: `/ask` fully browsable (scope picker, suggested questions, `/browse`, `/law/[slug]` all work as before); the chat input is visibly disabled with a sign-in prompt; clicking a suggested question redirects to `/sign-in` instead of doing nothing.
- Signed out: `curl -X POST /api/chat` (no session cookie) → `401`.
- Signed in: chat works exactly as before this phase (this is a gate, not a behavior change to the RAG pipeline itself); `chat_sessions.user_id` is populated for the new session — `SELECT user_id FROM chat_sessions ORDER BY created_at DESC LIMIT 1` matches the signed-in user's id.
- `/dashboard` and `/admin` both redirect an unauthenticated visitor to `/sign-in`; `/admin` also redirects/404s a signed-in non-admin.
- Rapid sign-in attempts against a bad password trip the rate limiter, matching the existing `/api/chat` 429 behavior.

**Next:** [phase-11-message-reactions.md](phase-11-message-reactions.md)
