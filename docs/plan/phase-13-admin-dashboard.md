# Phase 13 — Admin dashboard

See [00-overview.md](00-overview.md) for context. Last phase in this set — read-only and additive, and most useful once multiple real users exist from testing Phases 8–12. Depends on [phase-10](phase-10-route-protection.md)'s `role === "admin"` guard and `ADMIN_EMAILS` seeding from [phase-7](phase-7-auth-core.md).

## Scope

Platform totals (total users, messages, conversations, tokens, cost) and a per-user breakdown table (messages, conversations, tokens, cost per user), visible only to `role: "admin"` accounts.

## Files

| File | Purpose |
|---|---|
| `src/lib/admin-queries.ts` | Aggregate queries below. |
| `src/app/admin/page.tsx` | Totals + sortable per-user table (auth+role guard already established in Phase 10). |

## Queries

```sql
-- platform totals
SELECT
  (SELECT count(*) FROM "user")                            AS total_users,
  (SELECT count(*) FROM chat_sessions)                      AS total_conversations,
  (SELECT count(*) FROM chat_messages)                      AS total_messages,
  (SELECT COALESCE(SUM(total_tokens),0) FROM usage_events)  AS total_tokens,
  (SELECT COALESCE(SUM(cost_usd),0) FROM usage_events)      AS total_cost_usd;

-- per-user table
SELECT
  u.id, u.name, u.email,
  count(DISTINCT cs.id)                        AS conversations,
  count(cm.id) FILTER (WHERE cm.role = 'user')  AS messages,
  COALESCE(SUM(ue.total_tokens), 0)             AS total_tokens,
  COALESCE(SUM(ue.cost_usd), 0)                 AS total_cost_usd
FROM "user" u
LEFT JOIN chat_sessions cs ON cs.user_id = u.id
LEFT JOIN chat_messages cm ON cm.session_id = cs.id
LEFT JOIN usage_events ue ON ue.session_id = cs.id
GROUP BY u.id, u.name, u.email
ORDER BY total_cost_usd DESC;
```

`usage_daily` (the existing materialized view) stays platform-wide only — it has no user dimension, and per-user cost is computed live via the join above instead. Fine at current data volume; if `usage_events` grows large enough for this join to matter, a per-user rollup view is a future optimization, not needed for v1.

## Verification

- Non-admin signed-in account visiting `/admin` → redirected/404 (per the guard already built in Phase 10).
- `ADMIN_EMAILS`-seeded account sees the dashboard; platform totals match manual `SELECT count(*)`/`SUM(...)` queries against `user`/`chat_sessions`/`chat_messages`/`usage_events`.
- Per-user table row for a specific test account matches that same account's own `/dashboard` numbers from Phase 12 (conversations and tokens should agree between the two views; admin's "messages" counts both roles while the user dashboard's "questions asked" counts only `role='user'` — confirm this distinction is intentional and reflected correctly in both UIs, not an inconsistency).
- Table sorts correctly by cost descending with 2+ real users from earlier phase testing.

## This closes the auth/reactions/dashboards plan (Phases 7–13)

Once this phase and its verification pass, revisit `docs/status.md`'s Environment section and `.env.example` for completeness, and consider whether the intermediate per-phase states (e.g. Phase 8 shipping before Phase 9) need squashing into a single deploy — per the note in Phase 10, don't ship sign-up without the verify/reset flows already live, since users could get stuck unverified.
