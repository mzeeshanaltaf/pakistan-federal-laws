import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

interface ReactionRow {
  message_id: number;
  reaction_type: string;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const rows = await query<ReactionRow>(
    `SELECT mr.message_id, mr.reaction_type
     FROM message_reactions mr
     JOIN chat_messages cm ON cm.id = mr.message_id
     WHERE cm.session_id = $1 AND mr.user_id = $2`,
    [sessionId, session.user.id]
  );

  const reactions: Record<number, string[]> = {};
  for (const row of rows) {
    (reactions[row.message_id] ??= []).push(row.reaction_type);
  }

  return NextResponse.json({ reactions });
}
