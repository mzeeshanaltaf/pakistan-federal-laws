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
  // Sourced from the lifetime counters on "user" and usage_events.user_id
  // directly, not by joining/counting chat_sessions/chat_messages — those
  // rows (and the session_id on usage_events) are hard-deleted/nulled when a
  // user deletes a chat thread, which would otherwise make these platform
  // totals drop right along with it. usage_events.user_id is only populated
  // for end-user chat traffic (see src/lib/usage.ts), so ingest-pipeline
  // rows (embedding/summary/title costs, no end user) are naturally excluded
  // without an extra filter.
  const rows = await query<TotalsRow>(
    `SELECT
       (SELECT count(*) FROM "user")                                     AS total_users,
       (SELECT COALESCE(SUM("lifetimeConversations"),0) FROM "user")     AS total_conversations,
       (SELECT COALESCE(SUM("lifetimeMessages"),0) FROM "user")          AS total_messages,
       (SELECT COALESCE(SUM(total_tokens),0) FROM usage_events WHERE user_id IS NOT NULL) AS total_tokens,
       (SELECT COALESCE(SUM(cost_usd),0) FROM usage_events WHERE user_id IS NOT NULL)     AS total_cost_usd`
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
  role: string | null;
  messageCredits: number;
  conversations: number;
  messages: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface UserStatsRow {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  messageCredits: number;
  conversations: string;
  messages: string;
  total_tokens: string;
  total_cost_usd: string;
}

export async function getPerUserStats(): Promise<UserStats[]> {
  // Same rationale as getPlatformTotals: reads the lifetime counters on
  // "user" and sums usage_events by user_id directly, so a user's totals
  // don't drop when they delete a chat thread (which hard-deletes
  // chat_sessions/chat_messages and nulls usage_events.session_id).
  //
  // "messages" here intentionally counts BOTH roles (user + assistant),
  // unlike the user dashboard's "questions asked" (role='user' only) — per
  // the plan doc's own verification note, this is a deliberate distinction
  // between the two views, not an inconsistency.
  const rows = await query<UserStatsRow>(
    `SELECT
       u.id, u.name, u.email, u.role, u."messageCredits",
       u."lifetimeConversations" AS conversations,
       u."lifetimeMessages"      AS messages,
       COALESCE(usage.total_tokens, 0)   AS total_tokens,
       COALESCE(usage.total_cost_usd, 0) AS total_cost_usd
     FROM "user" u
     LEFT JOIN (
       SELECT user_id,
              SUM(total_tokens) AS total_tokens,
              SUM(cost_usd)     AS total_cost_usd
       FROM usage_events
       WHERE user_id IS NOT NULL
       GROUP BY user_id
     ) usage ON usage.user_id = u.id
     ORDER BY total_cost_usd DESC NULLS LAST`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    messageCredits: Number(row.messageCredits),
    conversations: Number(row.conversations),
    messages: Number(row.messages),
    totalTokens: Number(row.total_tokens),
    totalCostUsd: Number(row.total_cost_usd),
  }));
}
