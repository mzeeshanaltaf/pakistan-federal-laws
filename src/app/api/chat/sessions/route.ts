import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

interface SessionRow {
  id: string;
  scope_type: string;
  scope_id: string | null;
  updated_at: string;
  category_name: string | null;
  document_title: string | null;
  first_question: string | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  label: string;
  scopeType: "all" | "category" | "document";
  scopeId: string | null;
  updatedAt: string;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only sessions that actually have a message — a session id is created in
  // localStorage the moment a scope is opened, before any question is asked,
  // so most would otherwise show up here as empty entries.
  const rows = await query<SessionRow>(
    `SELECT cs.id, cs.scope_type, cs.scope_id, cs.updated_at,
            cat.name AS category_name, doc.title AS document_title,
            fm.content AS first_question
     FROM chat_sessions cs
     LEFT JOIN categories cat ON cs.scope_type = 'category' AND cat.slug = cs.scope_id
     LEFT JOIN documents doc ON cs.scope_type = 'document' AND doc.slug = cs.scope_id
     LEFT JOIN LATERAL (
       SELECT content FROM chat_messages
       WHERE session_id = cs.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1
     ) fm ON true
     WHERE cs.user_id = $1
       AND EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id)
     ORDER BY cs.updated_at DESC
     LIMIT 50`,
    [session.user.id]
  );

  const sessions: ChatSessionSummary[] = rows.map((row) => {
    const label = row.category_name ?? row.document_title ?? "All laws";
    return {
      id: row.id,
      title: row.first_question ? truncate(row.first_question, 60) : label,
      label,
      scopeType: row.scope_type as "all" | "category" | "document",
      scopeId: row.scope_id,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({ sessions });
}
