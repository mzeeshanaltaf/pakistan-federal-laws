import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { deleteAvatar } from "@/lib/storage";

// The AWS SDK needs Node APIs — must not run on the Edge runtime.
export const runtime = "nodejs";

// user, session, and account rows all have ON DELETE CASCADE back to
// pak_laws."user" (Better Auth's default schema, confirmed against this DB's
// information_schema), and chat_sessions.user_id cascades too — so deleting
// the user row alone takes chat_sessions/chat_messages/message_reactions
// with it. Only the MinIO avatar object needs manual cleanup.
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteAvatar(session.user.id).catch(() => {});
  await query(`DELETE FROM "user" WHERE id = $1`, [session.user.id]);

  return NextResponse.json({ success: true });
}
