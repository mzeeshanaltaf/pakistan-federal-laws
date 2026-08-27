import { query } from "@/lib/db";

export interface PlatformTotals {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface TotalsRow {
  total_users: string;
  total_conversations: string;
  total_messages: string;
  total_tokens: string;
  total_cost_usd: string;
}

export async function getPlatformTotals(): Promise<PlatformTotals> {
  // Scoped to signed-in users' own activity — chat_sessions.user_id is
  // nullable for old pre-auth/dev-testing rows (see db/schema-app.sql), and
  // usage_events also carries ingest-time rows (session_id NULL: embedding/
  // summary/title costs from the corpus pipeline, not end-user chat). Both
  // would otherwise inflate these totals with non-user activity.
  const rows = await query<TotalsRow>(
    `SELECT
       (SELECT count(*) FROM "user")                                        AS total_users,
       (SELECT count(*) FROM chat_sessions WHERE user_id IS NOT NULL)        AS total_conversations,
       (SELECT count(*)
          FROM chat_messages cm
          JOIN chat_sessions cs ON cs.id = cm.session_id
         WHERE cs.user_id IS NOT NULL)                                      AS total_messages,
       (SELECT COALESCE(SUM(ue.total_tokens),0)
          FROM usage_events ue
          JOIN chat_sessions cs ON cs.id = ue.session_id
         WHERE cs.user_id IS NOT NULL)                                      AS total_tokens,
       (SELECT COALESCE(SUM(ue.cost_usd),0)
          FROM usage_events ue
          JOIN chat_sessions cs ON cs.id = ue.session_id
         WHERE cs.user_id IS NOT NULL)                                      AS total_cost_usd`
  );
  const row = rows[0];
  return {
    totalUsers: Number(row?.total_users ?? 0),
    totalConversations: Number(row?.total_conversations ?? 0),
    totalMessages: Number(row?.total_messages ?? 0),
    totalTokens: Number(row?.total_tokens ?? 0),
    totalCostUsd: Number(row?.total_cost_usd ?? 0),
  };
}

export interface UserStats {
  id: string;
  name: string | null;
  email: string;
  conversations: number;
  messages: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface UserStatsRow {
  id: string;
  name: string | null;
  email: string;
  conversations: string;
  messages: string;
  total_tokens: string;
  total_cost_usd: string;
}

export async function getPerUserStats(): Promise<UserStats[]> {
  // Pre-aggregate chat_messages/usage_events per session *before* joining to
  // "user" — same fix as getDashboardStats in dashboard-queries.ts (Phase
  // 12). The plan doc's literal SQL LEFT JOINs chat_sessions -> chat_messages
  // -> usage_events directly in one SELECT, which cross-products every
  // message row against every usage-event row for a session, inflating both
  // "messages" and the token/cost sums by a multiplicative factor.
  //
  // "messages" here intentionally counts BOTH roles (user + assistant),
  // unlike the user dashboard's "questions asked" (role='user' only) — per
  // the plan doc's own verification note, this is a deliberate distinction
  // between the two views, not an inconsistency, so no role filter is
  // applied here.
  const rows = await query<UserStatsRow>(
    `SELECT
       u.id, u.name, u.email,
       COALESCE(convo.conversations, 0)  AS conversations,
       COALESCE(msg.messages, 0)         AS messages,
       COALESCE(usage.total_tokens, 0)   AS total_tokens,
       COALESCE(usage.total_cost_usd, 0) AS total_cost_usd
     FROM "user" u
     LEFT JOIN (
       SELECT user_id, count(*) AS conversations
       FROM chat_sessions
       WHERE user_id IS NOT NULL
       GROUP BY user_id
     ) convo ON convo.user_id = u.id
     LEFT JOIN (
       SELECT cs.user_id, count(cm.id) AS messages
       FROM chat_sessions cs
       JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id IS NOT NULL
       GROUP BY cs.user_id
     ) msg ON msg.user_id = u.id
     LEFT JOIN (
       SELECT cs.user_id,
              SUM(ue.total_tokens) AS total_tokens,
              SUM(ue.cost_usd)     AS total_cost_usd
       FROM chat_sessions cs
       JOIN usage_events ue ON ue.session_id = cs.id
       WHERE cs.user_id IS NOT NULL
       GROUP BY cs.user_id
     ) usage ON usage.user_id = u.id
     ORDER BY total_cost_usd DESC NULLS LAST`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    conversations: Number(row.conversations),
    messages: Number(row.messages),
    totalTokens: Number(row.total_tokens),
    totalCostUsd: Number(row.total_cost_usd),
  }));
}
