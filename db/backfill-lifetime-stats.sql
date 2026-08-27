-- One-time backfill for the lifetime-stats columns added in db/schema-app.sql.
-- Run once after that migration lands, so existing users' dashboard totals
-- reflect their real history instead of starting at zero. Safe to re-run
-- (idempotent: recomputes from current source rows each time).

UPDATE pak_laws."user" u
SET "lifetimeConversations" = COALESCE(c.n, 0)
FROM (
  SELECT user_id, count(*) AS n
  FROM pak_laws.chat_sessions
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) c
WHERE c.user_id = u.id;

UPDATE pak_laws."user" u
SET "lifetimeQuestionsAsked" = COALESCE(m.n, 0)
FROM (
  SELECT cs.user_id, count(*) AS n
  FROM pak_laws.chat_messages cm
  JOIN pak_laws.chat_sessions cs ON cs.id = cm.session_id
  WHERE cs.user_id IS NOT NULL AND cm.role = 'user'
  GROUP BY cs.user_id
) m
WHERE m.user_id = u.id;

UPDATE pak_laws."user" u
SET "lifetimeMessages" = COALESCE(m.n, 0)
FROM (
  SELECT cs.user_id, count(*) AS n
  FROM pak_laws.chat_messages cm
  JOIN pak_laws.chat_sessions cs ON cs.id = cm.session_id
  WHERE cs.user_id IS NOT NULL
  GROUP BY cs.user_id
) m
WHERE m.user_id = u.id;

UPDATE pak_laws.usage_events ue
SET user_id = cs.user_id
FROM pak_laws.chat_sessions cs
WHERE ue.session_id = cs.id
  AND ue.user_id IS NULL
  AND cs.user_id IS NOT NULL;
