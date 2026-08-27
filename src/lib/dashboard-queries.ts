import { query } from "@/lib/db";

export interface DashboardStats {
  /** All-time total, incremented on every new session — survives thread deletion. */
  conversations: number;
  /** All-time total, incremented on every user message — survives thread deletion. */
  questionsAsked: number;
  /** All-time total, summed from the usage_events ledger by user_id — survives thread deletion. */
  totalTokens: number;
  /** Live count of conversations that still exist right now (drops when one is deleted). */
  currentConversations: number;
}

interface StatsRow {
  lifetime_conversations: string;
  lifetime_questions_asked: string;
  total_tokens: string;
  current_conversations: string;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  // conversations/questionsAsked read the lifetime counters on "user"
  // (incremented in src/app/api/chat/route.ts, never decremented) rather
  // than counting chat_sessions/chat_messages rows directly, because
  // deleting a thread hard-deletes those rows. totalTokens sums
  // usage_events by user_id directly instead of joining through
  // chat_sessions, since usage_events.session_id is only nulled (not
  // cascaded) on thread deletion — going through chat_sessions would lose
  // the tokens the moment the session disappears. currentConversations is
  // the one live count here, deliberately not a lifetime total.
  const rows = await query<StatsRow>(
    `SELECT
       u."lifetimeConversations"   AS lifetime_conversations,
       u."lifetimeQuestionsAsked"  AS lifetime_questions_asked,
       COALESCE((SELECT SUM(total_tokens) FROM usage_events WHERE user_id = u.id), 0) AS total_tokens,
       (SELECT count(*) FROM chat_sessions WHERE user_id = u.id)                      AS current_conversations
     FROM "user" u
     WHERE u.id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    conversations: Number(row?.lifetime_conversations ?? 0),
    questionsAsked: Number(row?.lifetime_questions_asked ?? 0),
    totalTokens: Number(row?.total_tokens ?? 0),
    currentConversations: Number(row?.current_conversations ?? 0),
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
