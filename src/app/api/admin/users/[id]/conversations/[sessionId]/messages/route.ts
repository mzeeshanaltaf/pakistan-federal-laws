import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConversationMessages } from "@/lib/admin-user-detail-queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, sessionId } = await params;
  const messages = await getConversationMessages(id, sessionId);
  return NextResponse.json({ messages });
}
