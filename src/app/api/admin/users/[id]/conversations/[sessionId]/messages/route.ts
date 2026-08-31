import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages } from "@/lib/admin-user-detail-queries";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id, sessionId } = await params;
  const messages = await getConversationMessages(id, sessionId);
  return NextResponse.json({ messages });
}
