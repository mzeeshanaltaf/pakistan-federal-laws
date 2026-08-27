import { query } from "@/lib/db";
import type { Citation } from "@/lib/rag-prompt";

export interface AdminUserDetail {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string | null;
  messageCredits: number;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface UserDetailRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string | null;
  messageCredits: number;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const rows = await query<UserDetailRow>(
    `SELECT id, name, email, image, role, "messageCredits", banned, "banReason", "banExpires", "emailVerified", "createdAt"
     FROM "user" WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    messageCredits: Number(row.messageCredits),
    banned: row.banned ?? false,
    banReason: row.banReason,
    banExpires: row.banExpires,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
  };
}

export interface UserDetailStats {
  conversations: number;
  messages: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface UserDetailStatsRow {
  conversations: string;
  messages: string;
  total_tokens: string;
  total_cost_usd: string;
}

export async function getUserDetailStats(userId: string): Promise<UserDetailStats> {
  // Reads the lifetime counters on "user" and sums usage_events by user_id
  // directly — same rationale as getPlatformTotals/getPerUserStats
  // (admin-queries.ts): counting/joining chat_sessions or chat_messages
  // directly would make these totals drop as soon as the user deletes a
  // chat thread (hard-deleted rows, nulled usage_events.session_id).
  // "messages" counts both roles, matching the admin table's convention.
  const rows = await query<UserDetailStatsRow>(
    `SELECT
       u."lifetimeConversations" AS conversations,
       u."lifetimeMessages"      AS messages,
       COALESCE((SELECT SUM(total_tokens) FROM usage_events WHERE user_id = u.id), 0) AS total_tokens,
       COALESCE((SELECT SUM(cost_usd) FROM usage_events WHERE user_id = u.id), 0)     AS total_cost_usd
     FROM "user" u
     WHERE u.id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    conversations: Number(row?.conversations ?? 0),
    messages: Number(row?.messages ?? 0),
    totalTokens: Number(row?.total_tokens ?? 0),
    totalCostUsd: Number(row?.total_cost_usd ?? 0),
  };
}

export interface AdminUserConversation {
  id: string;
  label: string;
  scopeType: "all" | "category" | "document";
  scopeId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUserConversationRow {
  id: string;
  scope_type: string;
  scope_id: string | null;
  title: string | null;
  message_count: string;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  document_title: string | null;
}

export async function getUserConversations(userId: string): Promise<AdminUserConversation[]> {
  // Same label-resolution join as getBookmarkedMessages (dashboard-queries.ts)
  // — chat_sessions.title is essentially never populated by the chat flow.
  const rows = await query<AdminUserConversationRow>(
    `SELECT cs.id, cs.scope_type, cs.scope_id, cs.title, cs.created_at, cs.updated_at,
            COALESCE(msg.message_count, 0) AS message_count,
            cat.name AS category_name, doc.title AS document_title
     FROM chat_sessions cs
     LEFT JOIN (
       SELECT session_id, count(*) AS message_count FROM chat_messages GROUP BY session_id
     ) msg ON msg.session_id = cs.id
     LEFT JOIN categories cat ON cs.scope_type = 'category' AND cat.slug = cs.scope_id
     LEFT JOIN documents doc ON cs.scope_type = 'document' AND doc.slug = cs.scope_id
     WHERE cs.user_id = $1
     ORDER BY cs.updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.title ?? row.category_name ?? row.document_title ?? "All laws",
    scopeType: row.scope_type as "all" | "category" | "document",
    scopeId: row.scope_id,
    messageCount: Number(row.message_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export interface AdminConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
}

interface AdminConversationMessageRow {
  id: number;
  role: string;
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

/** Ownership-checked: only returns messages if `sessionId` belongs to `userId`. */
export async function getConversationMessages(
  userId: string,
  sessionId: string
): Promise<AdminConversationMessage[]> {
  const rows = await query<AdminConversationMessageRow>(
    `SELECT cm.id, cm.role, cm.content, cm.citations, cm.created_at
     FROM chat_messages cm
     JOIN chat_sessions cs ON cs.id = cm.session_id
     WHERE cm.session_id = $1 AND cs.user_id = $2
     ORDER BY cm.created_at`,
    [sessionId, userId]
  );
  return rows
    .filter((row) => !(row.role === "assistant" && row.content === ""))
    .map((row) => ({
      id: row.id,
      role: row.role === "user" ? "user" : "assistant",
      content: row.content,
      citations: row.citations ?? [],
      createdAt: row.created_at,
    }));
}
