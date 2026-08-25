import { query } from "@/lib/db";

export interface DashboardStats {
  conversations: number;
  questionsAsked: number;
  totalTokens: number;
}

interface StatsRow {
  conversations: string;
  questions_asked: string;
  total_tokens: string;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  // Pre-aggregate chat_messages and usage_events per session *before* joining
  // to chat_sessions — joining both tables directly (as the plan doc's SQL
  // literally reads) cross-products every message row against every usage
  // row for the same session, inflating both questions_asked and
  // total_tokens by a multiplicative factor once a session has more than one
  // of each (i.e. almost always). Confirmed via a live test: 3 real
  // questions across 2 sessions came back as questions_asked=10 with the
  // naive double-LEFT-JOIN version.
  const rows = await query<StatsRow>(
    `SELECT
       count(*)                            AS conversations,
       COALESCE(SUM(msg.questions_asked), 0) AS questions_asked,
       COALESCE(SUM(usage.total_tokens), 0)  AS total_tokens
     FROM chat_sessions cs
     LEFT JOIN (
       SELECT session_id, count(*) FILTER (WHERE role = 'user') AS questions_asked
       FROM chat_messages
       GROUP BY session_id
     ) msg ON msg.session_id = cs.id
     LEFT JOIN (
       SELECT session_id, SUM(total_tokens) AS total_tokens
       FROM usage_events
       GROUP BY session_id
     ) usage ON usage.session_id = cs.id
     WHERE cs.user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    conversations: Number(row?.conversations ?? 0),
    questionsAsked: Number(row?.questions_asked ?? 0),
    totalTokens: Number(row?.total_tokens ?? 0),
  };
}

export interface BookmarkedMessage {
  id: number;
  content: string;
  createdAt: string;
  sessionId: string;
  /** Human-readable scope label for display and for the /ask deep link's `label` param — never null. */
  label: string;
  scopeType: "all" | "category" | "document";
  scopeId: string | null;
}

interface BookmarkRow {
  id: number;
  content: string;
  created_at: string;
  session_id: string;
  title: string | null;
  scope_type: string;
  scope_id: string | null;
  category_name: string | null;
  document_title: string | null;
}

export async function getBookmarkedMessages(userId: string): Promise<BookmarkedMessage[]> {
  // chat_sessions.title is essentially never populated by the current chat
  // flow, so it can't be relied on alone for display — resolve a real label
  // from the category/document the session was scoped to instead (joined on
  // scope_id, which is the same slug chat-thread.tsx already uses to build
  // ChatScope). Falling back to "All laws" only when the session really was
  // unscoped, not whenever a title happens to be missing.
  const rows = await query<BookmarkRow>(
    `SELECT cm.id, cm.content, cm.created_at, cs.id AS session_id, cs.title, cs.scope_type, cs.scope_id,
            cat.name AS category_name, doc.title AS document_title
     FROM message_reactions mr
     JOIN chat_messages cm ON cm.id = mr.message_id
     JOIN chat_sessions cs ON cs.id = cm.session_id
     LEFT JOIN categories cat ON cs.scope_type = 'category' AND cat.slug = cs.scope_id
     LEFT JOIN documents doc ON cs.scope_type = 'document' AND doc.slug = cs.scope_id
     WHERE mr.user_id = $1 AND mr.reaction_type = 'bookmark'
     ORDER BY mr.created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    sessionId: row.session_id,
    label: row.title ?? row.category_name ?? row.document_title ?? "All laws",
    scopeType: row.scope_type as "all" | "category" | "document",
    scopeId: row.scope_id,
  }));
}
