import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

interface SessionRow {
  id: string;
  title: string | null;
  scope_type: string;
  scope_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  role: string;
  content: string;
  citations: unknown;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const anonId = request.nextUrl.searchParams.get("anonId");

  if (sessionId) {
    // A localStorage- or URL-supplied sessionId can belong to a different
    // account than the one currently signed in (browser reuse across
    // accounts, a stale deep link) — scoping to cs.user_id is what stops
    // that account's history from leaking into this one instead of just
    // trusting whatever session id the client hands us.
    const messages = await query<MessageRow>(
      `SELECT cm.id, cm.role, cm.content, cm.citations, cm.created_at
       FROM chat_messages cm
       JOIN chat_sessions cs ON cs.id = cm.session_id
       WHERE cm.session_id = $1 AND cs.user_id = $2
       ORDER BY cm.created_at`,
      [sessionId, session.user.id]
    );
    return NextResponse.json({ messages });
  }

  if (anonId) {
    const sessions = await query<SessionRow>(
      `SELECT id, title, scope_type, scope_id, created_at, updated_at
       FROM chat_sessions WHERE anon_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT 50`,
      [anonId, session.user.id]
    );
    return NextResponse.json({ sessions });
  }

  return NextResponse.json({ error: "anonId or sessionId required" }, { status: 400 });
}
