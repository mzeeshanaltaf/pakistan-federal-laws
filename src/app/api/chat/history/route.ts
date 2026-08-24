import { NextRequest, NextResponse } from "next/server";
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
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const anonId = request.nextUrl.searchParams.get("anonId");

  if (sessionId) {
    const messages = await query<MessageRow>(
      `SELECT id, role, content, citations, created_at
       FROM chat_messages WHERE session_id = $1 ORDER BY created_at`,
      [sessionId]
    );
    return NextResponse.json({ messages });
  }

  if (anonId) {
    const sessions = await query<SessionRow>(
      `SELECT id, title, scope_type, scope_id, created_at, updated_at
       FROM chat_sessions WHERE anon_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [anonId]
    );
    return NextResponse.json({ sessions });
  }

  return NextResponse.json({ error: "anonId or sessionId required" }, { status: 400 });
}
