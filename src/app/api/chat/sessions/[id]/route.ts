import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

interface OwnerRow {
  user_id: string | null;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const owners = await query<OwnerRow>(`SELECT user_id FROM chat_sessions WHERE id = $1`, [id]);
  if (owners.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (owners[0].user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // chat_messages and message_reactions cascade from chat_sessions.id.
  await query(`DELETE FROM chat_sessions WHERE id = $1`, [id]);

  return NextResponse.json({ success: true });
}
