import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

type ReactionType = "thumbs_up" | "thumbs_down" | "bookmark";
const VALID_TYPES: ReactionType[] = ["thumbs_up", "thumbs_down", "bookmark"];

interface OwnerRow {
  user_id: string | null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const { reactionType } = (await request.json()) as { reactionType?: string };
  if (!VALID_TYPES.includes(reactionType as ReactionType)) {
    return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });
  }

  const owners = await query<OwnerRow>(
    `SELECT cs.user_id FROM chat_messages cm JOIN chat_sessions cs ON cs.id = cm.session_id WHERE cm.id = $1`,
    [messageId]
  );
  if (owners.length === 0 || owners[0].user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await query(
    `SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3`,
    [messageId, session.user.id, reactionType]
  );

  if (existing.length > 0) {
    await query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3`, [
      messageId,
      session.user.id,
      reactionType,
    ]);
    return NextResponse.json({ active: false });
  }

  if (reactionType === "thumbs_up" || reactionType === "thumbs_down") {
    const opposite: ReactionType = reactionType === "thumbs_up" ? "thumbs_down" : "thumbs_up";
    await query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3`, [
      messageId,
      session.user.id,
      opposite,
    ]);
  }

  await query(`INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)`, [
    messageId,
    session.user.id,
    reactionType,
  ]);

  return NextResponse.json({ active: true });
}
